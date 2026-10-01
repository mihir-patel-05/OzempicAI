import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { getAnalyticsDateRange } from '../features/analytics/range'
import type {
  AnalyticsDailyRow,
  AnalyticsDashboardData,
  AnalyticsExerciseRow,
  AnalyticsMealEntryRow,
  AnalyticsRange,
} from '../features/analytics/types'
import { supabase } from '../lib/supabase'

export function useAnalyticsDashboard(range: AnalyticsRange) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const dates = getAnalyticsDateRange(range)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  return useQuery({
    enabled: !!userId,
    queryKey: ['analytics', userId, range, timezone, dates.end],
    queryFn: async (): Promise<AnalyticsDashboardData> => {
      const args = {
        p_start: dates.start,
        p_end: dates.end,
        p_timezone: timezone,
      }
      const [dailyResult, exerciseResult, mealResult] = await Promise.all([
        supabase.rpc('get_analytics_daily', args),
        supabase.rpc('get_analytics_exercise_progress', args),
        supabase.rpc('get_analytics_meal_entries', args),
      ])

      if (dailyResult.error) throw dailyResult.error
      if (exerciseResult.error) throw exerciseResult.error
      if (mealResult.error) throw mealResult.error

      return {
        daily: (dailyResult.data ?? []) as AnalyticsDailyRow[],
        exercises: (exerciseResult.data ?? []) as AnalyticsExerciseRow[],
        meals: (mealResult.data ?? []) as AnalyticsMealEntryRow[],
      }
    },
  })
}

