import { testInvitation } from './test-support.js'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'

const database = process.env.TEST_DATABASE_URL
let app: typeof import('./app.js').app
let pool: typeof import('./db.js').pool
let getClient: typeof import('./ai/client.js').getClient
before(async () => {
  if (!database) return
  process.env.DATABASE_URL = database
  process.env.SIGNUP_MODE = 'open'
  process.env.ANTHROPIC_API_KEY = 'synthetic-test-key'
  process.env.AI_MAX_CONCURRENT_TURNS = '3'
  app = (await import('./app.js')).app
  ;({ pool } = await import('./db.js'))
  ;({ getClient } = await import('./ai/client.js'))
})
after(async () => { if (pool) await pool.end() })

test('AI slots cover pending database work, enforce global/user caps and release on errors', { skip: !database, timeout: 15_000 }, async (t) => {
  const call = (path: string, token: string, body: unknown) => app.request(`/api/${path}`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const users: { access_token: string; user: { id: string } }[] = []
  for (let i = 0; i < 2; i++) {
    const email = `admission-${randomUUID()}@example.test`
    const res = await app.request('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'test password', invite_token: await testInvitation(email) }) })
    assert.equal(res.status, 201)
    users.push(await res.json() as typeof users[number])
  }
  let finish!: () => void
  const done = new Promise<void>(r => { finish = r })
  let entered = 0
  let firstEntered!: () => void
  const first = new Promise<void>(r => { firstEntered = r })
  const mock = t.mock.method(getClient().beta.messages, 'stream', () => {
    entered++
    firstEntered()
    return { on() {}, async finalMessage() {
      await done
      return { model: 'mock', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Test' }], usage: { input_tokens: 1, output_tokens: 1 } }
    } }
  })
  const blocker = await pool.connect()
  await blocker.query('begin')
  await blocker.query('select id from public.users where id=$1 for update', [users[0]!.user.id])
  const requests: Promise<Response>[] = []
  try {
    // With setup blocked, the third request still must be refused.
    for (let i = 0; i < 3; i++) requests.push(call('ai/chat', users[0]!.access_token, { message: 'Test', timezone: 'UTC' }))
    const refused = await Promise.race(requests.map(async r => {
      const res = await r
      if (res.status !== 409) return new Promise<Response>(() => {})
      return res
    }))
    assert.equal(refused.status, 409)
    const other = call('ai/chat', users[1]!.access_token, { message: 'Test' })
    requests.push(other)
    await first
    assert.equal((await call('ai/chat', users[1]!.access_token, { message: 'Test' })).status, 503)
    await blocker.query('commit')
    finish()
    const responses = await Promise.all(requests)
    await Promise.all(responses.map(r => r.text()))
    assert.equal(entered, 3)
    // Repeated setup errors cannot strand slots or conversation locks.
    const missing = randomUUID()
    for (let i = 0; i < 3; i++) assert.equal((await call('ai/chat', users[0]!.access_token, { message: 'Test', conversation_id: missing })).status, 404)
    const retry = await call('ai/chat', users[0]!.access_token, { message: 'Test' })
    assert.equal(retry.status, 200)
    await retry.text()
  } finally {
    await blocker.query('rollback')
    blocker.release()
    finish()
    await Promise.all(requests.map(async r => { const res = await r; if (!res.bodyUsed) await res.text() }))
    mock.mock.restore()
    await pool.query('delete from auth.users where id=any($1::uuid[])', [users.map(u => u.user.id)])
  }
})
