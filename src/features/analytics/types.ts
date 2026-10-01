import type { MealType, WorkoutType } from '../../types/db'

export type AnalyticsRange = '30d' | '90d' | '6m' | '1y'

export interface AnalyticsDateRange {
  start: string
  end: string
  days: number
}

export interface AnalyticsDailyRow {
  day: string
  weight_kg: number | null
  calories_logged: number
  calorie_entries: number
  water_ml: number
  water_entries: number
  exercise_minutes: number
  exercise_calories: number
  exercise_entries: number
  workout_count: number
  workout_minutes: number
  strength_volume_kg: number
  cardio_minutes: number
  cardio_distance_km: number
  heart_rate_avg: number | null
  heart_rate_min: number | null
  heart_rate_max: number | null
  heart_rate_readings: number
  planned_workouts: number
  completed_plans: number
  workout_type_counts: Partial<Record<WorkoutType, number>>
}

export interface AnalyticsExerciseRow {
  performed_on: string
  session_id: string
  workout_type: WorkoutType
  exercise_key: string
  exercise_name: string
  machine: string | null
  sets: number | null
  reps_per_set: number | null
  weight_kg: number | null
  volume_kg: number | null
  estimated_1rm_kg: number | null
  duration_minutes: number | null
  distance_km: number | null
  pace_minutes_per_km: number | null
}

export interface AnalyticsMealEntryRow {
  day: string
  minute_of_day: number
  iso_dow: number
  meal_type: MealType
  calories: number
}

export interface AnalyticsDashboardData {
  daily: AnalyticsDailyRow[]
  exercises: AnalyticsExerciseRow[]
  meals: AnalyticsMealEntryRow[]
}

export interface ExerciseOption {
  key: string
  label: string
  machine: string | null
}

