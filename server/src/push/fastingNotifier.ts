import { withTransaction } from '../db.js'
import { pushSender, sendToUser } from './send.js'
import type { PushMessage, PushSender, SendOptions } from './send.js'

/**
 * "1 hour left" and "Goal reached" for running fasts (docs/fasting-plan.md,
 * phase 5). Each tick claims the fasts that are due by stamping
 * reminder_notified_at / goal_notified_at and committing, then sends. With
 * `for update skip locked`, two API instances never claim the same fast, and a
 * crash after claiming loses one notification rather than sending it twice.
 */

const TICK_MS = 30_000
const HOUR_MS = 60 * 60_000
/** After downtime, don't announce a moment from hours ago. */
const STALE_MS = 6 * HOUR_MS
/** Fasts handled per kind per tick; the rest wait for the next one. */
const BATCH = 200

interface Claimed {
  id: string
  user_id: string
  target_minutes: number
  created_at: Date
  /** When the notification was due: the goal, or an hour before it. */
  due_at: Date
}

// Goal first: a fast whose goal has already passed gets "Goal reached" only,
// so its reminder is stamped as handled too.
const CLAIM_GOALS = `
  with due as (
    select id from public.fasts
     where ended_at is null and goal_notified_at is null
       and started_at + make_interval(mins => target_minutes) <= now()
     order by started_at
     limit ${BATCH}
     for update skip locked
  )
  update public.fasts f
     set goal_notified_at = now(),
         reminder_notified_at = coalesce(f.reminder_notified_at, now())
    from due
   where f.id = due.id
  returning f.id, f.user_id, f.target_minutes, f.created_at,
            f.started_at + make_interval(mins => f.target_minutes) as due_at`

// A one-hour goal has no "1 hour left": that moment is the start.
const CLAIM_REMINDERS = `
  with due as (
    select id from public.fasts
     where ended_at is null and goal_notified_at is null and reminder_notified_at is null
       and target_minutes > 60
       and started_at + make_interval(mins => target_minutes - 60) <= now()
     order by started_at
     limit ${BATCH}
     for update skip locked
  )
  update public.fasts f
     set reminder_notified_at = now()
    from due
   where f.id = due.id
  returning f.id, f.user_id, f.target_minutes, f.created_at,
            f.started_at + make_interval(mins => f.target_minutes - 60) as due_at`

/** "16:8" for the usual windows, otherwise "17h 30m". Matches the web app. */
export function goalLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0 && [13, 16, 18, 20].includes(hours)) return `${hours}:${24 - hours}`
  if (minutes === 23 * 60) return 'OMAD'
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

function goalMessage(fast: Claimed): PushMessage {
  return {
    title: `You reached your ${goalLabel(fast.target_minutes)} goal`,
    body: 'End your fast in OzempicAI whenever you’re ready.',
    tag: `fast-${fast.id}`,
    url: '/fasting',
  }
}

function reminderMessage(fast: Claimed): PushMessage {
  return {
    title: '1 hour to go',
    body: `Your ${goalLabel(fast.target_minutes)} fast reaches its goal in an hour.`,
    tag: `fast-${fast.id}`,
    url: '/fasting',
  }
}

/**
 * Worth sending: due after the fast was saved (a fast backdated past its goal
 * doesn't announce it), and not so long ago it is no longer news.
 */
export function worthSending(fast: Pick<Claimed, 'created_at' | 'due_at'>, now: number): boolean {
  return fast.due_at.getTime() > fast.created_at.getTime() && now - fast.due_at.getTime() <= STALE_MS
}

async function claim(sql: string): Promise<Claimed[]> {
  return withTransaction(async (db) => (await db.query<Claimed>(sql)).rows)
}

export interface TickReport {
  goals: number
  reminders: number
  sent: number
}

/** One pass: claim what is due, then send it. Exposed for tests. */
export async function notifyDueFasts(sender: PushSender): Promise<TickReport> {
  const goals = await claim(CLAIM_GOALS)
  const reminders = await claim(CLAIM_REMINDERS)
  const now = Date.now()
  let sent = 0

  const deliver = async (fast: Claimed, message: PushMessage, options: SendOptions) => {
    if (!worthSending(fast, now)) return
    const report = await sendToUser(sender, fast.user_id, message, options)
    sent += report.sent
  }
  // Goal: worth delivering for a while to a phone that's offline. Reminder:
  // pointless after the hour it announces.
  await Promise.all([
    ...goals.map((fast) => deliver(fast, goalMessage(fast), { ttlSeconds: 6 * 3600, urgency: 'high' })),
    ...reminders.map((fast) => deliver(fast, reminderMessage(fast), { ttlSeconds: 3600, urgency: 'normal' })),
  ])
  return { goals: goals.length, reminders: reminders.length, sent }
}

/** Run notifyDueFasts every 30 s while notifications are configured. Returns a stop function. */
export function startFastingNotifier(): (() => void) | null {
  const sender = pushSender()
  if (!sender) {
    console.log('Fasting notifications are off (set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT).')
    return null
  }
  let running = false
  const timer = setInterval(() => {
    // A slow tick (an unreachable push service) must not overlap the next.
    if (running) return
    running = true
    notifyDueFasts(sender)
      .then((report) => {
        if (report.sent) console.log(`Fasting notifications: ${report.sent} sent`)
      })
      .catch((err) => console.error('Fasting notifier failed', err instanceof Error ? err.message : err))
      .finally(() => {
        running = false
      })
  }, TICK_MS)
  timer.unref()
  return () => clearInterval(timer)
}
