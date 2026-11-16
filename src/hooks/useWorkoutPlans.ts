import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthProvider'
import { toLocalDateKey } from '../lib/date'
import type {
  WorkoutExerciseDraft,
  WorkoutPlanWithExercises,
  WorkoutType,
} from '../types/db'

const UPCOMING_LIMIT = 50

export interface CreateWorkoutPlanInput {
  name: string
  workout_type: WorkoutType
  planned_date: string
  notes: string | null
  exercises: WorkoutExerciseDraft[]
}

/** Plans for today onwards, each with its exercises in display order. */
export function useUpcomingWorkoutPlans() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const today = toLocalDateKey()

  return useQuery({
    enabled: !!userId,
    queryKey: ['workout-plans', userId, today],
    queryFn: () =>
      api<WorkoutPlanWithExercises[]>('/workout-plans', {
        query: { from_date: today, limit: UPCOMING_LIMIT },
      }),
    // Connected AI apps (e.g. Claude on the phone) edit the plan too.
    refetchOnWindowFocus: true,
  })
}

export function useCreateWorkoutPlan() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()

  return useMutation({
    // The API saves the plan and its exercises in one transaction.
    mutationFn: async (input: CreateWorkoutPlanInput) => {
      if (!userId) throw new Error('Not signed in')
      return api<WorkoutPlanWithExercises>('/workout-plans', { method: 'POST', body: input })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-plans'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

/** Tick a plan off (or un-tick it) without deleting the plan itself. */
export function useSetWorkoutPlanCompleted() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      if (!userId) throw new Error('Not signed in')
      await api(`/workout-plans/${id}`, { method: 'PATCH', body: { completed } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-plans'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

export function useDeleteWorkoutPlan() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Not signed in')
      // workout_plan_exercises cascades; sessions keep a null plan_id.
      await api(`/workout-plans/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-plans'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}
