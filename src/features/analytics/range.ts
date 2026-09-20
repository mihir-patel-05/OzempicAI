import { toLocalDateKey } from '../../lib/date'
import type { AnalyticsDateRange, AnalyticsRange } from './types'

export const ANALYTICS_RANGE_OPTIONS: {
  value: AnalyticsRange
  label: string
}[] = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '6m', label: '6 months' },
  { value: '1y', label: '1 year' },
]

const RANGE_DAYS: Record<AnalyticsRange, number> = {
  '30d': 30,
  '90d': 90,
  '6m': 183,
  '1y': 366,
}

export function getAnalyticsDateRange(
  range: AnalyticsRange,
  now = new Date(),
): AnalyticsDateRange {
  const days = RANGE_DAYS[range]
  const start = new Date(now)
  start.setHours(12, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))

  return {
    start: toLocalDateKey(start),
    end: toLocalDateKey(now),
    days,
  }
}

