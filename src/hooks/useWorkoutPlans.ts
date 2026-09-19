import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { toLocalDateKey } from '../lib/date'
import type {
  WorkoutExerciseDraft,
  WorkoutPlan,
  WorkoutPlanExercise,
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
    queryFn: async (): Promise<WorkoutPlanWithExercises[]> => {
      const { data: plans, error: plansError } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('user_id', userId!)
        .gte('planned_date', today)
        .order('planned_date')
        .order('created_at')
        .limit(UPCOMING_LIMIT)
      if (plansError) throw plansError

      const rows = (plans ?? []) as WorkoutPlan[]
      if (rows.length === 0) return []

      const { data: exercises, error: exercisesError } = await supabase
        .from('workout_plan_exercises')
        .select('*')
        .eq('user_id', userId!)
        .in(
          'plan_id',
          rows.map((plan) => plan.id),
        )
        .order('position')
      if (exercisesError) throw exercisesError

      return attachExercises(rows, (exercises ?? []) as WorkoutPlanExercise[])
    },
  })
}

export function useCreateWorkoutPlan() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateWorkoutPlanInput) => {
      if (!userId) throw new Error('Not signed in')
      const { exercises, ...plan } = input
      const { data: created, error: planError } = await supabase
        .from('workout_plans')
        .insert({ user_id: userId, ...plan })
        .select()
        .single()
      if (planError) throw planError

      const planId = (created as WorkoutPlan).id
      if (exercises.length === 0) return created as WorkoutPlan

      const { error: exercisesError } = await supabase
        .from('workout_plan_exercises')
        .insert(
          exercises.map((exercise, index) => ({
            plan_id: planId,
            user_id: userId,
            position: index,
            exercise_name: exercise.exercise_name,
            machine: exercise.machine,
            target_sets: exercise.sets,
            target_reps: exercise.reps,
            target_weight_kg: exercise.weight_kg,
            target_duration_minutes: exercise.duration_minutes,
            target_distance_km: exercise.distance_km,
          })),
        )
      if (exercisesError) {
        // No transaction across two inserts, so don't leave an empty plan
        // behind when the exercises fail to save.
        await supabase.from('workout_plans').delete().eq('id', planId)
        throw exercisesError
      }
      return created as WorkoutPlan
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['workout-plans'] }),
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
      const { error } = await supabase
        .from('workout_plans')
        .update({ completed_at: completed ? new Date().toISOString() : null })
        .eq('id', id)
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['workout-plans'] }),
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
      const { error } = await supabase
        .from('workout_plans')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['workout-plans'] }),
  })
}

function attachExercises(
  plans: WorkoutPlan[],
  exercises: WorkoutPlanExercise[],
): WorkoutPlanWithExercises[] {
  const byPlan = new Map<string, WorkoutPlanExercise[]>()
  for (const exercise of exercises) {
    const bucket = byPlan.get(exercise.plan_id)
    if (bucket) bucket.push(exercise)
    else byPlan.set(exercise.plan_id, [exercise])
  }
  return plans.map((plan) => ({
    ...plan,
    exercises: byPlan.get(plan.id) ?? [],
  }))
}
