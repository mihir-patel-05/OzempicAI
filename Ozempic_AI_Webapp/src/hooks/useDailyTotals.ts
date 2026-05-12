import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { todayRangeISO } from '../lib/date'

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((acc, row) => acc + pick(row), 0)
}

export function useDailyCalorieTotal() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const { startISO, endISO } = todayRangeISO()

  return useQuery({
    enabled: !!userId,
    queryKey: ['daily-total', 'calories', userId, startISO.slice(0, 10)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calorie_logs')
        .select('calories')
        .eq('user_id', userId!)
        .gte('logged_at', startISO)
        .lte('logged_at', endISO)
      if (error) throw error
      return sum(data ?? [], (r) => r.calories)
    },
  })
}

export function useDailyWaterTotal() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const { startISO, endISO } = todayRangeISO()

  return useQuery({
    enabled: !!userId,
    queryKey: ['daily-total', 'water', userId, startISO.slice(0, 10)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('water_logs')
        .select('amount_ml')
        .eq('user_id', userId!)
        .gte('logged_at', startISO)
        .lte('logged_at', endISO)
      if (error) throw error
      return sum(data ?? [], (r) => r.amount_ml)
    },
  })
}

export function useDailyExerciseTotal() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const { startISO, endISO } = todayRangeISO()

  return useQuery({
    enabled: !!userId,
    queryKey: ['daily-total', 'exercise', userId, startISO.slice(0, 10)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_logs')
        .select('duration_minutes')
        .eq('user_id', userId!)
        .gte('logged_at', startISO)
        .lte('logged_at', endISO)
      if (error) throw error
      return sum(data ?? [], (r) => r.duration_minutes)
    },
  })
}
