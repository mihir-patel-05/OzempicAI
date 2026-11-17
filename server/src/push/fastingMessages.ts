import type { PushMessage } from './send.js'

/**
 * What the fasting notifications say, and when one is still worth sending.
 * No database access here, so it can be tested on its own.
 */

const HOUR_MS = 60 * 60_000
/** After downtime, don't announce a moment from hours ago. */
const STALE_MS = 6 * HOUR_MS

export interface DueFast {
  id: string
  target_minutes: number
  created_at: Date
  /** When the notification was due: the goal, or an hour before it. */
  due_at: Date
}

/** "16:8" for the usual windows, otherwise "17h 30m". Matches the web app. */
export function goalLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0 && [13, 16, 18, 20].includes(hours)) return `${hours}:${24 - hours}`
  if (minutes === 23 * 60) return 'OMAD'
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

export function goalMessage(fast: DueFast): PushMessage {
  return {
    title: `You reached your ${goalLabel(fast.target_minutes)} goal`,
    body: 'End your fast in OzempicAI whenever you’re ready.',
    tag: `fast-${fast.id}`,
    url: '/fasting',
  }
}

export function reminderMessage(fast: DueFast): PushMessage {
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
export function worthSending(fast: Pick<DueFast, 'created_at' | 'due_at'>, now: number): boolean {
  return fast.due_at.getTime() > fast.created_at.getTime() && now - fast.due_at.getTime() <= STALE_MS
}
