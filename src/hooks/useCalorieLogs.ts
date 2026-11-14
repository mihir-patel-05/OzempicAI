import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthProvider'
import { todayRangeISO } from '../lib/date'
import type { CalorieLog, MealType } from '../types/db'

export function useCalorieLogsToday() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const { startISO, endISO } = todayRangeISO()

  return useQuery({
    enabled: !!userId,
    queryKey: ['calorie-logs', userId, startISO.slice(0, 10)],
    queryFn: () =>
      api<CalorieLog[]>('/calorie-logs', { query: { from: startISO, to: endISO } }),
  })
}

interface LogCalorieInput {
  food_name: string
  calories: number
  meal_type: MealType
  logged_at?: string
}

export function useLogCalorie() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: LogCalorieInput) => {
      if (!userId) throw new Error('Not signed in')
      await api('/calorie-logs', {
        method: 'POST',
        body: {
          food_name: input.food_name,
          calories: input.calories,
          meal_type: input.meal_type,
          ...(input.logged_at ? { logged_at: input.logged_at } : {}),
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calorie-logs'] })
      queryClient.invalidateQueries({ queryKey: ['daily-total', 'calories'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

export function useDeleteCalorieLog() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Not signed in')
      await api(`/calorie-logs/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calorie-logs'] })
      queryClient.invalidateQueries({ queryKey: ['daily-total', 'calories'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}
