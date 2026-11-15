import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Context } from 'hono'
import type { AppEnv } from '../auth.js'
import { clientIp, countHit, hitCount, rateLimit, requireUser } from '../auth.js'
import { HttpError, readJson } from '../http.js'
import { buildRedirect, checkAuthorizeRequest, describeRedirect, grantedScopes, issueCode } from './authorize.js'
import type { AuthorizeParams } from './authorize.js'
import { authenticateClient, registerClient } from './clients.js'
import { mcpEnabled } from './config.js'
import { OAuthError } from './errors.js'
import { isWebRedirect, parseRegistration } from './registration.js'
import { exchangeCode, refreshTokens, revokeToken } from './tokens.js'

/**
 * The OAuth authorization server behind /api/mcp, mounted at /api/oauth
 * before the session-only data routes (docs/mcp-server-plan.md §3.3).
 */
export const oauthRoutes = new Hono<AppEnv>()

oauthRoutes.use('*', async (_c, next) => {
  if (!mcpEnabled()) throw new HttpError(404, 'Not found')
  await next()
})

// Called by AI apps' servers or, for some clients, from a browser. No cookies
// are involved, so any origin may call these.
const publicCors = cors({ origin: '*', allowMethods: ['POST', 'OPTIONS'], allowHeaders: ['Authorization', 'Content-Type'] })
oauthRoutes.use('/register', publicCors)
oauthRoutes.use('/token', publicCors)
oauthRoutes.use('/revoke', publicCors)

/** Dynamic Client Registration (RFC 7591). */
oauthRoutes.post('/register', async (c) => {
  rateLimit(`oauth-register-ip:${clientIp(c)}`, 20, 60 * 60_000)
  const registration = parseRegistration(await readJson(c))
  // The per-IP limit trusts proxy headers a client can forge, so also cap
  // valid registrations overall. Hitting it only delays new connections;
  // existing ones keep working. Unused registrations are deleted after 30 days.
  rateLimit('oauth-register:all', 200, 60 * 60_000, 'Too many apps are registering right now. Try again later.')
  c.header('Cache-Control', 'no-store')
  return c.json(await registerClient(registration), 201)
})

const AUTHORIZE_PARAMS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'scope',
  'state',
  'resource',
] as const

function readAuthorizeParams(source: unknown): AuthorizeParams {
  const params: AuthorizeParams = {}
  if (!source || typeof source !== 'object') return params
  for (const key of AUTHORIZE_PARAMS) {
    const value = (source as Record<string, unknown>)[key]
    if (typeof value === 'string') params[key] = value
  }
  return params
}

/**
 * Where to send the browser when the user did NOT approve (declined, or the
 * request was malformed). Anyone can register an app with any redirect, so
 * without approval we only ever go back to a web address. A custom scheme
 * could open the dialer or another app; for those the screen just says the
 * request was cancelled and stays put (null).
 */
function returnAddress(redirectTo: string): string | null {
  return isWebRedirect(redirectTo) ? redirectTo : null
}

/**
 * The consent screen (/oauth/authorize in the web app) asks what is being
 * requested. The user is signed in to OzempicAI; the app is not yet.
 */
oauthRoutes.get('/authorize', requireUser, async (c) => {
  const check = await checkAuthorizeRequest(readAuthorizeParams(c.req.query()))
  if (!check.ok) {
    // Never bounce the browser automatically: anyone can register a client,
    // so an automatic error redirect would make this an open redirector
    // (RFC 9700 §4.11.2). The screen shows the problem and the user chooses.
    return c.json({
      problem: check.problem,
      redirect_to: returnAddress(check.redirectTo),
      redirect_to_label: check.redirectLabel,
    })
  }
  const { request } = check
  return c.json({
    client_name: request.client.client_name,
    redirect_to_label: describeRedirect(request.redirectUri),
    scopes: request.scopes,
  })
})

/** The user's decision. Returns where to send the browser next. */
oauthRoutes.post('/authorize', requireUser, async (c) => {
  const body = await readJson(c)
  const check = await checkAuthorizeRequest(readAuthorizeParams(body.params))
  if (!check.ok) return c.json({ redirect_to: returnAddress(check.redirectTo) })
  const { request } = check

  if (body.decision !== 'allow') {
    return c.json({
      redirect_to: returnAddress(
        buildRedirect(request.redirectUri, {
          error: 'access_denied',
          error_description: 'The user declined the connection',
          state: request.state,
        }),
      ),
    })
  }
  const scopes = grantedScopes(request.scopes, body.scopes)
  return c.json({ redirect_to: await issueCode(request, c.get('user').id, scopes, c.get('token')) })
})

/** Token and revocation requests are form-encoded (RFC 6749); accept JSON too. */
async function readForm(c: Context): Promise<Record<string, string>> {
  const type = c.req.header('content-type') ?? ''
  const raw: Record<string, unknown> = type.includes('application/json')
    ? await readJson(c)
    : await c.req.parseBody().catch(() => {
        throw new OAuthError('invalid_request', 'Send the request as application/x-www-form-urlencoded')
      })
  const form: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) if (typeof value === 'string') form[key] = value
  return form
}

const TOKEN_WINDOW_MS = 15 * 60_000
const TOKEN_REQUESTS_PER_CLIENT = 60

oauthRoutes.post('/token', async (c) => {
  // Per address, before any database work: this is what slows down guessing
  // and floods from callers who have proved nothing yet.
  rateLimit(`oauth-token-ip:${clientIp(c)}`, 120, TOKEN_WINDOW_MS)
  const form = await readForm(c)
  const client = await authenticateClient(c.req.header('authorization'), form)

  // A public client is identified by its id alone, and ids aren't secret. If
  // every request counted, anyone could spend the client's allowance with
  // junk and block its real users, so for public clients only requests that
  // present a valid code or refresh token count. Confidential clients have
  // already proved who they are with their secret.
  const clientKey = `oauth-token:client:${client.client_id}`
  const isPublic = client.token_endpoint_auth_method === 'none'
  if (isPublic) {
    if (hitCount(clientKey) >= TOKEN_REQUESTS_PER_CLIENT) throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.')
  } else {
    rateLimit(clientKey, TOKEN_REQUESTS_PER_CLIENT, TOKEN_WINDOW_MS)
  }

  let tokens
  if (form.grant_type === 'authorization_code') tokens = await exchangeCode(client, form)
  else if (form.grant_type === 'refresh_token') tokens = await refreshTokens(client, form)
  else throw new OAuthError('unsupported_grant_type', 'Use authorization_code or refresh_token')
  if (isPublic) countHit(clientKey, TOKEN_WINDOW_MS)

  c.header('Cache-Control', 'no-store')
  c.header('Pragma', 'no-cache')
  return c.json(tokens)
})

oauthRoutes.post('/revoke', async (c) => {
  rateLimit(`oauth-revoke-ip:${clientIp(c)}`, 120, TOKEN_WINDOW_MS)
  const form = await readForm(c)
  const client = await authenticateClient(c.req.header('authorization'), form)
  if (form.token) await revokeToken(client, form.token)
  return c.body(null, 200)
})
