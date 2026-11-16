// Run from the repository root with a migrated, disposable TEST_DATABASE_URL:
// node --import tsx docs/security/review-2026-11-16/reproduce.mts
// Synthetic accounts only. The model SDK is stubbed; no email/model calls.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

assert.ok(process.env.TEST_DATABASE_URL, 'A disposable TEST_DATABASE_URL is required')
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
process.env.SIGNUP_MODE = 'open'
process.env.ANTHROPIC_API_KEY = 'synthetic-not-a-real-key'
const { app } = await import('../../../server/src/app.js')
const { pool, withUser } = await import('../../../server/src/db.js')
const { hashToken } = await import('../../../server/src/auth.js')
const { getClient } = await import('../../../server/src/ai/client.js')
const { callTool } = await import('../../../server/src/mcp/server.js')
let ip = 0
const request = (path: string, body?: unknown, token?: string) => app.request('/api' + path, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { 'content-type': 'application/json', 'x-real-ip': `10.55.0.${++ip}`,
    ...(token ? { authorization: `Bearer ${token}` } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const email = `review-${randomUUID()}@example.test`
const password = 'synthetic old password'
const signup = await request('/auth/signup', { email, password })
assert.equal(signup.status, 201)
const user = await signup.json() as any

// Deterministically pause the old-password login just before session insertion.
const originalQuery = pool.query.bind(pool)
let reached!: () => void
let resume!: () => void
const atInsert = new Promise<void>(r => reached = r)
const resumed = new Promise<void>(r => resume = r)
let intercept = true
;(pool as any).query = async (...args: any[]) => {
  if (intercept && String(args[0]).includes('insert into auth.sessions')) {
    intercept = false
    reached()
    await resumed
  }
  return (originalQuery as any)(...args)
}
const login = request('/auth/login', { email, password })
await atInsert
const resetToken = randomUUID()
await originalQuery('insert into auth.password_reset_tokens(token_hash,user_id,expires_at) values($1,$2,now()+interval \'1 hour\')', [hashToken(resetToken), user.user.id])
const reset = await request('/auth/reset', { token: resetToken, password: 'synthetic new password' })
assert.equal(reset.status, 200)
const recovered = await reset.json() as any
resume()
const lateLogin = await login
assert.equal(lateLogin.status, 200)
const attacker = await lateLogin.json() as any
assert.equal((await request('/profile', undefined, attacker.access_token)).status, 200)
;(pool as any).query = originalQuery
console.log('CONFIRMED: old-password login creates a usable session after password reset')

// Pause all requests inside their profile transaction, after admission checks.
let entered = 0
let allEntered!: () => void
let finishModel!: () => void
const allModels = new Promise<void>(r => allEntered = r)
const finish = new Promise<void>(r => finishModel = r)
;(getClient().beta.messages as any).stream = () => {
  entered++
  if (entered === 10) allEntered()
  return { on() {}, async finalMessage() {
    await finish
    return { model: 'mock', stop_reason: 'end_turn', content: [{ type: 'text', text: 'Mock reply' }],
      usage: { input_tokens: 1, output_tokens: 1 } }
  } }
}
const blocker = await pool.connect()
await blocker.query('begin')
await blocker.query('select id from public.users where id=$1 for update', [user.user.id])
const chats = Array.from({ length: 10 }, () => request('/ai/chat', { message: 'Test', timezone: 'America/Detroit' }, recovered.access_token))
// Give requests time to reach the blocked transaction, without heavy traffic.
await new Promise(r => setTimeout(r, 500))
await blocker.query('commit')
blocker.release()
const timer = setTimeout(() => { console.error('Reproduction timed out'); process.exit(1) }, 10000)
await allModels
assert.equal(entered, 10)
finishModel()
const replies = await Promise.all(chats)
await Promise.all(replies.map(r => r.text()))
clearTimeout(timer)
console.log('CONFIRMED: 10 simultaneous model calls for one user despite limits of 2/user and 8/global')

// Undo restores the parent, but not the foreign-key relationship it removed.
const meal = await request('/meal-plans', { name: 'Synthetic meal', planned_date: '2026-11-16', meal_type: 'lunch', calories: 500 }, recovered.access_token)
const mealRow = await meal.json() as any
const grocery = await request('/grocery-items', { name: 'Synthetic ingredient', category: 'other', meal_plan_id: mealRow.id }, recovered.access_token)
const groceryRow = await grocery.json() as any
const removal = await callTool({ userId: user.user.id, grantId: randomUUID(), scopes: ['read','write'], clientName: 'Synthetic' }, 'delete_planned_meals', { ids: [mealRow.id] })
assert.ok(!removal.isError)
const feed = await (await request('/agent-activity', undefined, recovered.access_token)).json() as any[]
assert.equal((await request(`/agent-activity/${feed[0].id}/undo`, {}, recovered.access_token)).status, 200)
const restored = await withUser(user.user.id, db => db.query('select meal_plan_id from public.grocery_items where id=$1', [groceryRow.id]))
assert.equal(restored.rows[0].meal_plan_id, null)
console.log('CONFIRMED: undoing meal deletion leaves its grocery relationship null')
await pool.end()
