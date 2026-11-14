import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
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
    queryFn: () =>
      api<ExerciseLog[]>('/exercise-logs', { query: { from: startISO, to: endISO } }),
  })
}

export interface LogExerciseInput {
  exercise_name: string
  category: ExerciseCategory
  duration_minutes: number
  calories_burned: number
  sets: number | null
  reps_per_set: number | null
  weight_kg: number | null
  body_part: BodyPart | null
}

export function useLogExercise() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: LogExerciseInput) => {
      if (!userId) throw new Error('Not signed in')
      await api('/exercise-logs', { method: 'POST', body: input })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercise-logs'] })
      queryClient.invalidateQueries({ queryKey: ['daily-total', 'exercise'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

export function useDeleteExerciseLog() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Not signed in')
      await api(`/exercise-logs/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercise-logs'] })
      queryClient.invalidateQueries({ queryKey: ['daily-total', 'exercise'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}
