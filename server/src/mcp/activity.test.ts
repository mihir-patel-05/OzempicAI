import { testInvitation } from '../test-support.js'
/**
 * Phase 2 end to end: AI-app edits are logged with snapshots, and Undo puts
 * them back unless the rows changed since. Like flow.test.ts, these run only
 * when TEST_DATABASE_URL points at a migrated, disposable Postgres.
 */
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'

const DB = process.env.TEST_DATABASE_URL
const skip = DB ? false : 'set TEST_DATABASE_URL to run'

type App = typeof import('../app.js').app
let app: App
let pool: typeof import('../db.js').pool
let callTool: typeof import('./server.js').callTool
let today: string
let addDays: (date: string, days: number) => string

before(async () => {
  if (!DB) return
  process.env.DATABASE_URL = DB
  process.env.MCP_ENABLED = 'true'
  process.env.APP_URL = 'https://app.test'
  delete process.env.SIGNUP_MODE
  app = (await import('../app.js')).app
  pool = (await import('../db.js')).pool
  callTool = (await import('./server.js')).callTool
  const dates = await import('../ai/dates.js')
  today = dates.todayIn('UTC')
  addDays = dates.addDays
})

after(async () => {
  if (pool) await pool.end()
})

// ─── Helpers ────────────────────────────────────────────────────────────────

interface User {
  id: string
  session: string
  /** Calls a tool as a read-and-write AI app connected to this user. */
  tool(name: string, args: Record<string, unknown>): Promise<any>
}

async function request(method: string, path: string, session: string, body?: unknown) {
  const ip = `10.9.${randomBytes(1)[0]}.${(randomBytes(1)[0]! % 250) + 1}`
  const res = await app.request(path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session}`, 'x-real-ip': ip },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

async function signUp(): Promise<User> {
  const email = `activity-${randomBytes(6).toString('hex')}@example.com`
  const res = await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '10.8.0.1' },
    body: JSON.stringify({ email, password: 'correct horse battery', name: 'Test', invite_token: await testInvitation(email) }),
  })
  assert.equal(res.status, 201)
  const data = (await res.json()) as { access_token: string; user: { id: string } }
  const caller = { userId: data.user.id, grantId: randomUUID(), scopes: ['read', 'write'] as const, clientName: 'Claude' }
  return {
    id: data.user.id,
    session: data.access_token,
    async tool(name, args) {
      const result = await callTool({ ...caller, scopes: [...caller.scopes] }, name, args)
      const text = (result.content[0] as { text: string }).text
      assert.equal(result.isError, undefined, `${name} failed: ${text}`)
      return JSON.parse(text)
    },
  }
}

async function activity(user: User) {
  const res = await request('GET', '/api/agent-activity', user.session)
  assert.equal(res.status, 200)
  return res.data as { id: string; tool_name: string; summary: string; can_undo: boolean; undone_at: string | null }[]
}

const undo = (user: User, id: string) => request('POST', `/api/agent-activity/${id}/undo`, user.session)

async function groceries(user: User) {
  const { items } = await user.tool('get_grocery_list', { include_purchased: true })
  return items as { id: string; name: string; category: string; purchased?: true }[]
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test('grocery edits are logged newest first and undo in reverse order', { skip }, async () => {
  const user = await signUp()
  await user.tool('add_grocery_items', {
    items: [
      { name: 'Oats', category: 'grains' },
      { name: 'Milk', category: 'dairy' },
    ],
  })
  const original = await groceries(user)
  const oats = original.find((item) => item.name === 'Oats')!
  const milk = original.find((item) => item.name === 'Milk')!

  await user.tool('update_grocery_items', { items: [{ id: oats.id, name: 'Rolled oats', purchased: true }] })
  // Upper-case ids still match, and the removal is still logged.
  await user.tool('remove_grocery_items', { ids: [milk.id.toUpperCase()] })
  assert.deepEqual(
    (await groceries(user)).map((item) => item.name),
    ['Rolled oats'],
  )

  const feed = await activity(user)
  assert.deepEqual(
    feed.map((entry) => entry.tool_name),
    ['remove_grocery_items', 'update_grocery_items', 'add_grocery_items'],
  )
  assert.ok(feed.every((entry) => entry.can_undo))

  // Undoing the oldest first would overwrite the later edits: refused.
  const tooEarly = await undo(user, feed[2]!.id)
  assert.equal(tooEarly.status, 409)
  assert.equal((await groceries(user)).length, 1)

  for (const entry of feed) assert.equal((await undo(user, entry.id)).status, 200, entry.tool_name)
  assert.deepEqual(await groceries(user), [])

  const again = await undo(user, feed[0]!.id)
  assert.equal(again.status, 409)
  assert.ok((await activity(user)).every((entry) => entry.undone_at && !entry.can_undo))
})

test('removed rows come back with their ids, and a later user edit blocks Undo', { skip }, async () => {
  const user = await signUp()
  await user.tool('add_grocery_items', { items: [{ name: 'Eggs', category: 'protein' }] })
  const [eggs] = await groceries(user)
  await user.tool('update_grocery_items', { items: [{ id: eggs!.id, purchased: true }] })
  await user.tool('clear_purchased_groceries', {})
  assert.deepEqual(await groceries(user), [])

  const [cleared, updated] = await activity(user)
  assert.equal((await undo(user, cleared!.id)).status, 200)
  assert.deepEqual(await groceries(user), [{ id: eggs!.id, name: 'Eggs', category: 'protein', purchased: true }])

  // The user un-ticks it in Plans; undoing the agent's edit would clobber that.
  assert.equal((await request('PATCH', `/api/grocery-items/${eggs!.id}`, user.session, { is_purchased: false })).status, 200)
  const blocked = await undo(user, updated!.id)
  assert.equal(blocked.status, 409)
  assert.match(blocked.data.error, /changed again since/)
})

test('meal edits undo: a moved meal goes back and a removed one returns', { skip }, async () => {
  const user = await signUp()
  const day = addDays(today, 2)
  await user.tool('create_meal_plan', {
    meals: [{ planned_date: day, meal_type: 'dinner', name: 'Tacos', calories: 600 }],
  })
  const range = { range: 'custom', start_date: today, end_date: addDays(today, 7) }
  const read = async () => (await user.tool('get_meal_plans', range)).days_with_plans as any[]
  const [{ meals }] = await read()
  const id = meals[0].id

  await user.tool('update_planned_meals', { meals: [{ id, planned_date: addDays(today, 3), calories: 650 }] })
  await user.tool('delete_planned_meals', { ids: [id] })
  assert.deepEqual(await read(), [])

  const [removed, moved, created] = await activity(user)
  assert.equal((await undo(user, removed!.id)).status, 200)
  assert.equal((await read())[0].date, addDays(today, 3))
  assert.equal((await undo(user, moved!.id)).status, 200)
  const [restored] = await read()
  assert.equal(restored.date, day)
  assert.deepEqual(restored.meals, [{ id, meal_type: 'dinner', name: 'Tacos', calories: 600 }])
  assert.equal((await undo(user, created!.id)).status, 200)
  assert.deepEqual(await read(), [])
})

test('workout edits undo with their exercises', { skip }, async () => {
  const user = await signUp()
  const day = addDays(today, 1)
  await user.tool('create_workout_plans', {
    unit_system: 'metric',
    workouts: [
      {
        name: 'Push day',
        workout_type: 'push',
        planned_date: day,
        notes: '',
        exercises: [
          { exercise_name: 'Bench press', sets: 3, reps: 8, weight: 62.5 },
          { exercise_name: 'Dips', sets: 3, reps: 10 },
        ],
      },
    ],
  })
  const range = { range: 'custom', start_date: today, end_date: addDays(today, 7) }
  const plans = async () => (await user.tool('get_workout_plans', range)).plans as any[]
  const [original] = await plans()

  await user.tool('update_workout_plan', {
    plan_id: original.plan_id,
    unit_system: 'metric',
    workout: { name: 'Push day', workout_type: 'push', planned_date: day, notes: 'Go light', exercises: [{ exercise_name: 'Push-ups' }] },
  })
  await user.tool('complete_workout_plan', { plan_id: original.plan_id, completed: true })
  await user.tool('delete_workout_plans', { plan_ids: [original.plan_id] })
  assert.deepEqual(await plans(), [])

  const feed = await activity(user)
  assert.deepEqual(
    feed.map((entry) => entry.tool_name),
    ['delete_workout_plans', 'complete_workout_plan', 'update_workout_plan', 'create_workout_plans'],
  )
  assert.equal((await undo(user, feed[0]!.id)).status, 200)
  const [back] = await plans()
  assert.equal(back.completed, true)
  assert.deepEqual(back.exercises, [{ exercise_name: 'Push-ups' }])

  assert.equal((await undo(user, feed[1]!.id)).status, 200)
  assert.equal((await undo(user, feed[2]!.id)).status, 200)
  assert.deepEqual(await plans(), [original])
  assert.equal((await undo(user, feed[3]!.id)).status, 200)
  assert.deepEqual(await plans(), [])
})

test('activity is private to its user, and no-op calls are not logged', { skip }, async () => {
  const owner = await signUp()
  const stranger = await signUp()
  await owner.tool('add_grocery_items', { items: [{ name: 'Rice', category: 'grains' }] })
  await owner.tool('add_grocery_items', { items: [{ name: 'rice', category: 'grains' }] }) // duplicate: no-op
  await owner.tool('clear_purchased_groceries', {}) // nothing purchased: no-op

  const feed = await activity(owner)
  assert.equal(feed.length, 1)
  assert.deepEqual(await activity(stranger), [])
  assert.equal((await undo(stranger, feed[0]!.id)).status, 404)
  assert.equal((await groceries(owner)).length, 1)

  assert.equal((await undo(owner, 'not-a-uuid')).status, 400)
})

test('linked meal/workout plans cannot be deleted by AI or by undoing their creation', { skip }, async () => {
  for (const kind of ['meal', 'workout'] as const) {
    const user = await signUp()
    let id: string
    if (kind === 'meal') {
      await user.tool('create_meal_plan', { meals: [{ planned_date: today, meal_type: 'lunch', name: 'Linked meal', calories: 500 }] })
      const meals = await user.tool('get_meal_plans', { range: 'custom', start_date: today, end_date: today })
      id = meals.days_with_plans[0].meals[0].id
      assert.equal((await request('POST', '/api/grocery-items', user.session, { name: 'Ingredient', category: 'other', meal_plan_id: id })).status, 201)
    } else {
      await user.tool('create_workout_plans', { unit_system: 'metric', workouts: [{ name: 'Linked workout', workout_type: 'other', planned_date: today, notes: '', exercises: [] }] })
      id = (await user.tool('get_workout_plans', { range: 'custom', start_date: today, end_date: today })).plans[0].plan_id
      assert.equal((await request('POST', '/api/workout-sessions', user.session, { name: 'Logged workout', workout_type: 'other', plan_id: id })).status, 201)
    }
    const [created] = await activity(user)
    assert.equal((await undo(user, created!.id)).status, 409)
    await assert.rejects(user.tool(kind === 'meal' ? 'delete_planned_meals' : 'delete_workout_plans', kind === 'meal' ? { ids: [id] } : { plan_ids: [id] }), /linked/)
    const table = kind === 'meal' ? 'grocery_items' : 'workout_sessions'
    const column = kind === 'meal' ? 'meal_plan_id' : 'plan_id'
    const linked = await pool.query(`select count(*)::int as n from public.${table} where user_id=$1 and ${column}=$2`, [user.id, id])
    assert.equal(linked.rows[0].n, 1)
    assert.equal((await activity(user)).length, 1)
  }
})

test('older deleted-parent snapshots are refused when safe restoration cannot be established', { skip }, async () => {
  const user = await signUp()
  await user.tool('create_meal_plan', { meals: [{ planned_date: today, meal_type: 'lunch', name: 'Legacy meal', calories: 500 }] })
  const meal = (await user.tool('get_meal_plans', { range: 'custom', start_date: today, end_date: today })).days_with_plans[0].meals[0]
  await user.tool('delete_planned_meals', { ids: [meal.id] })
  const [removed] = await activity(user)
  await pool.query("update public.agent_activity set before=(select jsonb_agg(r-'links_checked') from jsonb_array_elements(before) r) where id=$1", [removed!.id])
  const refused = await undo(user, removed!.id)
  assert.equal(refused.status, 409)
  assert.match(refused.data.error, /older deletion/)
  assert.equal((await pool.query('select 1 from public.meal_plans where id=$1', [meal.id])).rowCount, 0)
})
