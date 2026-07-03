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

export function toLocalDateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
