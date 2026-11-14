import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { getAnalyticsDateRange } from '../features/analytics/range'
import type { AnalyticsDashboardData, AnalyticsRange } from '../features/analytics/types'
import { api } from '../lib/api'

export function useAnalyticsDashboard(range: AnalyticsRange) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const dates = getAnalyticsDateRange(range)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  return useQuery({
    enabled: !!userId,
    queryKey: ['analytics', userId, range, timezone, dates.end],
    queryFn: async (): Promise<AnalyticsDashboardData> => {
      const data = await api<Partial<AnalyticsDashboardData>>('/analytics', {
        query: { start: dates.start, end: dates.end, timezone },
      })
      return {
        daily: data.daily ?? [],
        exercises: data.exercises ?? [],
        meals: data.meals ?? [],
      }
    },
  })
}
