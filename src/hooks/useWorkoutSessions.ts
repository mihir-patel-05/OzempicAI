import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type {
  WorkoutExerciseDraft,
  WorkoutSession,
  WorkoutSessionExercise,
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
    queryFn: async (): Promise<WorkoutSessionWithExercises[]> => {
      const { data: sessions, error: sessionsError } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', userId!)
        .order('performed_at', { ascending: false })
        .limit(RECENT_LIMIT)
      if (sessionsError) throw sessionsError

      const rows = (sessions ?? []) as WorkoutSession[]
      if (rows.length === 0) return []

      const { data: exercises, error: exercisesError } = await supabase
        .from('workout_session_exercises')
        .select('*')
        .eq('user_id', userId!)
        .in(
          'session_id',
          rows.map((row) => row.id),
        )
        .order('position')
      if (exercisesError) throw exercisesError

      return attachExercises(rows, (exercises ?? []) as WorkoutSessionExercise[])
    },
  })
}

export function useLogWorkoutSession() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: LogWorkoutSessionInput) => {
      if (!userId) throw new Error('Not signed in')
      const { exercises, ...workout } = input
      const { data: created, error: sessionError } = await supabase
        .from('workout_sessions')
        .insert({ user_id: userId, ...workout })
        .select()
        .single()
      if (sessionError) throw sessionError

      const sessionId = (created as WorkoutSession).id
      if (exercises.length === 0) return created as WorkoutSession

      const { error: exercisesError } = await supabase
        .from('workout_session_exercises')
        .insert(
          exercises.map((exercise, index) => ({
            session_id: sessionId,
            user_id: userId,
            position: index,
            exercise_name: exercise.exercise_name,
            machine: exercise.machine,
            sets: exercise.sets,
            reps_per_set: exercise.reps,
            weight_kg: exercise.weight_kg,
            duration_minutes: exercise.duration_minutes,
            distance_km: exercise.distance_km,
          })),
        )
      if (exercisesError) {
        // Same rollback as plans: an exercise-less session is not worth
        // keeping if the user meant to record lifts.
        await supabase.from('workout_sessions').delete().eq('id', sessionId)
        throw exercisesError
      }
      return created as WorkoutSession
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-sessions'] })
      queryClient.invalidateQueries({ queryKey: ['workout-plans'] })
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
      const { error } = await supabase
        .from('workout_sessions')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['workout-sessions'] }),
  })
}

function attachExercises(
  sessions: WorkoutSession[],
  exercises: WorkoutSessionExercise[],
): WorkoutSessionWithExercises[] {
  const bySession = new Map<string, WorkoutSessionExercise[]>()
  for (const exercise of exercises) {
    const bucket = bySession.get(exercise.session_id)
    if (bucket) bucket.push(exercise)
    else bySession.set(exercise.session_id, [exercise])
  }
  return sessions.map((session) => ({
    ...session,
    exercises: bySession.get(session.id) ?? [],
  }))
}
