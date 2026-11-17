import { Hono } from 'hono'
import { rateLimit } from '../auth.js'
import type { AppEnv } from '../auth.js'
import { withTransaction, withUser } from '../db.js'
import { HttpError, readJson } from '../http.js'
import { isPushEndpoint, pushConfig, pushSender, sendToUser } from '../push/send.js'

/** Devices per account; registering another drops the one least recently registered. */
const MAX_DEVICES = 10

// base64url: a P-256 public key is 65 bytes (87 characters), the auth secret 16 (22).
const P256DH = /^[A-Za-z0-9_-]{80,100}={0,2}$/
const AUTH = /^[A-Za-z0-9_-]{16,32}={0,2}$/

const OFF = 'Notifications are not set up on this server.'

/** The shape PushSubscription.toJSON() produces, checked field by field. */
function readSubscription(body: Record<string, unknown>) {
  const { endpoint, keys } = body
  if (typeof endpoint !== 'string' || endpoint.length > 1000 || !isPushEndpoint(endpoint)) {
    throw new HttpError(400, "That isn't a push service this app can send to.")
  }
  const k = keys && typeof keys === 'object' && !Array.isArray(keys) ? (keys as Record<string, unknown>) : {}
  if (typeof k.p256dh !== 'string' || !P256DH.test(k.p256dh) || typeof k.auth !== 'string' || !AUTH.test(k.auth)) {
    throw new HttpError(400, 'Invalid push subscription keys')
  }
  return { endpoint, p256dh: k.p256dh, auth: k.auth }
}

export const pushRoutes = new Hono<AppEnv>()

/** Whether notifications are on, and the public key browsers subscribe with. */
pushRoutes.get('/push/config', (c) => {
  const config = pushConfig()
  return c.json({ enabled: config !== null, public_key: config?.publicKey ?? null })
})

/** Save (or refresh) this browser's push subscription for the signed-in user. */
pushRoutes.post('/push/subscriptions', async (c) => {
  const userId = c.get('user').id
  if (!pushConfig()) throw new HttpError(503, OFF)
  rateLimit(`push-subscribe:${userId}`, 30, 60 * 60_000)
  const sub = readSubscription(await readJson(c))
  const userAgent = (c.req.header('user-agent') ?? '').slice(0, 300) || null

  // As the owner, not through row level security: if this browser was
  // registered by another account (someone else signed in here before), the
  // row moves to whoever is signed in now. Only that browser knows its endpoint.
  await withTransaction(async (db) => {
    await db.query(
      `insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       values ($1, $2, $3, $4, $5)
       on conflict (endpoint) do update
         set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
             user_agent = excluded.user_agent, created_at = now()`,
      [userId, sub.endpoint, sub.p256dh, sub.auth, userAgent],
    )
    await db.query(
      `delete from public.push_subscriptions
        where user_id = $1
          and id not in (
            select id from public.push_subscriptions where user_id = $1
             order by created_at desc limit $2)`,
      [userId, MAX_DEVICES],
    )
  })
  return c.json({ ok: true }, 201)
})

/** Forget this browser (turning notifications off, or signing out). */
pushRoutes.delete('/push/subscriptions', async (c) => {
  const userId = c.get('user').id
  const { endpoint } = await readJson(c)
  if (typeof endpoint !== 'string' || endpoint.length > 1000) throw new HttpError(400, 'endpoint is required')
  await withUser(userId, (db) =>
    db.query('delete from public.push_subscriptions where user_id = $1 and endpoint = $2', [userId, endpoint]),
  )
  return c.body(null, 204)
})

/** Send a test notification to every device this account turned them on for. */
pushRoutes.post('/push/test', async (c) => {
  const userId = c.get('user').id
  const sender = pushSender()
  if (!sender) throw new HttpError(503, OFF)
  rateLimit(`push-test:${userId}`, 5, 10 * 60_000, 'Too many test notifications. Try again in a few minutes.')
  const report = await sendToUser(
    sender,
    userId,
    {
      title: 'Notifications are on',
      body: "You'll hear from OzempicAI an hour before your fasting goal and when you reach it.",
      tag: 'test',
      url: '/fasting',
    },
    { ttlSeconds: 60, urgency: 'normal' },
  )
  return c.json(report)
})
