// Mirrors supabase/migrations/00001_init_schema.sql (+ 00004_day_labels and
// supabase-weight-logs.md). Keep field names matching the Postgres columns
// (snake_case) so we can pass these straight to .insert()/.select().

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type ExerciseCategory =
  | 'cardio'
  | 'strength'
  | 'flexibility'
  | 'sports'
  | 'other'

export type BodyPart =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'legs'
  | 'core'
  | 'full_body'

export type HeartRateSource = 'healthkit' | 'manual'

export type GroceryCategory =
  | 'produce'
  | 'dairy'
  | 'protein'
  | 'grains'
  | 'beverages'
  | 'snacks'
  | 'other'

export interface UserProfile {
  id: string
  email: string
  name: string
  height_cm: number | null
  weight_kg: number | null
  age: number | null
  daily_calorie_goal: number
  daily_water_goal_ml: number
  created_at: string
}

export interface CalorieLog {
  id: string
  user_id: string
  food_name: string
  calories: number
  meal_type: MealType
  logged_at: string
}

export interface WaterLog {
  id: string
  user_id: string
  amount_ml: number
  logged_at: string
}

export interface ExerciseLog {
  id: string
  user_id: string
  exercise_name: string
  category: ExerciseCategory
  duration_minutes: number
  calories_burned: number
  sets: number | null
  reps_per_set: number | null
  body_part: BodyPart | null
  logged_at: string
}

export interface HeartRateLog {
  id: string
  user_id: string
  bpm: number
  source: HeartRateSource
  recorded_at: string
}

export interface MealPlan {
  id: string
  user_id: string
  name: string
  planned_date: string
  meal_type: MealType
  calories: number
  created_at: string
}

export interface GroceryItem {
  id: string
  user_id: string
  name: string
  category: GroceryCategory
  is_purchased: boolean
  meal_plan_id: string | null
  created_at: string
}

export interface WeightLog {
  id: string
  user_id: string
  weight_kg: number
  logged_at: string
}

export interface DayLabel {
  id: string
  user_id: string
  label_date: string
  label: string
  created_at: string
}
