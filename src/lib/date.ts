// Day-boundary helpers. All "today" windows are computed in the device's
// local timezone (matches how the iOS app filters logs by calendar day).

export function startOfDay(d: Date = new Date()): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

export function endOfDay(d: Date = new Date()): Date {
  const out = new Date(d)
  out.setHours(23, 59, 59, 999)
  return out
}

export function todayRangeISO(): { startISO: string; endISO: string } {
  const now = new Date()
  return {
    startISO: startOfDay(now).toISOString(),
    endISO: endOfDay(now).toISOString(),
  }
}

/** A "YYYY-MM-DD" day key as local midnight, or null if it isn't a real date. */
export function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return null
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(y, m - 1, d)
  // Reject dates that roll over, like 2026-02-30.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return date
}

/** Start and end of a local calendar day ("YYYY-MM-DD") as ISO timestamps. */
export function dayRangeISO(key: string): { startISO: string; endISO: string } {
  const day = parseDateKey(key) ?? new Date()
  return {
    startISO: startOfDay(day).toISOString(),
    endISO: endOfDay(day).toISOString(),
  }
}

/** The day key `days` calendar days after `key` (negative for before). */
export function shiftDateKey(key: string, days: number): string {
  const day = parseDateKey(key) ?? new Date()
  day.setDate(day.getDate() + days)
  return toLocalDateKey(day)
}

export function toLocalDateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** A time as an `<input type="datetime-local">` value ("2026-11-17T20:30"), in local time. */
export function toLocalInputValue(ms: number): string {
  const d = new Date(ms)
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${toLocalDateKey(d)}T${hours}:${minutes}`
}

/** An `<input type="datetime-local">` value back to milliseconds, or null if blank or invalid. */
export function fromLocalInputValue(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null
  // A date-time with no offset is read as local time.
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}
