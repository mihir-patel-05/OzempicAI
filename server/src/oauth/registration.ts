import { OAuthError } from './errors.js'
import { TOKEN_AUTH_METHODS } from './metadata.js'

export type TokenAuthMethod = (typeof TOKEN_AUTH_METHODS)[number]

const MAX_REDIRECT_URIS = 10
const MAX_URI_LENGTH = 2000
const MAX_NAME_LENGTH = 100
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
/**
 * Schemes that could run code, read local data, or make the device do
 * something (dial, text, run a shortcut, open system settings) if we
 * redirected to them. A blocklist can't be complete, which is why the consent
 * screen also never navigates to a non-web address unless the user pressed
 * Allow (see isWebRedirect).
 */
const BLOCKED_SCHEMES = new Set([
  'javascript', 'data', 'file', 'vbscript', 'about', 'blob', 'ftp', 'ws', 'wss',
  'tel', 'sms', 'smsto', 'mms', 'mailto', 'callto', 'facetime', 'facetime-audio', 'skype', 'sip', 'sips',
  'intent', 'market', 'itms', 'itms-apps', 'itms-services', 'shortcuts', 'workflow', 'prefs', 'app-settings',
  'chrome', 'chrome-extension', 'edge', 'view-source', 'resource', 'jar', 'smb', 'ssh', 'telnet', 'ldap', 'ldaps',
  'search-ms', 'windows', 'x-apple-reminder', 'x-apple-reminderkit', 'maps', 'geo',
])
/** Windows registers a large family of ms-* schemes (ms-settings, ms-msdt, …). */
const BLOCKED_SCHEME_PREFIXES = ['ms-', 'x-apple']

/** https, or http on this computer: the only addresses a declined request is sent back to. */
export function isWebRedirect(uri: string): boolean {
  try {
    const url = new URL(uri)
    return url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname))
  } catch {
    return false
  }
}

/**
 * Why a redirect URI can't be registered, or null if it can. Allowed: https,
 * http on a loopback host (desktop and CLI clients), and private-use schemes
 * for native apps (RFC 8252). Never fragments.
 */
export function redirectUriProblem(uri: string): string | null {
  if (uri.length > MAX_URI_LENGTH) return 'is too long'
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return 'is not an absolute URL'
  }
  if (url.hash || uri.includes('#')) return 'must not contain a fragment'
  const scheme = url.protocol.slice(0, -1)
  if (scheme === 'https') return url.hostname ? null : 'needs a host'
  if (scheme === 'http') return LOOPBACK_HOSTS.has(url.hostname) ? null : 'must use https unless it is on localhost'
  if (BLOCKED_SCHEMES.has(scheme) || BLOCKED_SCHEME_PREFIXES.some((prefix) => scheme.startsWith(prefix))) {
    return `cannot use the ${scheme}: scheme`
  }
  return /^[a-z][a-z0-9+.-]*$/.test(scheme) ? null : 'has an invalid scheme'
}

export interface Registration {
  client_name: string
  redirect_uris: string[]
  token_endpoint_auth_method: TokenAuthMethod
}

/** Validate an RFC 7591 registration request. */
export function parseRegistration(body: Record<string, unknown>): Registration {
  const uris = body.redirect_uris
  if (!Array.isArray(uris) || uris.length === 0 || !uris.every((u) => typeof u === 'string')) {
    throw new OAuthError('invalid_redirect_uri', 'redirect_uris must be a non-empty array of URLs')
  }
  if (uris.length > MAX_REDIRECT_URIS) {
    throw new OAuthError('invalid_redirect_uri', `At most ${MAX_REDIRECT_URIS} redirect_uris`)
  }
  for (const uri of uris as string[]) {
    const problem = redirectUriProblem(uri)
    if (problem) throw new OAuthError('invalid_redirect_uri', `redirect_uri ${uri.slice(0, 200)} ${problem}`)
  }

  // RFC 7591 §2: the default is client_secret_basic.
  const method = body.token_endpoint_auth_method ?? 'client_secret_basic'
  if (typeof method !== 'string' || !(TOKEN_AUTH_METHODS as readonly string[]).includes(method)) {
    throw new OAuthError(
      'invalid_client_metadata',
      `token_endpoint_auth_method must be one of ${TOKEN_AUTH_METHODS.join(', ')}`,
    )
  }

  const grantTypes = body.grant_types ?? ['authorization_code']
  if (
    !Array.isArray(grantTypes) ||
    !grantTypes.every((g) => g === 'authorization_code' || g === 'refresh_token')
  ) {
    throw new OAuthError('invalid_client_metadata', 'Only the authorization_code and refresh_token grants are supported')
  }
  const responseTypes = body.response_types ?? ['code']
  if (!Array.isArray(responseTypes) || !responseTypes.every((r) => r === 'code')) {
    throw new OAuthError('invalid_client_metadata', 'Only the code response type is supported')
  }

  const rawName = typeof body.client_name === 'string' ? body.client_name : ''
  // Shown on the consent screen: no control characters, bounded length.
  const name = rawName.replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH)

  return {
    client_name: name || 'An unnamed app',
    redirect_uris: uris as string[],
    token_endpoint_auth_method: method as TokenAuthMethod,
  }
}
