import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { todayRangeISO } from '../lib/date'
import type { BodyPart, ExerciseCategory, ExerciseLog } from '../types/db'

export function useExerciseLogsToday() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const { startISO, endISO } = todayRangeISO()
  return useQuery({
    enabled: !!userId,
    queryKey: ['exercise-logs', userId, startISO.slice(0, 10)],
    queryFn: async (): Promise<ExerciseLog[]> => {
      const { data, error } = await supabase
        .from('exercise_logs')
        .select('*')
        .eq('user_id', userId!)
        .gte('logged_at', startISO)
        .lte('logged_at', endISO)
        .order('logged_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ExerciseLog[]
    },
  })
}

export interface LogExerciseInput {
  exercise_name: string
  category: ExerciseCategory
  duration_minutes: number
  calories_burned: number
  sets: number | null
  reps_per_set: number | null
  body_part: BodyPart | null
}

export function useLogExercise() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: LogExerciseInput) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase
        .from('exercise_logs')
        .insert({ user_id: userId, ...input })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercise-logs'] })
      queryClient.invalidateQueries({ queryKey: ['daily-total', 'exercise'] })
    },
  })
}

export function useDeleteExerciseLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exercise_logs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercise-logs'] })
      queryClient.invalidateQueries({ queryKey: ['daily-total', 'exercise'] })
    },
  })
}
