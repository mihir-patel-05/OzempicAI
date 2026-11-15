import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { isOurResource, parseScopes, resourceUrl } from './config.js'
import { isValidCodeChallenge, newSecret, safeEqual, verifyPkce } from './crypto.js'

process.env.APP_URL = 'https://app.example.com/'

test('resourceUrl and isOurResource use APP_URL without its trailing slash', () => {
  assert.equal(resourceUrl(), 'https://app.example.com/api/mcp')
  assert.ok(isOurResource('https://app.example.com/api/mcp'))
  assert.ok(isOurResource('https://app.example.com/api/mcp/'))
  assert.ok(!isOurResource('https://evil.example.com/api/mcp'))
  assert.ok(!isOurResource('https://app.example.com/api'))
})

test('parseScopes defaults to every scope and rejects unknown ones', () => {
  assert.deepEqual(parseScopes(undefined), ['read', 'write'])
  assert.deepEqual(parseScopes(''), ['read', 'write'])
  assert.deepEqual(parseScopes('read'), ['read'])
  assert.deepEqual(parseScopes('write  read'), ['read', 'write'])
  assert.equal(parseScopes('read admin'), null)
})

test('verifyPkce accepts the matching S256 verifier only', () => {
  const verifier = 'a'.repeat(20) + '-._~' + 'Z9'.repeat(10)
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  assert.ok(isValidCodeChallenge(challenge))
  assert.ok(verifyPkce(verifier, challenge))
  assert.ok(!verifyPkce(verifier + 'x', challenge))
  assert.ok(!verifyPkce('short', createHash('sha256').update('short').digest('base64url')))
  assert.ok(!isValidCodeChallenge('plain-text-challenge'))
})

test('newSecret is prefixed and random; safeEqual compares exactly', () => {
  const a = newSecret('oza_at')
  const b = newSecret('oza_at')
  assert.match(a, /^oza_at_[A-Za-z0-9_-]{43}$/)
  assert.notEqual(a, b)
  assert.ok(safeEqual(a, a))
  assert.ok(!safeEqual(a, b))
  assert.ok(!safeEqual(a, a.slice(1)))
})

test('discovery documents point clients at our endpoints and require S256', async () => {
  const { authorizationServerMetadata, protectedResourceMetadata } = await import('./metadata.js')
  const resource = protectedResourceMetadata()
  assert.equal(resource.resource, 'https://app.example.com/api/mcp')
  assert.deepEqual(resource.authorization_servers, ['https://app.example.com'])

  const server = authorizationServerMetadata()
  assert.equal(server.issuer, 'https://app.example.com')
  assert.equal(server.authorization_endpoint, 'https://app.example.com/oauth/authorize')
  assert.equal(server.token_endpoint, 'https://app.example.com/api/oauth/token')
  assert.equal(server.registration_endpoint, 'https://app.example.com/api/oauth/register')
  assert.deepEqual(server.code_challenge_methods_supported, ['S256'])
  assert.ok(!server.grant_types_supported.includes('implicit'))
})

test('redirectUriProblem allows https, loopback http and app schemes only', async () => {
  const { redirectUriProblem } = await import('./registration.js')
  assert.equal(redirectUriProblem('https://claude.ai/api/mcp/auth_callback'), null)
  assert.equal(redirectUriProblem('http://localhost:6274/oauth/callback'), null)
  assert.equal(redirectUriProblem('http://127.0.0.1:33418/callback'), null)
  assert.equal(redirectUriProblem('cursor://anysphere.cursor-retrieval/oauth/callback'), null)
  assert.match(redirectUriProblem('http://example.com/cb')!, /https/)
  assert.match(redirectUriProblem('https://claude.ai/cb#frag')!, /fragment/)
  assert.match(redirectUriProblem('javascript:alert(1)')!, /javascript/)
  assert.match(redirectUriProblem('data:text/html,hi')!, /data/)
  assert.match(redirectUriProblem('/relative')!, /absolute/)
})

test('parseRegistration validates RFC 7591 requests', async () => {
  const { parseRegistration } = await import('./registration.js')
  const ok = parseRegistration({
    client_name: '  Claude\u0000‮ ',
    redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  })
  assert.deepEqual(ok, {
    client_name: 'Claude',
    redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
    token_endpoint_auth_method: 'none',
  })
  // RFC 7591's default auth method, and a fallback name.
  const defaults = parseRegistration({ redirect_uris: ['https://x.example/cb'] })
  assert.equal(defaults.token_endpoint_auth_method, 'client_secret_basic')
  assert.equal(defaults.client_name, 'An unnamed app')

  const bad = (body: Record<string, unknown>) => {
    try {
      parseRegistration(body)
      return null
    } catch (err) {
      return (err as { error: string }).error
    }
  }
  assert.equal(bad({}), 'invalid_redirect_uri')
  assert.equal(bad({ redirect_uris: ['http://evil.example/cb'] }), 'invalid_redirect_uri')
  assert.equal(bad({ redirect_uris: ['https://x.example/cb'], grant_types: ['implicit'] }), 'invalid_client_metadata')
  assert.equal(bad({ redirect_uris: ['https://x.example/cb'], token_endpoint_auth_method: 'private_key_jwt' }), 'invalid_client_metadata')
})
