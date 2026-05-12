import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
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
    queryFn: async (): Promise<CalorieLog[]> => {
      const { data, error } = await supabase
        .from('calorie_logs')
        .select('*')
        .eq('user_id', userId!)
        .gte('logged_at', startISO)
        .lte('logged_at', endISO)
        .order('logged_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as CalorieLog[]
    },
  })
}

interface LogCalorieInput {
  food_name: string
  calories: number
  meal_type: MealType
}

export function useLogCalorie() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: LogCalorieInput) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase.from('calorie_logs').insert({
        user_id: userId,
        food_name: input.food_name,
        calories: input.calories,
        meal_type: input.meal_type,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calorie-logs'] })
      queryClient.invalidateQueries({ queryKey: ['daily-total', 'calories'] })
    },
  })
}

export function useDeleteCalorieLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calorie_logs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calorie-logs'] })
      queryClient.invalidateQueries({ queryKey: ['daily-total', 'calories'] })
    },
  })
}
