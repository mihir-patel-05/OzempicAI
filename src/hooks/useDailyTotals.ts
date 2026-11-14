import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthProvider'
import { todayRangeISO } from '../lib/date'
import type { CalorieLog, ExerciseLog, WaterLog } from '../types/db'

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
      const rows = await api<CalorieLog[]>('/calorie-logs', {
        query: { from: startISO, to: endISO },
      })
      return sum(rows, (r) => r.calories)
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
      const rows = await api<WaterLog[]>('/water-logs', { query: { from: startISO, to: endISO } })
      return sum(rows, (r) => r.amount_ml)
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
      const rows = await api<ExerciseLog[]>('/exercise-logs', {
        query: { from: startISO, to: endISO },
      })
      return sum(rows, (r) => r.duration_minutes)
    },
  })
}
