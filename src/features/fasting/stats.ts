import { startOfDay, toLocalDateKey } from '../../lib/date'
import type { Fast } from '../../types/db'
import { fastProgress } from './progress'

/**
 * Fasting analytics from the history the screen already has. Only ended fasts
 * count, and each one counts toward the local day it ended (a fast from 8 PM
 * Monday to noon Tuesday is Tuesday's).
 */

export const RANGE_DAYS = [7, 30, 90] as const
export type RangeDays = (typeof RANGE_DAYS)[number]

interface EndedFast {
  fast: Fast
  endMs: number
  day: string
  elapsedMs: number
  reached: boolean
}

function ended(fasts: Fast[]): EndedFast[] {
  return fasts
    .filter((fast) => fast.ended_at !== null)
    .map((fast) => {
      const p = fastProgress(fast, 0)
      const endMs = Date.parse(fast.ended_at!)
      return { fast, endMs, day: toLocalDateKey(new Date(endMs)), elapsedMs: p.elapsedMs, reached: p.reached }
    })
}

/** The local day keys of the last `days` days, oldest first, today last. */
export function dayKeys(now: number, days: number): string[] {
  const keys: string[] = []
  const cursor = startOfDay(new Date(now))
  cursor.setDate(cursor.getDate() - (days - 1))
  for (let i = 0; i < days; i++) {
    keys.push(toLocalDateKey(cursor))
    // setDate, not +24 h, so days stay whole across daylight-saving changes.
    cursor.setDate(cursor.getDate() + 1)
  }
  return keys
}

function previousDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return toLocalDateKey(new Date(y, m - 1, d - 1))
}

export interface Streaks {
  /** Days in a row, up to today, with a fast that met its goal. Today not having one yet doesn't break it. */
  current: number
  best: number
}

export function streaks(fasts: Fast[], now: number): Streaks {
  const metDays = new Set(ended(fasts).filter((f) => f.reached).map((f) => f.day))
  if (metDays.size === 0) return { current: 0, best: 0 }

  let day = toLocalDateKey(new Date(now))
  if (!metDays.has(day)) day = previousDay(day)
  let current = 0
  while (metDays.has(day)) {
    current += 1
    day = previousDay(day)
  }

  let best = 0
  for (const start of metDays) {
    // Count only from the first day of each run.
    if (metDays.has(previousDay(start))) continue
    let length = 0
    const [y, m, d] = start.split('-').map(Number)
    while (metDays.has(toLocalDateKey(new Date(y, m - 1, d + length)))) length += 1
    best = Math.max(best, length)
  }
  return { current, best }
}

export interface FastingSummary {
  count: number
  goalsMet: number
  /** Share of fasts that met their goal, or null with no fasts. */
  goalRate: number | null
  averageMs: number | null
  longestMs: number | null
  totalMs: number
}

/** Fasts that ended in the last `days` local days, today included. */
export function summarize(fasts: Fast[], now: number, days: number): FastingSummary {
  const inRange = new Set(dayKeys(now, days))
  const rows = ended(fasts).filter((f) => inRange.has(f.day))
  const totalMs = rows.reduce((sum, f) => sum + f.elapsedMs, 0)
  const goalsMet = rows.filter((f) => f.reached).length
  return {
    count: rows.length,
    goalsMet,
    goalRate: rows.length ? goalsMet / rows.length : null,
    averageMs: rows.length ? totalMs / rows.length : null,
    longestMs: rows.length ? Math.max(...rows.map((f) => f.elapsedMs)) : null,
    totalMs,
  }
}

export interface FastingDay {
  /** YYYY-MM-DD, local. */
  day: string
  /** Hours fasted by fasts that ended this day; null on a day without one. */
  hours: number | null
  /** The day's goal in hours (the longest, if more than one fast ended). */
  goalHours: number | null
  /** Every fast that ended this day met its goal. */
  met: boolean | null
  fasts: number
}

/** One row per day for the chart, oldest first, with empty days kept as gaps. */
export function dailyFasting(fasts: Fast[], now: number, days: number): FastingDay[] {
  const byDay = new Map<string, EndedFast[]>()
  for (const f of ended(fasts)) {
    const bucket = byDay.get(f.day)
    if (bucket) bucket.push(f)
    else byDay.set(f.day, [f])
  }
  return dayKeys(now, days).map((day) => {
    const rows = byDay.get(day)
    if (!rows) return { day, hours: null, goalHours: null, met: null, fasts: 0 }
    return {
      day,
      hours: round1(rows.reduce((sum, f) => sum + f.elapsedMs, 0) / 3_600_000),
      goalHours: round1(Math.max(...rows.map((f) => f.fast.target_minutes)) / 60),
      met: rows.every((f) => f.reached),
      fasts: rows.length,
    }
  })
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
