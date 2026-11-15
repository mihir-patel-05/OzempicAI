import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from '../auth.js'
import { clientIp, rateLimit, requireUser } from '../auth.js'
import { HttpError, readJson } from '../http.js'
import { buildRedirect, checkAuthorizeRequest, describeRedirect, grantedScopes, issueCode } from './authorize.js'
import type { AuthorizeParams } from './authorize.js'
import { registerClient } from './clients.js'
import { mcpEnabled } from './config.js'
import { parseRegistration } from './registration.js'

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
  rateLimit(`oauth-register:ip:${clientIp(c)}`, 20, 60 * 60_000)
  const registration = parseRegistration(await readJson(c))
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
 * The consent screen (/oauth/authorize in the web app) asks what is being
 * requested. The user is signed in to OzempicAI; the app is not yet.
 */
oauthRoutes.get('/authorize', requireUser, async (c) => {
  const check = await checkAuthorizeRequest(readAuthorizeParams(c.req.query()))
  if (!check.ok) return c.json({ redirect_to: check.redirectTo })
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
  if (!check.ok) return c.json({ redirect_to: check.redirectTo })
  const { request } = check

  if (body.decision !== 'allow') {
    return c.json({
      redirect_to: buildRedirect(request.redirectUri, {
        error: 'access_denied',
        error_description: 'The user declined the connection',
        state: request.state,
      }),
    })
  }
  const scopes = grantedScopes(request.scopes, body.scopes)
  return c.json({ redirect_to: await issueCode(request, c.get('user').id, scopes) })
})
