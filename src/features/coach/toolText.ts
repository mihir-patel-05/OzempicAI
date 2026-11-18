/** Status line shown while the coach runs a tool (names from server/src/ai/tools). */
const ACTIVITY: Record<string, string> = {
  get_profile: 'Checking your goals…',
  get_calorie_summary: 'Looking at your calorie logs…',
  get_calorie_entries: 'Reading your food entries…',
  get_weight_trend: 'Looking at your weight trend…',
  get_exercise_summary: 'Checking your exercise…',
  get_fasting_history: 'Checking your fasting…',
  get_grocery_list: 'Checking your grocery list…',
  add_grocery_items: 'Adding to your grocery list…',
  get_meal_plans: 'Checking your meal plan…',
  create_meal_plan: 'Writing your meal plan…',
  get_workout_plans: 'Checking your workout plan…',
  create_workout_plans: 'Adding to your workout plan…',
  update_workout_plan: 'Editing your workout…',
}

export function toolActivity(name: string | null): string {
  return (name && ACTIVITY[name]) || 'Thinking…'
}

/** Tools that change the user's data; only these get an action card. */
export const WRITE_TOOLS: Record<string, { label: string; tab: 'groceries' | 'meals' | 'workouts' }> = {
  add_grocery_items: { label: 'grocery list', tab: 'groceries' },
  create_meal_plan: { label: 'meal plan', tab: 'meals' },
  create_workout_plans: { label: 'workout plan', tab: 'workouts' },
  update_workout_plan: { label: 'workout plan', tab: 'workouts' },
}
