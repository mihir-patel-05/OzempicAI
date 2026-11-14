import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthProvider'
import type {
  WorkoutExerciseDraft,
  WorkoutSessionWithExercises,
  WorkoutType,
} from '../types/db'

const RECENT_LIMIT = 20

export interface LogWorkoutSessionInput {
  name: string
  workout_type: WorkoutType
  performed_at: string
  duration_minutes: number | null
  notes: string | null
  plan_id: string | null
  exercises: WorkoutExerciseDraft[]
}

/** The most recent logged workouts, newest first, with their exercises. */
export function useRecentWorkoutSessions() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  return useQuery({
    enabled: !!userId,
    queryKey: ['workout-sessions', userId],
    queryFn: () =>
      api<WorkoutSessionWithExercises[]>('/workout-sessions', { query: { limit: RECENT_LIMIT } }),
  })
}

export function useLogWorkoutSession() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()

  return useMutation({
    // The API saves the session and its exercises in one transaction.
    mutationFn: async (input: LogWorkoutSessionInput) => {
      if (!userId) throw new Error('Not signed in')
      return api<WorkoutSessionWithExercises>('/workout-sessions', {
        method: 'POST',
        body: input,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['workout-plans'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

export function useDeleteWorkoutSession() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Not signed in')
      // workout_session_exercises cascades.
      await api(`/workout-sessions/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}
