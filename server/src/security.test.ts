import { testInvitation } from './test-support.js'
/**
 * Regression tests for the security review (security_best_practices_report.md).
 * Each test is named after the finding it keeps fixed. Like flow.test.ts, they
 * run only when TEST_DATABASE_URL points at a migrated, disposable Postgres.
 */
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { after, before, test } from 'node:test'

const DB = process.env.TEST_DATABASE_URL
const skip = DB ? false : 'set TEST_DATABASE_URL to run'
const REDIRECT = 'https://client.test/cb'
const PASSWORD = 'correct horse battery'

type App = typeof import('./app.js').app
let app: App
let pool: typeof import('./db.js').pool
let tokens: typeof import('./oauth/tokens.js')
let hashToken: (token: string) => string

before(async () => {
  if (!DB) return
  process.env.DATABASE_URL = DB
  process.env.MCP_ENABLED = 'true'
  process.env.APP_URL = 'https://app.test'
  delete process.env.SIGNUP_MODE
  app = (await import('./app.js')).app
  pool = (await import('./db.js')).pool
  tokens = await import('./oauth/tokens.js')
  hashToken = (await import('./auth.js')).hashToken
})

after(async () => {
  if (pool) await pool.end()
})

// ─── Helpers ────────────────────────────────────────────────────────────────

/** A different address for every request, so per-address limits don't couple tests. */
const randomIp = () => `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${(randomBytes(1)[0]! % 250) + 1}`

interface Reply {
  status: number
  data: any
}

async function call(
  method: string,
  path: string,
  options: { body?: unknown; bearer?: string; ip?: string; headers?: Record<string, string> } = {},
): Promise<Reply> {
  const res = await app.request(path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-real-ip': options.ip ?? randomIp(),
      ...(options.bearer ? { authorization: `Bearer ${options.bearer}` } : {}),
      ...options.headers,
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data }
}

const post = (path: string, body?: unknown, bearer?: string, ip?: string) => call('POST', path, { body, bearer, ip })
const get = (path: string, bearer?: string) => call('GET', path, { bearer })

async function signUp(password = PASSWORD) {
  const email = `sec-${randomBytes(6).toString('hex')}@example.com`
  const res = await post('/api/auth/signup', { email, password, name: 'Test', invite_token: await testInvitation(email) })
  assert.equal(res.status, 201)
  return { email, session: res.data.access_token as string, id: res.data.user.id as string }
}

async function register(redirect = REDIRECT) {
  return post('/api/oauth/register', { client_name: 'Test app', redirect_uris: [redirect], token_endpoint_auth_method: 'none' })
}

function authorizeParams(clientId: string, challenge: string, redirect = REDIRECT) {
  return { response_type: 'code', client_id: clientId, redirect_uri: redirect, code_challenge_method: 'S256', code_challenge: challenge, scope: 'read write' }
}

async function authorize(session: string, clientId: string) {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const res = await post('/api/oauth/authorize', { params: authorizeParams(clientId, challenge), decision: 'allow', scopes: ['read', 'write'] }, session)
  assert.equal(res.status, 200)
  return { code: new URL(res.data.redirect_to).searchParams.get('code')!, verifier }
}

const exchange = (clientId: string, grant: { code: string; verifier: string }) =>
  post('/api/oauth/token', { client_id: clientId, grant_type: 'authorization_code', code: grant.code, code_verifier: grant.verifier, redirect_uri: REDIRECT })

async function connect(session: string) {
  const clientId = (await register()).data.client_id as string
  const issued = await exchange(clientId, await authorize(session, clientId))
  assert.equal(issued.status, 200)
  return { clientId, access: issued.data.access_token as string, refresh: issued.data.refresh_token as string }
}

async function resetToken(userId: string) {
  const token = randomBytes(32).toString('base64url')
  await pool.query(
    `insert into auth.password_reset_tokens (token_hash, user_id, expires_at) values ($1, $2, now() + interval '1 hour')`,
    [hashToken(token), userId],
  )
  return token
}

const mcp = (bearer: string, body: unknown) =>
  call('POST', '/api/mcp', { body, bearer, headers: { accept: 'application/json, text/event-stream' } })

// ─── Account recovery and passwords ─────────────────────────────────────────

test('SEC-01: a password reset disconnects AI apps and cancels pending codes', { skip }, async () => {
  const user = await signUp()
  const app1 = await connect(user.session)
  const pending = await authorize(user.session, app1.clientId)

  const reset = await post('/api/auth/reset', { token: await resetToken(user.id), password: 'a brand new password' })
  assert.equal(reset.status, 200)

  assert.equal((await get('/api/auth/user', user.session)).status, 401)
  assert.equal(await tokens.verifyAccessToken(app1.access), null)
  const refreshed = await post('/api/oauth/token', { client_id: app1.clientId, grant_type: 'refresh_token', refresh_token: app1.refresh })
  assert.equal(refreshed.status, 400)
  assert.equal((await exchange(app1.clientId, pending)).status, 400)
})

test('SEC-01: a password change disconnects AI apps and cancels reset links', { skip }, async () => {
  const user = await signUp()
  const app1 = await connect(user.session)
  const link = await resetToken(user.id)

  const changed = await post('/api/auth/password', { current_password: PASSWORD, password: 'a brand new password' }, user.session)
  assert.equal(changed.status, 204)
  assert.equal(await tokens.verifyAccessToken(app1.access), null)
  assert.equal((await post('/api/auth/reset', { token: link, password: 'yet another password' })).status, 400)
  // The session that made the change stays signed in.
  assert.equal((await get('/api/auth/user', user.session)).status, 200)
})

test('SEC-07: changing the password needs the current one', { skip }, async () => {
  const user = await signUp()
  assert.equal((await post('/api/auth/password', { password: 'no current password' }, user.session)).status, 400)
  assert.equal((await post('/api/auth/password', { current_password: 'wrong', password: 'no current password' }, user.session)).status, 400)
  assert.equal((await post('/api/auth/login', { email: user.email, password: PASSWORD })).status, 200)
})

test('SEC-19: password changes are limited per user', { skip }, async () => {
  const user = await signUp()
  let limited = 0
  for (let i = 0; i < 7; i++) {
    const res = await post('/api/auth/password', { current_password: 'wrong', password: 'whatever it is' }, user.session)
    if (res.status === 429) limited++
  }
  assert.equal(limited, 2)
})

test('SEC-19: a made-up reset token is rejected without hashing', { skip }, async () => {
  const started = performance.now()
  for (let i = 0; i < 5; i++) {
    assert.equal((await post('/api/auth/reset', { token: 'made-up', password: 'a perfectly valid password' })).status, 400)
  }
  // Five bcrypt hashes would take over 250 ms.
  assert.ok(performance.now() - started < 150)
})

test('SEC-08: passwords longer than 72 bytes are refused', { skip }, async () => {
  const email = `sec-${randomBytes(6).toString('hex')}@example.com`
  const res = await post('/api/auth/signup', { email, password: 'é'.repeat(36) + 'suffix', name: 'Test' })
  assert.equal(res.status, 400)
})

test('SEC-11: bad logins from one address do not lock the owner out elsewhere', { skip }, async () => {
  const user = await signUp()
  const attacker = randomIp()
  for (let i = 0; i < 10; i++) {
    assert.equal((await post('/api/auth/login', { email: user.email, password: 'wrong' }, undefined, attacker)).status, 400)
  }
  assert.equal((await post('/api/auth/login', { email: user.email, password: PASSWORD }, undefined, attacker)).status, 429)
  assert.equal((await post('/api/auth/login', { email: user.email, password: PASSWORD })).status, 200)
})

test('SEC-12, SEC-17: an oversized email is refused immediately', { skip }, async () => {
  const started = performance.now()
  const hostile = await post('/api/auth/login', { email: 'a@' + 'a.'.repeat(3000) + '\n!', password: 'x' })
  const long = await post('/api/auth/recover', { email: `${'a'.repeat(300)}@example.com` })
  assert.equal(hostile.status, 400)
  assert.equal(long.status, 400)
  assert.ok(performance.now() - started < 100)
  // Bodies far larger than any sign-in form never reach the handler.
  const huge = await post('/api/auth/login', { email: 'a@b.co', password: 'x'.repeat(20_000) })
  assert.equal(huge.status, 413)
})

test('SEC-21: recovery answers the same whether or not the email is registered', { skip }, async () => {
  const user = await signUp()
  const saved = { fetch: globalThis.fetch, key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM, error: console.error }
  process.env.RESEND_API_KEY = 'not-a-real-key'
  process.env.EMAIL_FROM = 'test@example.com'
  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed')
  }) as typeof fetch
  console.error = () => {}
  try {
    assert.equal((await post('/api/auth/recover', { email: user.email })).status, 204)
    assert.equal((await post('/api/auth/recover', { email: `nobody-${randomBytes(4).toString('hex')}@example.com` })).status, 204)
    await new Promise((resolve) => setTimeout(resolve, 100))
  } finally {
    globalThis.fetch = saved.fetch
    console.error = saved.error
    if (saved.key === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = saved.key
    if (saved.from === undefined) delete process.env.EMAIL_FROM
    else process.env.EMAIL_FROM = saved.from
  }
  const { rows } = await pool.query('select 1 from auth.password_reset_tokens where user_id = $1', [user.id])
  assert.equal(rows.length, 1)
})

test('SEC-03, SEC-15: sign-ups can be closed', { skip }, async () => {
  process.env.SIGNUP_MODE = 'closed'
  try {
    const res = await post('/api/auth/signup', { email: `sec-${randomBytes(6).toString('hex')}@example.com`, password: PASSWORD, name: 'x' })
    assert.equal(res.status, 403)
  } finally {
    delete process.env.SIGNUP_MODE
  }
})

test('sessions end 90 days after sign-in', { skip }, async () => {
  const user = await signUp()
  await pool.query(`update auth.sessions set created_at = now() - interval '91 days' where token_hash = $1`, [hashToken(user.session)])
  assert.equal((await get('/api/auth/user', user.session)).status, 401)
})

// ─── OAuth and MCP ──────────────────────────────────────────────────────────

test('SEC-04: a refresh that asks for read gets a token that cannot write', { skip }, async () => {
  const user = await signUp()
  const app1 = await connect(user.session)
  const narrowed = await post('/api/oauth/token', { client_id: app1.clientId, grant_type: 'refresh_token', refresh_token: app1.refresh, scope: 'read' })
  assert.equal(narrowed.status, 200)
  assert.equal(narrowed.data.scope, 'read')
  assert.deepEqual((await tokens.verifyAccessToken(narrowed.data.access_token))?.scopes, ['read'])
  // The connection itself keeps what the user granted.
  const full = await post('/api/oauth/token', { client_id: app1.clientId, grant_type: 'refresh_token', refresh_token: narrowed.data.refresh_token })
  assert.equal(full.data.scope, 'read write')
})

test('SEC-05: junk requests do not use up a public client\'s token allowance', { skip }, async () => {
  const user = await signUp()
  const clientId = (await register()).data.client_id as string
  const grant = await authorize(user.session, clientId)
  for (let i = 0; i < 70; i++) {
    assert.equal((await post('/api/oauth/token', { client_id: clientId, grant_type: 'authorization_code', code: 'junk' })).status, 400)
  }
  assert.equal((await exchange(clientId, grant)).status, 200)
})

test('SEC-10: another client replaying a used code cannot disconnect the app', { skip }, async () => {
  const user = await signUp()
  const clientId = (await register()).data.client_id as string
  const grant = await authorize(user.session, clientId)
  const issued = await exchange(clientId, grant)
  const other = (await register()).data.client_id as string
  assert.equal((await exchange(other, { code: grant.code, verifier: 'not-the-verifier' })).status, 400)
  assert.equal((await exchange(clientId, { code: grant.code, verifier: 'x'.repeat(43) })).status, 400)
  assert.ok(await tokens.verifyAccessToken(issued.data.access_token))
  // The real client replaying with the real verifier still ends the connection.
  assert.equal((await exchange(clientId, grant)).status, 400)
  assert.equal(await tokens.verifyAccessToken(issued.data.access_token), null)
})

test('SEC-16: MCP accepts one message per request', { skip }, async () => {
  const user = await signUp()
  const app1 = await connect(user.session)
  const one = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_profile', arguments: {} } }
  const single = await mcp(app1.access, one)
  assert.equal(single.status, 200)
  assert.notEqual(single.data.result.isError, true)
  assert.equal((await mcp(app1.access, [one, { ...one, id: 2 }])).status, 400)
})

test('SEC-22: device-action redirects are refused and Cancel never leaves for a custom scheme', { skip }, async () => {
  for (const uri of ['tel:+15555550100', 'sms:+15555550100', 'shortcuts://run-shortcut?name=x', 'ms-settings:privacy', 'javascript:alert(1)']) {
    assert.equal((await register(uri)).status, 400, uri)
  }
  const user = await signUp()
  const custom = 'com.example.app:/callback'
  const clientId = (await register(custom)).data.client_id as string
  const params = authorizeParams(clientId, 'A'.repeat(43), custom)
  const denied = await post('/api/oauth/authorize', { params, decision: 'deny' }, user.session)
  assert.equal(denied.data.redirect_to, null)
  const allowed = await post('/api/oauth/authorize', { params, decision: 'allow', scopes: ['read'] }, user.session)
  assert.ok(allowed.data.redirect_to.startsWith(custom))
  // A web redirect still hears about the refusal, as OAuth expects.
  const web = (await register()).data.client_id as string
  const deniedWeb = await post('/api/oauth/authorize', { params: authorizeParams(web, 'A'.repeat(43)), decision: 'deny' }, user.session)
  assert.ok(deniedWeb.data.redirect_to.startsWith(REDIRECT))
})

test('SEC-23: the token endpoint is limited per address before any lookup', { skip }, async () => {
  const ip = randomIp()
  let limited = 0
  for (let i = 0; i < 125; i++) {
    const res = await post('/api/oauth/token', { client_id: 'oza_cid_unknown', grant_type: 'refresh_token', refresh_token: 'x' }, undefined, ip)
    if (res.status === 429) limited++
  }
  assert.equal(limited, 5)
})

// ─── Stored data ────────────────────────────────────────────────────────────

test('SEC-03, SEC-18: over-long and wrongly typed fields are refused', { skip }, async () => {
  const user = await signUp()
  const s = user.session
  assert.equal((await post('/api/grocery-items', { name: 'x'.repeat(201), category: 'other' }, s)).status, 400)
  assert.equal((await post('/api/calorie-logs', { food_name: 'x', calories: '12', meal_type: 'lunch' }, s)).status, 400)
  assert.equal((await post('/api/calorie-logs', { food_name: { a: 1 }, calories: 12, meal_type: 'lunch' }, s)).status, 400)
  assert.equal((await call('PATCH', '/api/profile', { body: { name: 'x'.repeat(201) }, bearer: s })).status, 400)
  const plan = await post('/api/workout-plans', { name: 'p', workout_type: 'push', planned_date: '2030-01-01', notes: 'n'.repeat(2001) }, s)
  assert.equal(plan.status, 400)
  const exercise = await post('/api/workout-plans', { name: 'p', workout_type: 'push', planned_date: '2030-01-01', exercises: [{ exercise_name: 'x'.repeat(201) }] }, s)
  assert.equal(exercise.status, 400)
  // Ordinary writes still work.
  assert.equal((await post('/api/grocery-items', { name: 'Eggs', category: 'dairy' }, s)).status, 201)
  assert.equal((await post('/api/calorie-logs', { food_name: 'Toast', calories: 120, meal_type: 'breakfast' }, s)).status, 201)
  // The database refuses what the API would have, should a path skip the check.
  await assert.rejects(
    pool.query(`insert into public.grocery_items (user_id, name, category) values ($1, $2, 'other')`, [user.id, 'x'.repeat(301)]),
    /grocery_items_name_length/,
  )
})

test('SEC-06: rows cannot link to another user\'s plan, and the error does not say why', { skip }, async () => {
  const owner = await signUp()
  const other = await signUp()
  const meal = await post('/api/meal-plans', { name: 'Dinner', planned_date: '2030-01-01', meal_type: 'dinner', calories: 500 }, owner.session)
  const plan = await post('/api/workout-plans', { name: 'Push', workout_type: 'push', planned_date: '2030-01-01' }, owner.session)
  const foreign = await post('/api/grocery-items', { name: 'x', category: 'other', meal_plan_id: meal.data.id }, other.session)
  const missing = await post('/api/grocery-items', { name: 'x', category: 'other', meal_plan_id: '00000000-0000-4000-8000-000000000001' }, other.session)
  assert.equal(foreign.status, 400)
  assert.deepEqual(foreign.data, missing.data)
  assert.equal((await post('/api/workout-sessions', { name: 's', workout_type: 'push', plan_id: plan.data.id }, other.session)).status, 400)
  // The owner's own links still work, and deleting the plan clears them.
  assert.equal((await post('/api/grocery-items', { name: 'x', category: 'other', meal_plan_id: meal.data.id }, owner.session)).status, 201)
  assert.equal((await call('DELETE', `/api/meal-plans/${meal.data.id}`, { bearer: owner.session })).status, 204)
  assert.equal((await get('/api/grocery-items', owner.session)).data[0].meal_plan_id, null)
})

test('SEC-20: database errors reach the client as fixed messages', { skip }, async () => {
  const user = await signUp()
  const warn = console.warn
  console.warn = () => {}
  try {
    // weight_kg = 0 passes the API's range check and trips the table's check constraint.
    const res = await post('/api/weight-logs', { weight_kg: 0 }, user.session)
    assert.equal(res.status, 400)
    assert.doesNotMatch(res.data.error, /constraint|relation|weight_logs|syntax|"/)
  } finally {
    console.warn = warn
  }
})

test('SEC-23: API responses are not cacheable and the health check answers', { skip }, async () => {
  const res = await app.request('/api/health')
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('cache-control'), 'no-store')
})
