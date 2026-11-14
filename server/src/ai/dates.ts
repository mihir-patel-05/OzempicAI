/**
 * Calendar-date helpers for the coach's tools. Every date here is a plain
 * YYYY-MM-DD local date in the user's IANA timezone; arithmetic is done on the
 * calendar (UTC midnight) so DST shifts can never move a day.
 */

export const RANGE_PRESETS = [
  'today',
  'this_week',
  'last_week',
  'next_week',
  'last_7_days',
  'last_30_days',
  'next_7_days',
  'custom',
] as const

export type RangePreset = (typeof RANGE_PRESETS)[number]

export interface DateRange {
  start: string
  end: string
}

/** Longest custom range, matching the analytics SQL functions (366 days). */
export const MAX_RANGE_DAYS = 366

/** Thrown for bad model or client input; the message is safe to show. */
export class DateInputError extends Error {}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

export function isValidTimezone(tz: string): boolean {
  if (!tz || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

/** Today's date in `tz`. */
export function todayIn(tz: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS)
}

/** ISO weekday: Monday = 1 … Sunday = 7. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

export function weekdayName(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  })
}

/** Monday of the week containing `date`. */
export function mondayOf(date: string): string {
  return addDays(date, 1 - isoWeekday(date))
}

/** Every date from start to end inclusive. */
export function eachDay(range: DateRange): string[] {
  const days: string[] = []
  for (let d = range.start; d <= range.end; d = addDays(d, 1)) days.push(d)
  return days
}

/**
 * Resolve a preset to inclusive local dates. Weeks run Monday–Sunday;
 * `this_week` runs from Monday to today.
 */
export function resolveRange(
  range: RangePreset,
  tz: string,
  custom: { start_date?: string | null; end_date?: string | null } = {},
  now: Date = new Date(),
): DateRange {
  const today = todayIn(tz, now)
  const monday = mondayOf(today)
  switch (range) {
    case 'today':
      return { start: today, end: today }
    case 'this_week':
      return { start: monday, end: today }
    case 'last_week':
      return { start: addDays(monday, -7), end: addDays(monday, -1) }
    case 'next_week':
      return { start: addDays(monday, 7), end: addDays(monday, 13) }
    case 'last_7_days':
      return { start: addDays(today, -6), end: today }
    case 'last_30_days':
      return { start: addDays(today, -29), end: today }
    case 'next_7_days':
      return { start: addDays(today, 1), end: addDays(today, 7) }
    case 'custom': {
      const { start_date: start, end_date: end } = custom
      if (!isValidDate(start) || !isValidDate(end)) {
        throw new DateInputError('range=custom needs valid start_date and end_date (YYYY-MM-DD)')
      }
      if (end < start) throw new DateInputError('end_date must not be before start_date')
      if (daysBetween(start, end) + 1 > MAX_RANGE_DAYS) {
        throw new DateInputError(`A custom range can cover at most ${MAX_RANGE_DAYS} days`)
      }
      return { start, end }
    }
  }
}
