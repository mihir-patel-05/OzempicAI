import { testInvitation } from './test-support.js'
/**
 * The fasting routes (docs/fasting-plan.md). Like security.test.ts, these run
 * only when TEST_DATABASE_URL points at a migrated, disposable Postgres.
 */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, before, test } from 'node:test'

const DB = process.env.TEST_DATABASE_URL
const skip = DB ? false : 'set TEST_DATABASE_URL to run'

type App = typeof import('./app.js').app
let app: App
let pool: typeof import('./db.js').pool

before(async () => {
  if (!DB) return
  process.env.DATABASE_URL = DB
  delete process.env.SIGNUP_MODE
  app = (await import('./app.js')).app
  pool = (await import('./db.js')).pool
})

after(async () => {
  if (pool) await pool.end()
})

// ─── Helpers ────────────────────────────────────────────────────────────────

const HOUR = 60 * 60_000
const ago = (ms: number) => new Date(Date.now() - ms).toISOString()
const randomIp = () => `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${(randomBytes(1)[0]! % 250) + 1}`

interface Reply {
  status: number
  data: any
}

async function call(method: string, path: string, bearer: string, body?: unknown): Promise<Reply> {
  const res = await app.request(path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-real-ip': randomIp(),
      authorization: `Bearer ${bearer}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

async function signUp(): Promise<string> {
  const email = `fast-${randomBytes(6).toString('hex')}@example.com`
  const res = await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': randomIp() },
    body: JSON.stringify({ email, password: 'correct horse battery', name: 'Test', invite_token: await testInvitation(email) }),
  })
  assert.equal(res.status, 201)
  return ((await res.json()) as { access_token: string }).access_token
}

async function notified(id: string) {
  const { rows } = await pool.query<{ goal_notified_at: Date | null; reminder_notified_at: Date | null }>(
    'select goal_notified_at, reminder_notified_at from public.fasts where id = $1',
    [id],
  )
  return rows[0]!
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test('a fast can be started, read back while running, and ended', { skip }, async () => {
  const me = await signUp()
  assert.equal((await call('GET', '/api/fasts/active', me)).data, null)

  const started = await call('POST', '/api/fasts', me, { target_minutes: 16 * 60 })
  assert.equal(started.status, 201)
  assert.equal(started.data.target_minutes, 960)
  assert.equal(started.data.ended_at, null)
  assert.ok(Math.abs(Date.parse(started.data.started_at) - Date.now()) < 5_000)
  assert.equal('goal_notified_at' in started.data, false, 'notifier bookkeeping stays out of responses')

  const active = await call('GET', '/api/fasts/active', me)
  assert.equal(active.data.id, started.data.id)

  // No body at all: ends now.
  const ended = await call('POST', `/api/fasts/${started.data.id}/end`, me)
  assert.equal(ended.status, 200)
  assert.ok(ended.data.ended_at)
  assert.equal((await call('GET', '/api/fasts/active', me)).data, null)

  const again = await call('POST', `/api/fasts/${started.data.id}/end`, me)
  assert.equal(again.status, 409)
})

test('only one fast runs at a time, even when two starts race', { skip }, async () => {
  const me = await signUp()
  assert.equal((await call('POST', '/api/fasts', me, { target_minutes: 960 })).status, 201)
  const second = await call('POST', '/api/fasts', me, { target_minutes: 960 })
  assert.equal(second.status, 409)
  assert.match(second.data.error, /already running/)

  // A start that isn't committed yet is invisible to the route's check, so the
  // request gets as far as its insert; the database makes it wait, then refuses it.
  const racer = await signUp()
  const racerId = (await call('GET', '/api/profile', racer)).data.id as string
  const other = await pool.connect()
  try {
    await other.query('begin')
    await other.query('insert into public.fasts (user_id, started_at, target_minutes) values ($1, now(), 720)', [racerId])
    const pending = call('POST', '/api/fasts', racer, { target_minutes: 720 })
    await new Promise((resolve) => setTimeout(resolve, 200))
    await other.query('commit')
    const raced = await pending
    assert.equal(raced.status, 409)
    assert.equal(raced.data.error, 'That overlaps an existing entry.')
  } finally {
    other.release()
  }
})

test('the goal is 1 to 72 hours, in whole minutes', { skip }, async () => {
  const me = await signUp()
  for (const target_minutes of [59, 4321, 90.5, '960', null]) {
    const res = await call('POST', '/api/fasts', me, { target_minutes })
    assert.equal(res.status, 400, `target_minutes ${JSON.stringify(target_minutes)}`)
  }
  assert.equal((await call('POST', '/api/fasts', me, {})).status, 400)
  assert.equal((await call('POST', '/api/fasts', me, { target_minutes: 4320 })).status, 201)
})

test('times cannot be in the future, and a fast ends after it starts', { skip }, async () => {
  const me = await signUp()
  const future = new Date(Date.now() + 10 * 60_000).toISOString()
  assert.equal((await call('POST', '/api/fasts', me, { target_minutes: 960, started_at: future })).status, 400)
  assert.equal(
    (await call('POST', '/api/fasts', me, { target_minutes: 960, started_at: ago(5 * HOUR), ended_at: ago(6 * HOUR) })).status,
    400,
  )

  const fast = await call('POST', '/api/fasts', me, { target_minutes: 960, started_at: ago(2 * HOUR) })
  assert.equal(fast.status, 201)
  assert.equal((await call('POST', `/api/fasts/${fast.data.id}/end`, me, { ended_at: ago(3 * HOUR) })).status, 400)
  assert.equal((await call('POST', `/api/fasts/${fast.data.id}/end`, me, { ended_at: future })).status, 400)
})

test('past fasts can be recorded, but never overlapping another', { skip }, async () => {
  const me = await signUp()
  const running = await call('POST', '/api/fasts', me, { target_minutes: 960, started_at: ago(2 * HOUR) })
  assert.equal(running.status, 201)

  // Yesterday, finished: fine alongside the running fast.
  const past = await call('POST', '/api/fasts', me, { target_minutes: 960, started_at: ago(30 * HOUR), ended_at: ago(14 * HOUR) })
  assert.equal(past.status, 201)

  // Overlaps yesterday's.
  const overlapsPast = await call('POST', '/api/fasts', me, { target_minutes: 960, started_at: ago(20 * HOUR), ended_at: ago(10 * HOUR) })
  assert.equal(overlapsPast.status, 409)
  // Runs into the running fast.
  const overlapsRunning = await call('POST', '/api/fasts', me, { target_minutes: 60, started_at: ago(3 * HOUR), ended_at: ago(1 * HOUR) })
  assert.equal(overlapsRunning.status, 409)
  // Moving the running fast's start back into yesterday's.
  const moved = await call('PATCH', `/api/fasts/${running.data.id}`, me, { started_at: ago(15 * HOUR) })
  assert.equal(moved.status, 409)
})

test('the history lists fasts that overlap the window, newest first', { skip }, async () => {
  const me = await signUp()
  const old = await call('POST', '/api/fasts', me, { target_minutes: 960, started_at: ago(100 * HOUR), ended_at: ago(84 * HOUR) })
  const recent = await call('POST', '/api/fasts', me, { target_minutes: 960, started_at: ago(40 * HOUR), ended_at: ago(24 * HOUR) })
  const running = await call('POST', '/api/fasts', me, { target_minutes: 960, started_at: ago(1 * HOUR) })

  const all = await call('GET', '/api/fasts', me)
  assert.deepEqual(all.data.map((f: { id: string }) => f.id), [running.data.id, recent.data.id, old.data.id])

  // A fast that started before `from` but ended inside it still counts.
  const window = await call('GET', `/api/fasts?from=${encodeURIComponent(ago(30 * HOUR))}&to=${encodeURIComponent(ago(10 * HOUR))}`, me)
  assert.deepEqual(window.data.map((f: { id: string }) => f.id), [recent.data.id])

  assert.equal((await call('GET', '/api/fasts?from=yesterday', me)).status, 400)
  assert.equal((await call('GET', '/api/fasts?limit=1', me)).data.length, 1)
})

test('edits re-arm notifications only when the goal moves into the future', { skip }, async () => {
  const me = await signUp()
  const fast = await call('POST', '/api/fasts', me, { target_minutes: 960, started_at: ago(17 * HOUR) })
  // As the notifier will: both sent, since the goal passed an hour ago.
  await pool.query('update public.fasts set goal_notified_at = now(), reminder_notified_at = now() where id = $1', [fast.data.id])

  // Notes only: the goal is still in the past, nothing is re-sent.
  assert.equal((await call('PATCH', `/api/fasts/${fast.data.id}`, me, { notes: 'felt fine' })).data.notes, 'felt fine')
  let state = await notified(fast.data.id)
  assert.ok(state.goal_notified_at && state.reminder_notified_at)

  // 17 h in, goal raised to 17.5 h: goal re-armed; "1 hour left" already passed.
  await call('PATCH', `/api/fasts/${fast.data.id}`, me, { target_minutes: 17 * 60 + 30 })
  state = await notified(fast.data.id)
  assert.equal(state.goal_notified_at, null)
  assert.ok(state.reminder_notified_at)

  // Goal raised to 20 h: both re-armed.
  await call('PATCH', `/api/fasts/${fast.data.id}`, me, { target_minutes: 20 * 60 })
  state = await notified(fast.data.id)
  assert.equal(state.goal_notified_at, null)
  assert.equal(state.reminder_notified_at, null)

  assert.equal((await call('PATCH', `/api/fasts/${fast.data.id}`, me, {})).status, 400)
  assert.equal((await call('PATCH', `/api/fasts/${fast.data.id}`, me, { target_minutes: 5000 })).status, 400)
})

test('an ended fast can be reopened, unless another is running', { skip }, async () => {
  const me = await signUp()
  const first = await call('POST', '/api/fasts', me, { target_minutes: 960, started_at: ago(3 * HOUR) })
  await call('POST', `/api/fasts/${first.data.id}/end`, me, { ended_at: ago(2 * HOUR) })

  const reopened = await call('PATCH', `/api/fasts/${first.data.id}`, me, { ended_at: null })
  assert.equal(reopened.status, 200)
  assert.equal(reopened.data.ended_at, null)

  await call('POST', `/api/fasts/${first.data.id}/end`, me, { ended_at: ago(2 * HOUR) })
  assert.equal((await call('POST', '/api/fasts', me, { target_minutes: 960, started_at: ago(1 * HOUR) })).status, 201)
  const clash = await call('PATCH', `/api/fasts/${first.data.id}`, me, { ended_at: null })
  assert.equal(clash.status, 409)
})

test('one user cannot see, end, edit or delete another user\'s fast', { skip }, async () => {
  const owner = await signUp()
  const other = await signUp()
  const fast = await call('POST', '/api/fasts', owner, { target_minutes: 960 })

  assert.equal((await call('GET', '/api/fasts/active', other)).data, null)
  assert.deepEqual((await call('GET', '/api/fasts', other)).data, [])
  assert.equal((await call('POST', `/api/fasts/${fast.data.id}/end`, other)).status, 404)
  assert.equal((await call('PATCH', `/api/fasts/${fast.data.id}`, other, { notes: 'x' })).status, 404)
  assert.equal((await call('DELETE', `/api/fasts/${fast.data.id}`, other)).status, 204)

  // Still there, untouched, for its owner; and the other user can start their own.
  const mine = await call('GET', '/api/fasts/active', owner)
  assert.equal(mine.data.id, fast.data.id)
  assert.equal(mine.data.notes, null)
  assert.equal((await call('POST', '/api/fasts', other, { target_minutes: 960 })).status, 201)
})

test('a fast can be deleted', { skip }, async () => {
  const me = await signUp()
  const fast = await call('POST', '/api/fasts', me, { target_minutes: 960 })
  assert.equal((await call('DELETE', `/api/fasts/${fast.data.id}`, me)).status, 204)
  assert.equal((await call('GET', '/api/fasts/active', me)).data, null)
  assert.equal((await call('DELETE', '/api/fasts/not-an-id', me)).status, 400)
})

test('get_fasting_history reads the user\'s own fasts for the coach and AI apps', { skip }, async () => {
  const { withUser } = await import('./db.js')
  const { runTool } = await import('./ai/tools/index.js')
  const { todayIn } = await import('./ai/dates.js')
  const me = await signUp()
  const other = await signUp()

  const met = await call('POST', '/api/fasts', me, { started_at: ago(40 * HOUR), ended_at: ago(22 * HOUR), target_minutes: 16 * 60, notes: 'Easy one' })
  const short = await call('POST', '/api/fasts', me, { started_at: ago(20 * HOUR), ended_at: ago(8 * HOUR), target_minutes: 16 * 60 })
  const running = await call('POST', '/api/fasts', me, { started_at: ago(2 * HOUR), target_minutes: 18 * 60 })
  await call('POST', '/api/fasts', other, { started_at: ago(30 * HOUR), ended_at: ago(5 * HOUR), target_minutes: 20 * 60 })
  for (const reply of [met, short, running]) assert.equal(reply.status, 201)

  const { rows } = await pool.query<{ user_id: string }>('select user_id from public.fasts where id = $1', [met.data.id])
  const userId = rows[0]!.user_id
  const run = await withUser(userId, (db) =>
    runTool(
      'get_fasting_history',
      { range: 'last_7_days', start_date: null, end_date: null },
      { db, userId, tz: 'UTC', today: todayIn('UTC') },
      'mcp',
    ),
  )
  assert.ok(run.ok)
  const result = run.outcome.result as Record<string, any>
  assert.equal(result.running.goal, '18:6')
  assert.ok(Math.abs(result.running.hours_so_far - 2) < 0.1)
  assert.equal(result.running.reached, false)
  assert.equal(result.ended_fasts, 2, 'the running fast and the other user\'s fast stay out')
  assert.equal(result.goals_met, 1)
  assert.equal(result.goal_met_pct, 50)
  assert.equal(result.longest_hours, 18)
  assert.equal(result.total_hours, 30)
  assert.deepEqual(result.streak_days, { current: 1, best: 1 })
  assert.deepEqual(
    result.fasts.map((f: any) => [f.hours, f.goal, f.met, f.notes]),
    [
      [12, '16:8', false, undefined],
      [18, '16:8', true, 'Easy one'],
    ],
  )
  assert.match(result.fasts[0].started, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
})
