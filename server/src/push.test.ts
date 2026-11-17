import { testInvitation } from './test-support.js'
/**
 * Push subscriptions and fasting notifications (docs/fasting-plan.md, phase 5).
 * Nothing is sent to a real push service: a fake sender records each message.
 * The database tests run only when TEST_DATABASE_URL points at a migrated,
 * disposable Postgres.
 */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, before, beforeEach, test } from 'node:test'
import webpush from 'web-push'
import { isPushEndpoint, pushConfig } from './push/config.js'
import { goalLabel, worthSending } from './push/fastingMessages.js'
import type { PushMessage, PushResult, PushTarget } from './push/send.js'

const DB = process.env.TEST_DATABASE_URL
const skip = DB ? false : 'set TEST_DATABASE_URL to run'

type App = typeof import('./app.js').app
let app: App
let pool: typeof import('./db.js').pool
let notifier: typeof import('./push/fastingNotifier.js')

interface Delivery {
  endpoint: string
  message: PushMessage
}
let deliveries: Delivery[] = []
/** What the fake push service answers for a given endpoint (default: delivered). */
let answers = new Map<string, PushResult>()
const fakeSender = async (target: PushTarget, message: PushMessage): Promise<PushResult> => {
  deliveries.push({ endpoint: target.endpoint, message })
  return answers.get(target.endpoint) ?? 'sent'
}

const VAPID = webpush.generateVAPIDKeys()

before(async () => {
  if (!DB) return
  process.env.DATABASE_URL = DB
  process.env.VAPID_PUBLIC_KEY = VAPID.publicKey
  process.env.VAPID_PRIVATE_KEY = VAPID.privateKey
  process.env.VAPID_SUBJECT = 'mailto:test@example.com'
  delete process.env.SIGNUP_MODE
  app = (await import('./app.js')).app
  pool = (await import('./db.js')).pool
  notifier = await import('./push/fastingNotifier.js')
  ;(await import('./push/send.js')).setPushSenderForTests(fakeSender)
})

after(async () => {
  if (pool) await pool.end()
})

beforeEach(() => {
  deliveries = []
  answers = new Map()
})

// ─── Helpers ────────────────────────────────────────────────────────────────

const HOUR = 60 * 60_000
const randomIp = () => `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${(randomBytes(1)[0]! % 250) + 1}`

async function call(method: string, path: string, bearer: string, body?: unknown) {
  const res = await app.request(path, {
    method,
    headers: { 'content-type': 'application/json', 'x-real-ip': randomIp(), authorization: `Bearer ${bearer}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

async function signUp(): Promise<{ token: string; id: string }> {
  const email = `push-${randomBytes(6).toString('hex')}@example.com`
  const res = await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': randomIp() },
    body: JSON.stringify({ email, password: 'correct horse battery', name: 'Test', invite_token: await testInvitation(email) }),
  })
  assert.equal(res.status, 201)
  const data = (await res.json()) as { access_token: string; user: { id: string } }
  return { token: data.access_token, id: data.user.id }
}

/** A subscription shaped like PushSubscription.toJSON() from Chrome. */
function subscription(host = 'fcm.googleapis.com') {
  return {
    endpoint: `https://${host}/fcm/send/${randomBytes(24).toString('base64url')}`,
    keys: { p256dh: randomBytes(65).toString('base64url'), auth: randomBytes(16).toString('base64url') },
  }
}

async function subscribe(token: string, sub = subscription()) {
  const res = await call('POST', '/api/push/subscriptions', token, sub)
  assert.equal(res.status, 201)
  return sub
}

async function owners(endpoint: string): Promise<string[]> {
  const { rows } = await pool.query<{ user_id: string }>('select user_id from public.push_subscriptions where endpoint = $1', [endpoint])
  return rows.map((row) => row.user_id)
}

/** A running fast that started `startedHoursAgo` ago, saved `createdHoursAgo` ago. */
async function runningFast(userId: string, startedHoursAgo: number, targetMinutes: number, createdHoursAgo = startedHoursAgo) {
  const { rows } = await pool.query<{ id: string }>(
    `insert into public.fasts (user_id, started_at, target_minutes, created_at)
     values ($1, now() - make_interval(secs => $2), $3, now() - make_interval(secs => $4))
     returning id`,
    [userId, startedHoursAgo * 3600, targetMinutes, createdHoursAgo * 3600],
  )
  return rows[0]!.id
}

// ─── Without a database ─────────────────────────────────────────────────────

test('only known browser push services are accepted as endpoints', () => {
  for (const ok of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QGx',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ]) {
    assert.equal(isPushEndpoint(ok), true, ok)
  }
  for (const bad of [
    'http://fcm.googleapis.com/fcm/send/abc', // not https
    'https://fcm.googleapis.com:8443/fcm/send/abc', // odd port
    'https://user:pw@fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com.evil.example/x', // suffix trick
    'https://evilfcm.googleapis.com/x',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/x',
    'not a url',
  ]) {
    assert.equal(isPushEndpoint(bad), false, bad)
  }
})

test('push is configured only by all three VAPID variables', () => {
  assert.equal(pushConfig({ VAPID_PUBLIC_KEY: 'a', VAPID_PRIVATE_KEY: 'b' }), null)
  assert.deepEqual(pushConfig({ VAPID_PUBLIC_KEY: 'a', VAPID_PRIVATE_KEY: 'b', VAPID_SUBJECT: 'mailto:x@y.z' }), {
    publicKey: 'a',
    privateKey: 'b',
    subject: 'mailto:x@y.z',
  })
  assert.throws(() => pushConfig({ VAPID_PUBLIC_KEY: 'a', VAPID_PRIVATE_KEY: 'b', VAPID_SUBJECT: 'x@y.z' }))
})

test('goal labels match the web app', () => {
  assert.equal(goalLabel(16 * 60), '16:8')
  assert.equal(goalLabel(23 * 60), 'OMAD')
  assert.equal(goalLabel(36 * 60), '36h')
  assert.equal(goalLabel(17 * 60 + 30), '17h 30m')
})

test('a notification is worth sending only if it was due after the fast was saved and is recent', () => {
  const now = Date.now()
  const at = (hoursAgo: number) => new Date(now - hoursAgo * HOUR)
  assert.equal(worthSending({ created_at: at(16), due_at: at(0) }, now), true)
  assert.equal(worthSending({ created_at: at(1), due_at: at(2) }, now), false, 'backdated past it')
  assert.equal(worthSending({ created_at: at(24), due_at: at(7) }, now), false, 'stale after downtime')
})

// ─── Routes ─────────────────────────────────────────────────────────────────

test('the app learns whether push is on and which key to subscribe with', { skip }, async () => {
  const me = await signUp()
  const res = await call('GET', '/api/push/config', me.token)
  assert.deepEqual(res.data, { enabled: true, public_key: VAPID.publicKey })
})

test('subscriptions are checked before they are saved', { skip }, async () => {
  const me = await signUp()
  const good = subscription()
  const bad = [
    { ...good, endpoint: 'https://169.254.169.254/latest/meta-data' },
    { ...good, endpoint: 'http://fcm.googleapis.com/fcm/send/x' },
    { ...good, keys: { ...good.keys, p256dh: 'short' } },
    { ...good, keys: { ...good.keys, auth: 'has spaces in it!!' } },
    { endpoint: good.endpoint },
  ]
  for (const body of bad) assert.equal((await call('POST', '/api/push/subscriptions', me.token, body)).status, 400)
  assert.deepEqual(await owners(good.endpoint), [])
  await subscribe(me.token, good)
  assert.deepEqual(await owners(good.endpoint), [me.id])
})

test('a browser registered again by another account moves to that account', { skip }, async () => {
  const first = await signUp()
  const second = await signUp()
  const sub = await subscribe(first.token)
  await subscribe(second.token, sub)
  assert.deepEqual(await owners(sub.endpoint), [second.id])
})

test('an account keeps at most 10 devices, dropping the oldest', { skip }, async () => {
  const me = await signUp()
  const subs = []
  for (let i = 0; i < 11; i++) subs.push(await subscribe(me.token))
  const { rows } = await pool.query<{ endpoint: string }>('select endpoint from public.push_subscriptions where user_id = $1', [me.id])
  assert.equal(rows.length, 10)
  assert.equal(rows.some((row) => row.endpoint === subs[0]!.endpoint), false)
})

test('turning off removes only your own device', { skip }, async () => {
  const me = await signUp()
  const other = await signUp()
  const sub = await subscribe(me.token)
  assert.equal((await call('DELETE', '/api/push/subscriptions', other.token, { endpoint: sub.endpoint })).status, 204)
  assert.deepEqual(await owners(sub.endpoint), [me.id])
  assert.equal((await call('DELETE', '/api/push/subscriptions', me.token, { endpoint: sub.endpoint })).status, 204)
  assert.deepEqual(await owners(sub.endpoint), [])
})

test('a test notification reaches every device, and gone devices are forgotten', { skip }, async () => {
  const me = await signUp()
  const phone = await subscribe(me.token)
  const laptop = await subscribe(me.token)
  answers.set(laptop.endpoint, 'gone')

  const res = await call('POST', '/api/push/test', me.token)
  assert.equal(res.status, 200)
  assert.deepEqual(res.data, { devices: 2, sent: 1 })
  assert.deepEqual(deliveries.map((d) => d.endpoint).sort(), [phone.endpoint, laptop.endpoint].sort())
  assert.equal(deliveries[0]!.message.url, '/fasting')
  assert.deepEqual(await owners(laptop.endpoint), [])
  assert.deepEqual(await owners(phone.endpoint), [me.id])
})

test('with push unconfigured, the app is told and subscribing is refused', { skip }, async () => {
  const me = await signUp()
  const saved = process.env.VAPID_SUBJECT
  delete process.env.VAPID_SUBJECT
  try {
    assert.deepEqual((await call('GET', '/api/push/config', me.token)).data, { enabled: false, public_key: null })
    assert.equal((await call('POST', '/api/push/subscriptions', me.token, subscription())).status, 503)
  } finally {
    process.env.VAPID_SUBJECT = saved
  }
})

// ─── Notifier ───────────────────────────────────────────────────────────────

test('"1 hour left" is sent once, then "Goal reached" once', { skip }, async () => {
  const me = await signUp()
  const sub = await subscribe(me.token)
  const fastId = await runningFast(me.id, 15.5, 16 * 60) // goal in 30 minutes

  await notifier.notifyDueFasts(fakeSender, [me.id])
  assert.equal(deliveries.length, 1)
  assert.equal(deliveries[0]!.endpoint, sub.endpoint)
  assert.equal(deliveries[0]!.message.title, '1 hour to go')
  assert.equal(deliveries[0]!.message.tag, `fast-${fastId}`)

  await notifier.notifyDueFasts(fakeSender, [me.id])
  assert.equal(deliveries.length, 1, 'not sent again')

  // Half an hour on: the goal is reached.
  await pool.query("update public.fasts set started_at = started_at - interval '31 minutes' where id = $1", [fastId])
  await notifier.notifyDueFasts(fakeSender, [me.id])
  assert.equal(deliveries.length, 2)
  assert.equal(deliveries[1]!.message.title, 'You reached your 16:8 goal')
  assert.equal(deliveries[1]!.message.tag, `fast-${fastId}`, 'replaces the reminder on the device')

  await notifier.notifyDueFasts(fakeSender, [me.id])
  assert.equal(deliveries.length, 2, 'not sent again')
})

test('a goal reached between ticks sends only "Goal reached"', { skip }, async () => {
  const me = await signUp()
  await subscribe(me.token)
  await runningFast(me.id, 16.1, 16 * 60)
  const report = await notifier.notifyDueFasts(fakeSender, [me.id])
  assert.deepEqual(report, { goals: 1, reminders: 0, sent: 1 })
  assert.deepEqual(deliveries.map((d) => d.message.title), ['You reached your 16:8 goal'])
})

test('nothing is sent for moments that passed before the fast was saved, or long ago', { skip }, async () => {
  const backdated = await signUp()
  await subscribe(backdated.token)
  await runningFast(backdated.id, 20, 16 * 60, 0) // started 20 h ago, saved just now
  const stale = await signUp()
  await subscribe(stale.token)
  await runningFast(stale.id, 30, 16 * 60) // goal 14 h ago, server was "down"

  const report = await notifier.notifyDueFasts(fakeSender, [backdated.id, stale.id])
  assert.equal(report.goals, 2, 'both are stamped so they are not retried')
  assert.equal(deliveries.length, 0)
})

test('ended fasts, one-hour goals and fasts far from their goal get no reminder', { skip }, async () => {
  const ended = await signUp()
  await subscribe(ended.token)
  await pool.query(
    "insert into public.fasts (user_id, started_at, target_minutes, ended_at) values ($1, now() - interval '17 hours', 960, now() - interval '1 minute')",
    [ended.id],
  )
  const short = await signUp()
  await subscribe(short.token)
  await runningFast(short.id, 0.5, 60)
  const early = await signUp()
  await subscribe(early.token)
  await runningFast(early.id, 2, 16 * 60)

  const report = await notifier.notifyDueFasts(fakeSender, [ended.id, short.id, early.id])
  assert.deepEqual(report, { goals: 0, reminders: 0, sent: 0 })
})

test('two notifiers running at once send each notification once', { skip }, async () => {
  const users = await Promise.all([signUp(), signUp(), signUp()])
  for (const user of users) {
    await subscribe(user.token)
    await runningFast(user.id, 16.2, 16 * 60)
  }
  const ids = users.map((user) => user.id)
  await Promise.all([notifier.notifyDueFasts(fakeSender, ids), notifier.notifyDueFasts(fakeSender, ids)])
  assert.equal(deliveries.length, 3)
})

test('editing a fast so its goal is ahead again re-arms its notifications', { skip }, async () => {
  const me = await signUp()
  await subscribe(me.token)
  const fastId = await runningFast(me.id, 16.2, 16 * 60)
  await notifier.notifyDueFasts(fakeSender, [me.id])
  assert.equal(deliveries.length, 1)

  // Raise the goal to 18 h: "1 hour left" is due in 48 minutes, the goal in 1 h 48 m.
  assert.equal((await call('PATCH', `/api/fasts/${fastId}`, me.token, { target_minutes: 18 * 60 })).status, 200)
  await pool.query("update public.fasts set started_at = started_at - interval '50 minutes' where id = $1", [fastId])
  await notifier.notifyDueFasts(fakeSender, [me.id])
  assert.deepEqual(deliveries.map((d) => d.message.title), ['You reached your 16:8 goal', '1 hour to go'])
})
