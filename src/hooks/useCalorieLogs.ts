import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthProvider'
import { dayRangeISO, toLocalDateKey } from '../lib/date'
import type { CalorieLog, MealType } from '../types/db'

export function useCalorieLogsToday() {
  return useCalorieLogsForDay(toLocalDateKey())
}

/** Calorie logs for one local calendar day, given as "YYYY-MM-DD". */
export function useCalorieLogsForDay(dateKey: string) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const { startISO, endISO } = dayRangeISO(dateKey)

  return useQuery({
    enabled: !!userId,
    queryKey: ['calorie-logs', userId, dateKey],
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
    onSuccess: () => invalidateCalorieQueries(queryClient),
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
    onSuccess: () => invalidateCalorieQueries(queryClient),
  })
}

/** Change the calories on an entry already logged; its food, meal and time stay as they were. */
export function useUpdateCalorieLog() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, calories }: { id: string; calories: number }) => {
      if (!userId) throw new Error('Not signed in')
      return api<CalorieLog>(`/calorie-logs/${id}`, { method: 'PATCH', body: { calories } })
    },
    onSuccess: () => invalidateCalorieQueries(queryClient),
  })
}

function invalidateCalorieQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['calorie-logs'] })
  queryClient.invalidateQueries({ queryKey: ['daily-total', 'calories'] })
  queryClient.invalidateQueries({ queryKey: ['analytics'] })
}
