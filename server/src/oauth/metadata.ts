import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HttpError } from '../http.js'
import { SCOPES, issuer, mcpEnabled, resourceUrl } from './config.js'

export const TOKEN_AUTH_METHODS = ['none', 'client_secret_post', 'client_secret_basic'] as const

/** RFC 9728 protected resource metadata for /api/mcp. */
export function protectedResourceMetadata() {
  return {
    resource: resourceUrl(),
    authorization_servers: [issuer()],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'OzempicAI',
  }
}

/** RFC 8414 authorization server metadata. */
export function authorizationServerMetadata() {
  const base = issuer()
  return {
    issuer: base,
    // A web app route: the user logs in there and approves the connection.
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    scopes_supported: [...SCOPES],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: [...TOKEN_AUTH_METHODS],
    revocation_endpoint_auth_methods_supported: [...TOKEN_AUTH_METHODS],
    code_challenge_methods_supported: ['S256'],
    authorization_response_iss_parameter_supported: true,
  }
}

/**
 * Discovery documents, served outside /api (Caddy routes /.well-known/oauth-*
 * to the API). Public and cookie-free, so any origin may read them.
 */
export const wellKnownRoutes = new Hono()

wellKnownRoutes.use('*', cors({ origin: '*', allowMethods: ['GET', 'OPTIONS'] }))
wellKnownRoutes.use('*', async (c, next) => {
  if (!mcpEnabled()) throw new HttpError(404, 'Not found')
  await next()
  c.header('Cache-Control', 'public, max-age=300')
})

// Clients try the path-specific location first, then the root one.
wellKnownRoutes.get('/oauth-protected-resource/api/mcp', (c) => c.json(protectedResourceMetadata()))
wellKnownRoutes.get('/oauth-protected-resource', (c) => c.json(protectedResourceMetadata()))
wellKnownRoutes.get('/oauth-authorization-server', (c) => c.json(authorizationServerMetadata()))
