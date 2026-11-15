import { hashToken } from '../auth.js'
import { pool } from '../db.js'
import { HttpError } from '../http.js'
import { findClient } from './clients.js'
import type { OAuthClient } from './clients.js'
import { CODE_SECONDS, isOurResource, issuer, parseScopes, resourceUrl } from './config.js'
import type { Scope } from './config.js'
import { isValidCodeChallenge, newSecret } from './crypto.js'

/** The query string an AI app sends to /oauth/authorize. */
export type AuthorizeParams = Record<string, string | undefined>

export interface AuthorizeRequest {
  client: OAuthClient
  redirectUri: string
  state: string | undefined
  scopes: Scope[]
  codeChallenge: string
  resource: string
}

/**
 * Either a valid request, or an error to send back to the app through its
 * redirect URI. Problems with the client or redirect URI themselves throw
 * instead: those must be shown to the user and never redirected to.
 */
export type AuthorizeCheck =
  | { ok: true; request: AuthorizeRequest }
  | { ok: false; redirectTo: string; problem: string; redirectLabel: string }

const MAX_STATE = 2000

export async function checkAuthorizeRequest(params: AuthorizeParams): Promise<AuthorizeCheck> {
  const client = params.client_id ? await findClient(params.client_id) : null
  if (!client) {
    throw new HttpError(400, 'This app is not registered with OzempicAI. Go back to the app and try connecting again.')
  }

  let redirectUri = params.redirect_uri
  if (!redirectUri && client.redirect_uris.length === 1) redirectUri = client.redirect_uris[0]
  if (!redirectUri || !client.redirect_uris.includes(redirectUri)) {
    throw new HttpError(400, "This sign-in link has a return address the app didn't register, so it was stopped.")
  }

  const state = params.state
  const fail = (error: string, description: string): AuthorizeCheck => ({
    ok: false,
    redirectTo: buildRedirect(redirectUri, { error, error_description: description, state }),
    problem: description,
    redirectLabel: describeRedirect(redirectUri),
  })

  if (state !== undefined && state.length > MAX_STATE) return fail('invalid_request', 'state is too long')
  if (params.response_type !== 'code') return fail('unsupported_response_type', 'Only response_type=code is supported')
  if (params.code_challenge_method !== 'S256' || !params.code_challenge || !isValidCodeChallenge(params.code_challenge)) {
    return fail('invalid_request', 'PKCE is required: send an S256 code_challenge')
  }
  const scopes = parseScopes(params.scope)
  if (!scopes) return fail('invalid_scope', 'Supported scopes are read and write')
  if (params.resource !== undefined && !isOurResource(params.resource)) {
    return fail('invalid_target', `resource must be ${resourceUrl()}`)
  }

  return {
    ok: true,
    request: {
      client,
      redirectUri,
      state,
      scopes,
      codeChallenge: params.code_challenge,
      resource: resourceUrl(),
    },
  }
}

/** Add parameters (plus RFC 9207's `iss`) to a registered redirect URI. */
export function buildRedirect(redirectUri: string, params: Record<string, string | undefined>): string {
  const url = new URL(redirectUri)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value)
  }
  url.searchParams.set('iss', issuer())
  return url.toString()
}

/** How the consent screen describes where the user is sent back to. */
export function describeRedirect(redirectUri: string): string {
  const url = new URL(redirectUri)
  if (url.protocol === 'https:') return url.host
  if (url.protocol === 'http:') return `an app on this computer (${url.host})`
  return `the ${url.protocol.slice(0, -1)} app`
}

/**
 * The scopes the user chose on the consent screen: a non-empty subset of
 * what the app asked for, always including read.
 */
export function grantedScopes(requested: Scope[], chosen: unknown): Scope[] {
  if (!Array.isArray(chosen)) throw new HttpError(400, 'Choose what the app may do')
  const granted = requested.filter((scope) => chosen.includes(scope))
  if (!granted.includes('read')) throw new HttpError(400, 'Connected apps always need read access')
  return granted
}

/** Issue a single-use authorization code and return the redirect carrying it. */
export async function issueCode(request: AuthorizeRequest, userId: string, scopes: Scope[]): Promise<string> {
  const code = newSecret('oza_ac')
  await pool.query(
    `insert into auth.oauth_codes
       (code_hash, client_id, user_id, redirect_uri, scopes, code_challenge, resource, expires_at)
     values ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(secs => $8))`,
    [
      hashToken(code),
      request.client.client_id,
      userId,
      request.redirectUri,
      scopes,
      request.codeChallenge,
      request.resource,
      CODE_SECONDS,
    ],
  )
  return buildRedirect(request.redirectUri, { code, state: request.state })
}
