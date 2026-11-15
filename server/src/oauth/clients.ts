import { hashToken } from '../auth.js'
import { pool } from '../db.js'
import { newSecret, safeEqual } from './crypto.js'
import { OAuthError } from './errors.js'
import type { Registration, TokenAuthMethod } from './registration.js'

export interface OAuthClient {
  client_id: string
  client_name: string
  redirect_uris: string[]
  token_endpoint_auth_method: TokenAuthMethod
  client_secret_hash: string | null
}

/** Store a validated registration and build the RFC 7591 response. */
export async function registerClient(registration: Registration) {
  const clientId = newSecret('oza_cid')
  const secret = registration.token_endpoint_auth_method === 'none' ? null : newSecret('oza_cs')
  await pool.query(
    `insert into auth.oauth_clients
       (client_id, client_secret_hash, client_name, redirect_uris, token_endpoint_auth_method)
     values ($1, $2, $3, $4, $5)`,
    [
      clientId,
      secret ? hashToken(secret) : null,
      registration.client_name,
      registration.redirect_uris,
      registration.token_endpoint_auth_method,
    ],
  )
  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    client_name: registration.client_name,
    redirect_uris: registration.redirect_uris,
    token_endpoint_auth_method: registration.token_endpoint_auth_method,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  }
}

export async function findClient(clientId: string): Promise<OAuthClient | null> {
  if (!clientId || clientId.length > 200) return null
  const { rows } = await pool.query<OAuthClient>(
    `select client_id, client_name, redirect_uris, token_endpoint_auth_method, client_secret_hash
       from auth.oauth_clients where client_id = $1`,
    [clientId],
  )
  return rows[0] ?? null
}

/**
 * Identify and authenticate the client at the token and revocation endpoints,
 * by HTTP Basic, by client_secret in the form, or by client_id alone for a
 * public client. Always fails the same way so callers can't probe ids.
 */
export async function authenticateClient(
  authorization: string | undefined,
  form: Record<string, string>,
): Promise<OAuthClient> {
  const fail = () => new OAuthError('invalid_client', 'Client authentication failed', 401)

  let clientId = form.client_id ?? ''
  let secret = form.client_secret
  if (authorization?.startsWith('Basic ')) {
    const decoded = Buffer.from(authorization.slice(6).trim(), 'base64').toString('utf8')
    const colon = decoded.indexOf(':')
    if (colon < 0) throw fail()
    try {
      // RFC 6749 §2.3.1: both halves are form-urlencoded.
      clientId = decodeURIComponent(decoded.slice(0, colon).replace(/\+/g, ' '))
      secret = decodeURIComponent(decoded.slice(colon + 1).replace(/\+/g, ' '))
    } catch {
      throw fail()
    }
  }

  const client = await findClient(clientId)
  if (!client) throw fail()
  if (client.token_endpoint_auth_method === 'none') return client
  if (!secret || !client.client_secret_hash || !safeEqual(hashToken(secret), client.client_secret_hash)) throw fail()
  return client
}
