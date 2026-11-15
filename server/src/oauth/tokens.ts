import { hashToken } from '../auth.js'
import { pool, withTransaction } from '../db.js'
import type { Db } from '../db.js'
import type { OAuthClient } from './clients.js'
import {
  ACCESS_TOKEN_SECONDS,
  REFRESH_REUSE_GRACE_SECONDS,
  REFRESH_TOKEN_DAYS,
  SCOPES,
  isOurResource,
  parseScopes,
  resourceUrl,
} from './config.js'
import type { Scope } from './config.js'
import { newSecret, verifyPkce } from './crypto.js'
import { OAuthError } from './errors.js'

export interface TokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token: string
  scope: string
}

/** Who an access token acts for. */
export interface AccessContext {
  grantId: string
  userId: string
  scopes: Scope[]
  clientName: string
}

type Form = Record<string, string>

/**
 * Work that may need to commit a revocation *and* then fail the request, so
 * failures are returned rather than thrown inside the transaction.
 */
type Outcome = { ok: true; tokens: TokenResponse } | { ok: false; error: OAuthError }

const invalidGrant = (description: string): Outcome => ({
  ok: false,
  error: new OAuthError('invalid_grant', description),
})

async function settle(work: (db: Db) => Promise<Outcome>): Promise<TokenResponse> {
  const outcome = await withTransaction(work)
  if (!outcome.ok) throw outcome.error
  return outcome.tokens
}

function sortScopes(scopes: readonly string[]): Scope[] {
  return SCOPES.filter((scope) => scopes.includes(scope))
}

/**
 * `scopes` are what this access token may do. They are stored on the token,
 * so a refresh that asks for less gets a token that really is narrower. The
 * refresh token keeps the connection's full scopes (null).
 */
async function issueTokenPair(db: Db, grantId: string, scopes: Scope[]): Promise<TokenResponse> {
  const access = newSecret('oza_at')
  const refresh = newSecret('oza_rt')
  await db.query(
    `insert into auth.oauth_tokens (token_hash, grant_id, kind, expires_at, scopes) values
       ($1, $3, 'access',  now() + make_interval(secs => $4), $6::text[]),
       ($2, $3, 'refresh', now() + make_interval(days => $5), null)`,
    [hashToken(access), hashToken(refresh), grantId, ACCESS_TOKEN_SECONDS, REFRESH_TOKEN_DAYS, scopes],
  )
  await db.query(
    `update auth.oauth_grants
        set expires_at = now() + make_interval(days => $2), last_used_at = now()
      where id = $1`,
    [grantId, REFRESH_TOKEN_DAYS],
  )
  return {
    access_token: access,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_SECONDS,
    refresh_token: refresh,
    scope: scopes.join(' '),
  }
}

export async function revokeGrant(db: Db | typeof pool, grantId: string): Promise<void> {
  await db.query('update auth.oauth_grants set revoked_at = now() where id = $1 and revoked_at is null', [grantId])
  await db.query('update auth.oauth_tokens set revoked_at = now() where grant_id = $1 and revoked_at is null', [grantId])
}

/** grant_type=authorization_code: a new connection from a single-use code. */
export function exchangeCode(client: OAuthClient, form: Form): Promise<TokenResponse> {
  return settle(async (db) => {
    const { rows } = await db.query<{
      client_id: string
      user_id: string
      redirect_uri: string
      scopes: string[]
      code_challenge: string
      resource: string
      live: boolean
      used_at: Date | null
      grant_id: string | null
    }>(
      `select client_id, user_id, redirect_uri, scopes, code_challenge, resource,
              expires_at > now() as live, used_at, grant_id
         from auth.oauth_codes where code_hash = $1 for update`,
      [hashToken(form.code ?? '')],
    )
    const code = rows[0]
    // Prove the caller is the client the code was issued to, and holds its
    // PKCE verifier, before anything else. Until then an unknown code and
    // someone else's code look the same, and nothing is revoked: otherwise
    // anyone who saw a used code could disconnect the app it belongs to.
    if (!code || code.client_id !== client.client_id) return invalidGrant('This authorization code is not valid')
    if (!verifyPkce(form.code_verifier ?? '', code.code_challenge)) return invalidGrant('PKCE verification failed')
    if (code.used_at) {
      // A replayed code may have been stolen: cut off what it was exchanged for.
      if (code.grant_id) await revokeGrant(db, code.grant_id)
      return invalidGrant('This authorization code was already used')
    }
    if (!code.live) return invalidGrant('This authorization code has expired')
    if (form.redirect_uri !== undefined && form.redirect_uri !== code.redirect_uri) {
      return invalidGrant('redirect_uri does not match the authorization request')
    }
    if (form.resource !== undefined && (!isOurResource(form.resource) || code.resource !== resourceUrl())) {
      return { ok: false, error: new OAuthError('invalid_target', `resource must be ${resourceUrl()}`) }
    }

    const scopes = sortScopes(code.scopes)
    const grant = await db.query<{ id: string }>(
      `insert into auth.oauth_grants (user_id, client_id, scopes, resource, expires_at)
       values ($1, $2, $3, $4, now() + make_interval(days => $5))
       returning id`,
      [code.user_id, client.client_id, scopes, code.resource, REFRESH_TOKEN_DAYS],
    )
    const grantId = grant.rows[0]!.id
    await db.query('update auth.oauth_codes set used_at = now(), grant_id = $2 where code_hash = $1', [
      hashToken(form.code ?? ''),
      grantId,
    ])
    return { ok: true, tokens: await issueTokenPair(db, grantId, scopes) }
  })
}

/** grant_type=refresh_token: rotate the refresh token and issue a new access token. */
export function refreshTokens(client: OAuthClient, form: Form): Promise<TokenResponse> {
  return settle(async (db) => {
    const { rows } = await db.query<{
      grant_id: string
      client_id: string
      scopes: string[]
      resource: string
      live: boolean
      rotated_secs: number | null
      revoked: boolean
      grant_live: boolean
    }>(
      `select t.grant_id, g.client_id, g.scopes, g.resource,
              t.expires_at > now() as live,
              extract(epoch from now() - t.rotated_at)::float8 as rotated_secs,
              t.revoked_at is not null as revoked,
              g.revoked_at is null and g.expires_at > now() as grant_live
         from auth.oauth_tokens t
         join auth.oauth_grants g on g.id = t.grant_id
        where t.token_hash = $1 and t.kind = 'refresh'
        for update of t, g`,
      [hashToken(form.refresh_token ?? '')],
    )
    const token = rows[0]
    if (!token) return invalidGrant('Unknown refresh token')
    if (token.client_id !== client.client_id) return invalidGrant('This token was issued to another client')
    if (!token.grant_live || token.revoked) return invalidGrant('This connection was disconnected')
    if (token.rotated_secs !== null) {
      // A quick retry of a refresh that already succeeded is harmless; an old
      // token coming back later means it leaked, so end the connection.
      if (token.rotated_secs > REFRESH_REUSE_GRACE_SECONDS) await revokeGrant(db, token.grant_id)
      return invalidGrant('This refresh token was already used')
    }
    if (!token.live) return invalidGrant('This refresh token has expired')
    if (token.resource !== resourceUrl() || (form.resource !== undefined && !isOurResource(form.resource))) {
      return { ok: false, error: new OAuthError('invalid_target', `resource must be ${resourceUrl()}`) }
    }

    const granted = sortScopes(token.scopes)
    let issued = granted
    if (form.scope !== undefined) {
      const asked = parseScopes(form.scope)
      if (!asked || !asked.every((scope) => granted.includes(scope))) {
        return { ok: false, error: new OAuthError('invalid_scope', 'A refresh cannot add scopes') }
      }
      // Asking for less narrows this access token only (RFC 6749 §6).
      issued = asked
    }

    await db.query('update auth.oauth_tokens set rotated_at = now() where token_hash = $1', [
      hashToken(form.refresh_token ?? ''),
    ])
    return { ok: true, tokens: await issueTokenPair(db, token.grant_id, issued) }
  })
}

/** RFC 7009: revoking either token ends its connection. Unknown tokens are fine. */
export async function revokeToken(client: OAuthClient, token: string): Promise<void> {
  const { rows } = await pool.query<{ grant_id: string }>(
    `select t.grant_id from auth.oauth_tokens t
       join auth.oauth_grants g on g.id = t.grant_id
      where t.token_hash = $1 and g.client_id = $2`,
    [hashToken(token), client.client_id],
  )
  const grantId = rows[0]?.grant_id
  if (grantId) await withTransaction((db) => revokeGrant(db, grantId))
}

/** Resolve a bearer token on /api/mcp, or null if it isn't a live access token. */
export async function verifyAccessToken(token: string): Promise<AccessContext | null> {
  if (!token.startsWith('oza_at_')) return null
  const { rows } = await pool.query<{
    grant_id: string
    user_id: string
    scopes: string[]
    token_scopes: string[] | null
    client_name: string
  }>(
    `select g.id as grant_id, g.user_id, g.scopes, t.scopes as token_scopes, c.client_name
       from auth.oauth_tokens t
       join auth.oauth_grants g on g.id = t.grant_id
       join auth.oauth_clients c on c.client_id = g.client_id
      where t.token_hash = $1 and t.kind = 'access'
        and t.revoked_at is null and t.expires_at > now()
        and g.revoked_at is null and g.resource = $2`,
    [hashToken(token), resourceUrl()],
  )
  const row = rows[0]
  if (!row) return null
  // At most one write a minute per connection for "last used".
  await pool.query(
    `update auth.oauth_grants set last_used_at = now()
      where id = $1 and (last_used_at is null or last_used_at < now() - interval '1 minute')`,
    [row.grant_id],
  )
  // Never more than the connection allows, and less if the token was narrowed.
  const tokenScopes = row.token_scopes
  const scopes = sortScopes(row.scopes).filter((scope) => !tokenScopes || tokenScopes.includes(scope))
  return { grantId: row.grant_id, userId: row.user_id, scopes, clientName: row.client_name }
}

/** Hourly cleanup of codes, tokens and connections that can no longer be used. */
export async function purgeExpiredOAuthRows(): Promise<void> {
  await pool.query(`delete from auth.oauth_codes where expires_at < now() - interval '1 day'`)
  await pool.query(
    `delete from auth.oauth_tokens
      where expires_at < now() - interval '1 day' or revoked_at < now() - interval '1 day'`,
  )
  await pool.query(
    `delete from auth.oauth_grants
      where expires_at < now() - interval '30 days' or revoked_at < now() - interval '30 days'`,
  )
  // Registrations that never led to a connection.
  await pool.query(
    `delete from auth.oauth_clients c
      where c.created_at < now() - interval '30 days'
        and not exists (select 1 from auth.oauth_grants g where g.client_id = c.client_id)
        and not exists (select 1 from auth.oauth_codes o where o.client_id = c.client_id)`,
  )
}
