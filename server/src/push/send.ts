// A default import: web-push is CommonJS, and under ESM its named exports
// (sendNotification, …) aren't detectable, so `import { sendNotification }`
// would type-check and then fail at runtime.
import webpush from 'web-push'
import { pool } from '../db.js'

/**
 * Web Push (docs/fasting-plan.md, phase 5). Payloads are encrypted to each
 * browser's keys by web-push, so the push service relays them unread.
 *
 * Configured by VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT
 * (`npm run vapid:keys` makes a key pair). Without all three, notifications
 * are off and nothing else changes.
 */

export interface PushConfig {
  publicKey: string
  privateKey: string
  /** A mailto: or https: contact the push services can reach about abuse. */
  subject: string
}

export function pushConfig(env: NodeJS.ProcessEnv = process.env): PushConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = env.VAPID_PRIVATE_KEY?.trim()
  const subject = env.VAPID_SUBJECT?.trim()
  if (!publicKey || !privateKey || !subject) return null
  if (!/^(mailto:|https:\/\/)/.test(subject)) {
    throw new Error('VAPID_SUBJECT must start with mailto: or https://')
  }
  return { publicKey, privateKey, subject }
}

/**
 * Push services this API will send to. The endpoint comes from the browser,
 * and the server POSTs to it, so anything else is refused: otherwise a client
 * could point the server at an arbitrary URL (an internal address, say).
 */
const PUSH_HOSTS: RegExp[] = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge on Android, Samsung Internet, Opera
  /^android\.googleapis\.com$/, // older Chrome
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/, // Safari, including iPhone home-screen apps
  /^[a-z0-9-]+\.notify\.windows\.com$/, // Edge on Windows
]

export function isPushEndpoint(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return (
    url.protocol === 'https:' &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    PUSH_HOSTS.some((host) => host.test(url.hostname))
  )
}

export interface PushMessage {
  title: string
  body: string
  /** Same tag, same notification: a newer one replaces it instead of stacking. */
  tag?: string
  /** A path in this app to open when the notification is tapped. */
  url?: string
}

export interface PushTarget {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface SendOptions {
  /** How long the push service may hold it for an offline device. */
  ttlSeconds: number
  urgency?: 'very-low' | 'low' | 'normal' | 'high'
}

export type PushResult = 'sent' | 'gone' | 'failed'
export type PushSender = (target: PushTarget, message: PushMessage, options: SendOptions) => Promise<PushResult>

export function webPushSender(config: PushConfig): PushSender {
  return async (target, message, options) => {
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(message),
        {
          vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
          TTL: options.ttlSeconds,
          urgency: options.urgency ?? 'normal',
          timeout: 10_000,
        },
      )
      return 'sent'
    } catch (err) {
      const status = err instanceof webpush.WebPushError ? err.statusCode : undefined
      // The browser unsubscribed or the subscription expired: forget it.
      if (status === 404 || status === 410) return 'gone'
      // Host and status only: the endpoint's path is a credential for that device.
      console.warn(`Push failed: host=${new URL(target.endpoint).hostname} status=${status ?? 'none'}`)
      return 'failed'
    }
  }
}

let testSender: PushSender | null = null

/** Tests swap in a fake so nothing leaves the machine. */
export function setPushSenderForTests(sender: PushSender | null) {
  testSender = sender
}

/** The sender to use, or null when notifications are off. */
export function pushSender(): PushSender | null {
  if (testSender) return testSender
  const config = pushConfig()
  return config ? webPushSender(config) : null
}

export interface DeliveryReport {
  devices: number
  sent: number
}

/**
 * Send `message` to every device the user turned notifications on for, and
 * drop the ones the push service says no longer exist. Runs as the database
 * owner: the notifier calls it outside any request.
 */
export async function sendToUser(
  sender: PushSender,
  userId: string,
  message: PushMessage,
  options: SendOptions,
): Promise<DeliveryReport> {
  const { rows } = await pool.query<PushTarget>(
    'select id, endpoint, p256dh, auth from public.push_subscriptions where user_id = $1',
    [userId],
  )
  const results = await Promise.all(rows.map((row) => sender(row, message, options)))
  const gone = rows.filter((_, i) => results[i] === 'gone').map((row) => row.id)
  const sent = rows.filter((_, i) => results[i] === 'sent').map((row) => row.id)
  if (gone.length) await pool.query('delete from public.push_subscriptions where id = any($1::uuid[])', [gone])
  if (sent.length) {
    await pool.query('update public.push_subscriptions set last_success_at = now() where id = any($1::uuid[])', [sent])
  }
  return { devices: rows.length, sent: sent.length }
}
