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
