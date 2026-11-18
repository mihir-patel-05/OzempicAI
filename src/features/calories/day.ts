import { parseDateKey, shiftDateKey } from '../../lib/date'

/**
 * The day the Calories screen shows, from its `?date=` param. Anything
 * missing, malformed or in the future falls back to today.
 */
export function resolveDayParam(param: string | null, todayKey: string): string {
  if (!param || !parseDateKey(param) || param > todayKey) return todayKey
  return param
}

/** "Today", "Yesterday", "Mon, Nov 16", or "Mon, Nov 16, 2025" for another year. */
export function dayLabel(key: string, todayKey: string): string {
  if (key === todayKey) return 'Today'
  if (key === shiftDateKey(todayKey, -1)) return 'Yesterday'
  const day = parseDateKey(key)
  if (!day) return key
  const sameYear = key.slice(0, 4) === todayKey.slice(0, 4)
  return day.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** The label as it reads mid-sentence: "today", "yesterday", "on Mon, Nov 16". */
export function dayPhrase(key: string, todayKey: string): string {
  const label = dayLabel(key, todayKey)
  if (key === todayKey || key === shiftDateKey(todayKey, -1)) return label.toLowerCase()
  return `on ${label}`
}

/** "HH:MM" on the given day as a local Date, or null if the time is invalid. */
export function atTimeOn(key: string, time: string): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  const day = parseDateKey(key)
  if (!match || !day) return null
  day.setHours(Number(match[1]), Number(match[2]), 0, 0)
  return day
}
