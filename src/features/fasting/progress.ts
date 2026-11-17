import type { Fast } from '../../types/db'

/** Where a fast stands at `now` (or at its end, once it has ended). */
export interface FastProgress {
  startMs: number
  /** When the goal is (or was) reached. */
  goalMs: number
  elapsedMs: number
  targetMs: number
  /** Time left to the goal; 0 once reached. */
  remainingMs: number
  /** Time past the goal; 0 before it. */
  overtimeMs: number
  reached: boolean
  /** Share of the goal done, 0 to 1. */
  fraction: number
}

export function fastProgress(
  fast: Pick<Fast, 'started_at' | 'target_minutes' | 'ended_at'>,
  now: number,
): FastProgress {
  const startMs = Date.parse(fast.started_at)
  const targetMs = fast.target_minutes * 60_000
  const goalMs = startMs + targetMs
  const at = fast.ended_at ? Date.parse(fast.ended_at) : now
  const elapsedMs = Math.max(0, at - startMs)
  return {
    startMs,
    goalMs,
    elapsedMs,
    targetMs,
    remainingMs: Math.max(0, targetMs - elapsedMs),
    overtimeMs: Math.max(0, elapsedMs - targetMs),
    reached: elapsedMs >= targetMs,
    fraction: targetMs > 0 ? Math.min(1, elapsedMs / targetMs) : 0,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** A stopwatch reading: "04:17:52", "36:00:00". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return `${pad(hours)}:${pad(minutes)}:${pad(total % 60)}`
}

/** A length in words: "16h", "16h 12m", "45m". Rounds down to the minute. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}

/** Whole calendar days from `now`'s local day to `at`'s: 0 today, 1 tomorrow, -1 yesterday. */
export function dayOffset(at: number, now: number): number {
  const day = (ms: number) => {
    const d = new Date(ms)
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  }
  return Math.round((day(at) - day(now)) / 86_400_000)
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** "today", "tomorrow", "yesterday", or "Tue, Nov 17". */
export function dayLabel(ms: number, now: number): string {
  const offset = dayOffset(ms, now)
  if (offset === 0) return 'today'
  if (offset === 1) return 'tomorrow'
  if (offset === -1) return 'yesterday'
  return new Date(ms).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

/** "today, 8:30 PM", "tomorrow, 12:30 PM", "Tue, Nov 17, 8:30 PM". */
export function formatWhen(ms: number, now: number): string {
  return `${dayLabel(ms, now)}, ${formatTime(ms)}`
}
