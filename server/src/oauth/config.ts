/**
 * Settings shared by the OAuth authorization server and the MCP endpoint
 * (docs/mcp-server-plan.md). Both are off unless MCP_ENABLED=true and APP_URL
 * (the public origin that serves the web app, /api and /.well-known) is set.
 */

export const SCOPES = ['read', 'write'] as const
export type Scope = (typeof SCOPES)[number]

export const ACCESS_TOKEN_SECONDS = 60 * 60
export const REFRESH_TOKEN_DAYS = 60
export const CODE_SECONDS = 10 * 60
/** A refresh token presented again within this window is a retry, not theft. */
export const REFRESH_REUSE_GRACE_SECONDS = 60

let warned = false

export function mcpEnabled(): boolean {
  if (process.env.MCP_ENABLED !== 'true') return false
  if (!process.env.APP_URL) {
    if (!warned) console.warn('MCP_ENABLED is true but APP_URL is not set, so MCP stays off.')
    warned = true
    return false
  }
  return true
}

/** The authorization server's issuer: the app's public origin, no trailing slash. */
export function issuer(): string {
  return (process.env.APP_URL ?? '').replace(/\/+$/, '')
}

/** The protected resource (RFC 8707 / RFC 9728): the MCP endpoint's URL. */
export function resourceUrl(): string {
  return `${issuer()}/api/mcp`
}

export function protectedResourceMetadataUrl(): string {
  return `${issuer()}/.well-known/oauth-protected-resource/api/mcp`
}

/**
 * Parse a space-separated scope string. Empty or missing means every scope.
 * Returns null when it names a scope we don't have.
 */
export function parseScopes(value: string | undefined | null): Scope[] | null {
  const parts = (value ?? '').split(' ').filter(Boolean)
  if (parts.length === 0) return [...SCOPES]
  const known = new Set<string>(SCOPES)
  if (!parts.every((part) => known.has(part))) return null
  return SCOPES.filter((scope) => parts.includes(scope))
}

/** Is `resource` our MCP endpoint? Trailing slashes are ignored. */
export function isOurResource(resource: string): boolean {
  return resource.replace(/\/+$/, '') === resourceUrl()
}
