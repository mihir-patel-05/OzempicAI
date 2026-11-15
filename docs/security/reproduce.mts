/** Local-only vulnerability reproductions; asserts the reviewed vulnerable behavior.
 * From repo root: node --import ./server/node_modules/tsx/dist/loader.mjs docs/security/reproduce.mts
 * Requires SECURITY_TEST_DATABASE_URL targeting a disposable migrated local DB named ozempic_security.
 * Does not call email or model services. Never point this at a real account database.
 */
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'

const url = new URL(process.env.SECURITY_TEST_DATABASE_URL ?? 'postgres://audit@127.0.0.1:55439/ozempic_security')
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.pathname === '/ozempic_security')
process.env.DATABASE_URL = url.toString()
process.env.MCP_ENABLED = 'true'
process.env.APP_URL = 'https://app.test'
delete process.env.RESEND_API_KEY
delete process.env.ANTHROPIC_API_KEY
const { app } = await import('../../server/src/app.js')
const { pool } = await import('../../server/src/db.js')
const { hashToken } = await import('../../server/src/auth.js')
const { verifyAccessToken } = await import('../../server/src/oauth/tokens.js')
const suffix = randomBytes(8).toString('hex')
const results: string[] = []
const pass = (s: string) => { results.push(s); console.log(`REPRODUCED: ${s}`) }
async function request(path: string, body?: unknown, bearer?: string, extra = {}, method = 'POST') {
  const res = await app.request(`/api${path}`, {
    method, headers: { 'content-type': 'application/json', ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}
async function signup(label: string, password = 'Synthetic password only!') {
  const r = await request('/auth/signup', { email: `${label}-${suffix}@example.invalid`, password, name: label })
  assert.equal(r.status, 201)
  return r.data
}
async function registration() {
  const r = await request('/oauth/register', { client_name: 'Synthetic audit', redirect_uris: ['https://client.test/cb'], token_endpoint_auth_method: 'none' })
  assert.equal(r.status, 201)
  return r.data.client_id as string
}
async function authorization(session: string, clientId: string) {
  const verifier = randomBytes(32).toString('base64url')
  const r = await request('/oauth/authorize', {
    params: { response_type: 'code', client_id: clientId, redirect_uri: 'https://client.test/cb', code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url'), scope: 'read write' },
    decision: 'allow', scopes: ['read', 'write'],
  }, session)
  assert.equal(r.status, 200)
  return { code: new URL(r.data.redirect_to).searchParams.get('code'), verifier }
}
async function exchange(clientId: string, a: { code: string | null; verifier: string }) {
  return request('/oauth/token', { client_id: clientId, grant_type: 'authorization_code', code: a.code, code_verifier: a.verifier, redirect_uri: 'https://client.test/cb' })
}
try {
  const alice = await signup('alice')
  const bob = await signup('bob')
  const clientId = await registration()
  const firstCode = await authorization(alice.access_token, clientId)
  const issued = await exchange(clientId, firstCode)
  assert.equal(issued.status, 200)
  const pendingCode = await authorization(alice.access_token, clientId)

  // Synthetic stand-in for a reset link delivered to the legitimate mailbox.
  const reset = randomBytes(32).toString('base64url')
  await pool.query("insert into auth.password_reset_tokens (token_hash,user_id,expires_at) values ($1,$2,now()+interval '1 hour')", [hashToken(reset), alice.user.id])
  const recovered = await request('/auth/reset', { token: reset, password: 'Recovered synthetic password!' })
  assert.equal(recovered.status, 200)
  assert.equal((await request('/auth/user', undefined, alice.access_token, {}, 'GET')).status, 401)
  assert(await verifyAccessToken(issued.data.access_token))
  const refreshed = await request('/oauth/token', { client_id: clientId, grant_type: 'refresh_token', refresh_token: issued.data.refresh_token })
  assert.equal(refreshed.status, 200)
  assert.equal((await exchange(clientId, pendingCode)).status, 200)
  pass('SEC-01: reset revokes web session but access token, refresh token and pending authorization code survive')

  const down = await request('/oauth/token', { client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshed.data.refresh_token, scope: 'read' })
  assert.equal(down.status, 200)
  assert.equal(down.data.scope, 'read write')
  assert((await verifyAccessToken(down.data.access_token))?.scopes.includes('write'))
  pass('SEC-04: scope=read refresh returns an access token with write scope')

  const otherClient = await registration()
  assert.equal((await exchange(otherClient, { code: firstCode.code, verifier: 'not-the-verifier' })).status, 400)
  assert.equal(await verifyAccessToken(down.data.access_token), null)
  pass('SEC-10: another registered client with a used code revokes its grant without valid PKCE')

  let last = 0
  for (let i = 0; i < 21; i++) last = (await request('/auth/signup', {}, undefined, { 'x-real-ip': `fixed-${suffix}` })).status
  assert.equal(last, 429)
  for (let i = 0; i < 21; i++) assert.equal((await request('/auth/signup', {}, undefined, { 'x-real-ip': `rotated-${suffix}-${i}` })).status, 400)
  pass('SEC-02: rotating X-Real-IP bypasses the 20-attempt signup rate limit')

  const sharedClient = await registration()
  const validCode = await authorization(bob.access_token, sharedClient)
  for (let i = 0; i < 60; i++) assert.equal((await request('/oauth/token', { client_id: sharedClient, grant_type: 'authorization_code', code: 'invalid' })).status, 400)
  assert.equal((await exchange(sharedClient, validCode)).status, 429)
  pass('SEC-05: 60 invalid unauthenticated requests block a valid public-client token exchange')

  const meal = await request('/meal-plans', { name: 'Private meal', planned_date: '2026-11-15', meal_type: 'dinner', calories: 500 }, recovered.data.access_token)
  assert.equal(meal.status, 201)
  const linked = await request('/grocery-items', { name: 'Test reference', category: 'other', meal_plan_id: meal.data.id }, bob.access_token)
  assert.equal(linked.status, 201)
  const nonexistent = await request('/grocery-items', { name: 'Missing reference', category: 'other', meal_plan_id: '00000000-0000-0000-0000-000000000001' }, bob.access_token)
  assert.equal(nonexistent.status, 400)
  const plan = await request('/workout-plans', { name: 'Private workout', workout_type: 'other', planned_date: '2026-11-15' }, recovered.data.access_token)
  assert.equal(plan.status, 201)
  assert.equal((await request('/workout-sessions', { name: 'Foreign reference', workout_type: 'other', plan_id: plan.data.id }, bob.access_token)).status, 201)
  assert.equal((await request('/meal-plans', undefined, bob.access_token, {}, 'GET')).data.length, 0)
  pass('SEC-06: foreign meal/workout IDs accepted, nonexistent IDs rejected; direct row reads remain isolated')

  const unicodePassword = 'é'.repeat(36) + 'secret-suffix'
  const unicode = await signup('unicode', unicodePassword)
  assert.equal((await request('/auth/login', { email: unicode.user.email, password: 'é'.repeat(36) + 'wrong-suffix' })).status, 200)
  pass('SEC-08: different Unicode password suffix authenticates because bcrypt truncates at 72 bytes')

  assert.equal((await request('/auth/password', { password: 'Changed without old password!' }, bob.access_token)).status, 204)
  pass('SEC-07: bearer session alone changes password without old password or fresh verification')

  const longName = 'x'.repeat(200_000)
  const large = await request('/grocery-items', { name: longName, category: 'other' }, bob.access_token)
  assert.equal(large.status, 201)
  assert.equal(large.data.name.length, 200_000)
  pass('SEC-03: ordinary REST write persists a 200 KB item name without field limit')

  const lockout = await signup('lockout')
  for (let i = 0; i < 10; i++) assert.equal((await request('/auth/login', { email: lockout.user.email, password: 'incorrect' }, undefined, { 'x-real-ip': `lock-${suffix}` })).status, 400)
  assert.equal((await request('/auth/login', { email: lockout.user.email, password: 'Synthetic password only!' }, undefined, { 'x-real-ip': `victim-${suffix}` })).status, 429)
  pass('SEC-11: ten bad logins block the correct password from a different IP')
  const timings = []
  for (const n of [5_000, 15_000, 30_000]) {
    const email = 'a@' + 'a.'.repeat(n) + '\n!'
    const start = performance.now()
    const r = await request('/auth/signup', { email, password: 'Synthetic password!' }, undefined, { 'x-real-ip': `regex-${suffix}` })
    assert.equal(r.status, 400)
    timings.push({ emailBytes: Buffer.byteLength(email), milliseconds: Math.round(performance.now() - start) })
  }
  console.log('Email validation timings:', JSON.stringify(timings))
  pass('SEC-12: bounded malicious email inputs exercise superlinear synchronous validation on signup')
  console.log(`\n${results.length} focused reproductions passed. All data is synthetic.`)
} finally {
  await pool.end()
}
