/** Local-only reproductions for SEC-16 onward; asserts the reviewed vulnerable behavior.
 * From repo root:
 *   node --expose-gc --import ./server/node_modules/tsx/dist/loader.mjs docs/security/reproduce-additional.mts
 * Requires SECURITY_TEST_DATABASE_URL targeting a disposable migrated local DB named ozempic_security.
 * Sends no email (fetch is stubbed) and makes no model calls. Never point this at a real account database.
 * Every test is bounded: small request counts and sizes, measured and extrapolated rather than run to failure.
 */
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'

const url = new URL(process.env.SECURITY_TEST_DATABASE_URL ?? 'postgres://audit@127.0.0.1:55440/ozempic_security')
assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.pathname === '/ozempic_security')
process.env.DATABASE_URL = url.toString()
process.env.MCP_ENABLED = 'true'
process.env.APP_URL = 'https://app.test'
delete process.env.RESEND_API_KEY
delete process.env.ANTHROPIC_API_KEY

// Keep the request log out of the output; the harness prints its own results.
const realLog = console.log
const logged: string[] = []
console.log = (...args: unknown[]) => { logged.push(args.join(' ')) }
const say = (s: string) => realLog(s)

const { app } = await import('../../server/src/app.js')
const { pool } = await import('../../server/src/db.js')

const suffix = randomBytes(8).toString('hex')
const results: string[] = []
const pass = (s: string) => { results.push(s); say(`REPRODUCED: ${s}`) }
const checked = (s: string) => say(`CONTROL HELD: ${s}`)
let ipCounter = 0
const freshIp = () => `198.51.100.${(ipCounter++ % 250) + 1}-${ipCounter}`

async function raw(path: string, init: RequestInit) {
  const res = await app.request(path, init)
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, data, bytes: Buffer.byteLength(text) }
}
function request(path: string, body?: unknown, bearer?: string, extra: Record<string, string> = {}, method = 'POST') {
  return raw(`/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-real-ip': freshIp(), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
async function signup(label: string) {
  const email = `${label}-${suffix}@example.invalid`
  const r = await request('/auth/signup', { email, password: 'Synthetic password only!', name: label })
  assert.equal(r.status, 201)
  return { token: r.data.access_token as string, email }
}
async function register(redirect = 'https://client.test/cb') {
  const r = await request('/oauth/register', { client_name: 'Synthetic audit', redirect_uris: [redirect], token_endpoint_auth_method: 'none' })
  return r
}
async function connect(session: string, scopes: string[]) {
  const reg = await register()
  assert.equal(reg.status, 201)
  const clientId = reg.data.client_id as string
  const verifier = randomBytes(32).toString('base64url')
  const a = await request('/oauth/authorize', {
    params: { response_type: 'code', client_id: clientId, redirect_uri: 'https://client.test/cb', code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url'), scope: 'read write' },
    decision: 'allow', scopes,
  }, session)
  assert.equal(a.status, 200)
  const code = new URL(a.data.redirect_to).searchParams.get('code')
  const t = await request('/oauth/token', { client_id: clientId, grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: 'https://client.test/cb' })
  assert.equal(t.status, 200)
  return t.data.access_token as string
}
function mcp(token: string, payload: unknown) {
  return raw('/api/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
}
const call = (id: number, name: string, args: unknown) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } })
const heapMb = () => { (globalThis as any).gc?.(); return process.memoryUsage().heapUsed / 1e6 }
const ms = async (fn: () => Promise<unknown>) => { const t = performance.now(); await fn(); return Math.round(performance.now() - t) }

try {
  const alice = await signup('alice2')
  const bob = await signup('bob2')

  // ── SEC-16: one MCP HTTP request carries a JSON-RPC batch; the per-connection limit counts requests, not calls.
  {
    const token = await connect(alice.token, ['read', 'write'])
    const batch = Array.from({ length: 100 }, (_, i) => call(i + 1, 'get_profile', {}))
    let ok = 0
    for (let i = 0; i < 2; i++) {
      const r = await mcp(token, batch)
      assert.equal(r.status, 200)
      assert(Array.isArray(r.data))
      ok += r.data.filter((m: any) => m.result && !m.result.isError).length
    }
    assert.equal(ok, 200) // 200 tool calls > the 120-per-15-minutes limit, using 2 of 120 requests
    const baseline = await ms(() => raw('/api/health', { method: 'GET' }))
    let during = 0
    const flood = Promise.all(Array.from({ length: 6 }, () => mcp(token, batch)))
    await new Promise((r) => setTimeout(r, 5))
    during = await ms(() => raw('/api/health', { method: 'GET' }))
    const floodResults = await flood
    assert(floodResults.every((r) => r.status === 200))
    say(`Health check latency: ${baseline} ms idle, ${during} ms while 6 batched MCP requests (600 tool calls) were in flight`)
    pass('SEC-16: 2 MCP requests ran 200 tool calls (limit is 120 requests/15 min); 8 requests ran 800 without a 429')

    // Control: the write limit is counted per tool call, so batching does not bypass it.
    const writes = Array.from({ length: 60 }, (_, i) => call(i + 1, 'add_grocery_items', { items: [{ name: `audit item ${suffix} ${i}`, category: 'other' }] }))
    const w = await mcp(token, writes)
    const accepted = w.data.filter((m: any) => m.result && !m.result.isError).length
    assert.equal(accepted, 40)
    checked('batched MCP writes are still capped at 40 per 15 minutes')

    // Control: a connected app cannot edit another user's workout plan by id.
    const plan = await request('/workout-plans', { name: 'Bob private plan', workout_type: 'push', planned_date: '2030-01-07', notes: 'private' }, bob.token)
    assert.equal(plan.status, 201)
    const workout = { name: 'Taken over', workout_type: 'push', planned_date: '2030-01-07', notes: '', exercises: [] }
    const cross = await mcp(token, call(1, 'update_workout_plan', { plan_id: plan.data.id, unit_system: 'metric', workout }))
    assert.equal(cross.data.result.isError, true)
    const still = await request('/workout-plans', undefined, bob.token, {}, 'GET')
    assert.equal(still.data[0].name, 'Bob private plan')
    checked("Alice's MCP connection cannot read or edit Bob's workout plan by id")
  }

  // ── SEC-17: rate-limit keys are built from unbounded request input and kept in memory for the whole window.
  {
    const before = heapMb()
    const n = 60
    const size = 200_000
    for (let i = 0; i < n; i++) {
      const email = `${'a'.repeat(size)}${i}-${suffix}@example.invalid`
      const login = await request('/auth/login', { email, password: 'x' })
      assert.equal(login.status, 400)
      const recover = await request('/auth/recover', { email })
      assert.equal(recover.status, 204)
    }
    const grown = heapMb() - before
    say(`Limiter memory: ${n * 2} requests with ${size / 1000} KB emails left ${grown.toFixed(1)} MB retained after GC (${(grown / (n * 2) * 1000).toFixed(0)} KB per request)`)
    assert(grown > 15)
    pass('SEC-17: oversized emails become long-lived rate-limit keys; retained heap grows by roughly the email size per request')
  }

  // ── SEC-18: list endpoints multiply unbounded stored fields by a row limit of up to 2,000.
  {
    const rows = 8
    const name = 'x'.repeat(250_000)
    for (let i = 0; i < rows; i++) {
      const r = await request('/grocery-items', { name, category: 'other' }, bob.token)
      assert.equal(r.status, 201)
    }
    const list = await request('/grocery-items?limit=2000', undefined, bob.token, {}, 'GET')
    assert.equal(list.status, 200)
    const perRow = list.bytes / rows
    say(`List amplification: ${rows} stored rows returned ${(list.bytes / 1e6).toFixed(1)} MB in one response; at the 2,000-row limit that is about ${(perRow * 2000 / 1e6).toFixed(0)} MB per GET`)
    assert(list.bytes > rows * 240_000)
    const token = await connect(bob.token, ['read'])
    const viaMcp = await mcp(token, call(1, 'get_grocery_list', { include_purchased: true }))
    say(`Same rows through the MCP get_grocery_list tool: ${(viaMcp.bytes / 1e6).toFixed(1)} MB (tool returns up to 300 rows)`)
    assert(viaMcp.bytes > rows * 240_000)
    pass('SEC-18: a few stored rows produce multi-megabyte responses; the row limits allow hundreds of megabytes per request')
    await pool.query(`delete from public.grocery_items where length(name) > 100000`)
  }

  // ── SEC-19: password hashing runs before the cheap checks, and the signed-in password route has no throttle.
  {
    const cheap = await ms(async () => { for (let i = 0; i < 5; i++) assert.equal((await request('/auth/reset', { token: 'bogus', password: 'short' })).status, 400) })
    const costly = await ms(async () => { for (let i = 0; i < 5; i++) assert.equal((await request('/auth/reset', { token: 'bogus', password: 'A valid length password' })).status, 400) })
    say(`Reset with an invalid token: ${Math.round(cheap / 5)} ms when the password is too short, ${Math.round(costly / 5)} ms when it is valid (bcrypt runs before the token is checked)`)
    assert(costly > cheap * 3)
    const carol = await signup('carol2')
    let changed = 0
    const spent = await ms(async () => {
      for (let i = 0; i < 25; i++) if ((await request('/auth/password', { password: `Synthetic password ${i}` }, carol.token)).status === 204) changed++
    })
    assert.equal(changed, 25)
    say(`Password change: 25 of 25 back-to-back requests accepted, ${Math.round(spent / 25)} ms of hashing each`)
    pass('SEC-19: bogus reset tokens still cost a bcrypt hash; password change accepts unlimited requests')
  }

  // ── SEC-20: raw PostgreSQL error text reaches the client.
  {
    const check = await request('/calorie-logs', { food_name: 'x', calories: -5, meal_type: 'lunch' }, bob.token)
    const cast = await request('/grocery-items', { name: 'x', category: 'other', meal_plan_id: 'not-a-uuid' }, bob.token)
    const fk = await request('/grocery-items', { name: 'x', category: 'other', meal_plan_id: '00000000-0000-4000-8000-000000000000' }, bob.token)
    say(`Database messages returned: ${JSON.stringify([check.data.error, cast.data.error, fk.data.error])}`)
    assert.match(check.data.error, /check constraint "calorie_logs_calories_positive"/)
    assert.match(cast.data.error, /invalid input syntax for type uuid/)
    assert.match(fk.data.error, /foreign key constraint "/)
    pass('SEC-20: constraint, table and type names from PostgreSQL are returned verbatim in API errors')
  }

  // ── SEC-21: the "always 204" recovery endpoint behaves differently for registered addresses.
  {
    process.env.RESEND_API_KEY = 'synthetic-not-a-key'
    process.env.EMAIL_FROM = 'audit@example.invalid'
    const realFetch = globalThis.fetch
    try {
      globalThis.fetch = (async () => { throw new TypeError('fetch failed') }) as typeof fetch
      const realError = console.error
      console.error = () => {}
      const known = await request('/auth/recover', { email: alice.email })
      console.error = realError
      const unknown = await request('/auth/recover', { email: `nobody-${suffix}@example.invalid` })
      assert.equal(known.status, 500)
      assert.equal(unknown.status, 204)
      globalThis.fetch = (async () => { await new Promise((r) => setTimeout(r, 300)); return new Response('{}', { status: 200 }) }) as typeof fetch
      const tKnown = await ms(() => request('/auth/recover', { email: bob.email }))
      const tUnknown = await ms(() => request('/auth/recover', { email: `nobody2-${suffix}@example.invalid` }))
      say(`Recovery timing with a 300 ms simulated email provider: ${tKnown} ms for a registered address, ${tUnknown} ms for an unknown one`)
      assert(tKnown > tUnknown + 200)
    } finally {
      globalThis.fetch = realFetch
      delete process.env.RESEND_API_KEY
      delete process.env.EMAIL_FROM
    }
    pass('SEC-21: recovery returns 500 (provider outage) or responds late (normal) only for registered emails')
  }

  // ── SEC-22: Deny and "Return to app" navigate to whatever scheme an anonymous registration chose.
  {
    const accepted: string[] = []
    for (const uri of ['tel:+15555550100', 'sms:+15555550100', 'shortcuts://run-shortcut?name=audit', 'intent://scan/#Intent;scheme=zxing;end', 'ms-settings:privacy']) {
      const r = await register(uri)
      if (r.status === 201) accepted.push(uri)
    }
    say(`Redirect schemes accepted at registration: ${JSON.stringify(accepted)}`)
    assert(accepted.includes('tel:+15555550100') && accepted.includes('shortcuts://run-shortcut?name=audit'))
    const reg = await register('tel:+15555550100')
    const deny = await request('/oauth/authorize', {
      params: { response_type: 'code', client_id: reg.data.client_id, redirect_uri: 'tel:+15555550100', code_challenge_method: 'S256', code_challenge: 'A'.repeat(43) },
      decision: 'deny',
    }, alice.token)
    assert.equal(deny.status, 200)
    assert(deny.data.redirect_to.startsWith('tel:+15555550100'))
    const blocked = await register('javascript:alert(1)')
    assert.equal(blocked.status, 400)
    checked('a javascript: redirect URI is rejected at registration')
    pass('SEC-22: the consent screen Deny button receives an attacker-registered tel: URL to navigate to')
  }

  // ── SEC-23: no throttle runs before client authentication on the token endpoint, and requests are logged with query strings.
  {
    let unauthorized = 0
    for (let i = 0; i < 150; i++) {
      const r = await request('/oauth/token', { client_id: `oza_cid_${randomBytes(8).toString('hex')}`, grant_type: 'refresh_token', refresh_token: 'x' }, undefined, { 'x-real-ip': '203.0.113.9' })
      if (r.status === 401) unauthorized++
    }
    assert.equal(unauthorized, 150)
    logged.length = 0
    await request('/analytics?start=2026-01-01&end=2026-01-31&timezone=America/New_York', undefined, bob.token, {}, 'GET')
    assert(logged.some((line) => line.includes('start=2026-01-01')))
    pass('SEC-23: 150 token requests from one address were all processed (one database lookup each, never 429); request logs include full query strings')
  }

  say(`${results.length} additional reproductions passed. All data is synthetic.`)
} finally {
  await pool.end()
}
