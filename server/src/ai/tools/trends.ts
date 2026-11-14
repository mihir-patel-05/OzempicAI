import { KG_PER_LB, round } from './profile.js'
import { PAST_PRESETS, rangeFromInput, rangeProperties, rangeSchema } from './range.js'
import { defineTool } from './types.js'

const rangeInput = {
  type: 'object' as const,
  properties: rangeProperties(PAST_PRESETS),
  required: ['range', 'start_date', 'end_date'],
  additionalProperties: false,
}

interface DailyRow {
  day: string
  weight_kg: number | null
  calories_logged: number
  calorie_entries: number
  exercise_minutes: number
  exercise_calories: number
  exercise_entries: number
  workout_count: number
  workout_minutes: number
}

export const getWeightTrend = defineTool({
  definition: {
    name: 'get_weight_trend',
    description:
      "Get the user's logged weights for a date range (last weigh-in per day) with the first, latest and change, plus the average logged calories per logged day over the same range. Weights are in kg, and also in lb for imperial users. For trends over a month or more use range=custom.",
    strict: true,
    input_schema: rangeInput,
  },
  schema: rangeSchema(PAST_PRESETS),
  async run(input, { db, userId, tz }) {
    const range = rangeFromInput(input, tz)
    const [{ rows }, profile] = await Promise.all([
      db.query<DailyRow>(
        `select day::text as day, weight_kg, calories_logged, calorie_entries
           from public.get_analytics_daily($1::date, $2::date, $3::text)`,
        [range.start, range.end, tz],
      ),
      db.query<{ unit_system: string }>('select unit_system from public.users where id = $1', [userId]),
    ])
    const imperial = profile.rows[0]?.unit_system === 'imperial'
    const weights = rows.filter((r) => r.weight_kg != null)
    const loggedDays = rows.filter((r) => r.calorie_entries > 0)
    const first = weights[0]
    const latest = weights[weights.length - 1]
    const change = first && latest ? latest.weight_kg! - first.weight_kg! : null
    const lb = (kg: number | null) => (imperial ? round(kg == null ? null : kg / KG_PER_LB, 1) : undefined)

    return {
      result: {
        start: range.start,
        end: range.end,
        weigh_ins: weights.length,
        first: first ? { date: first.day, kg: round(first.weight_kg, 1), lb: lb(first.weight_kg) } : null,
        latest: latest ? { date: latest.day, kg: round(latest.weight_kg, 1), lb: lb(latest.weight_kg) } : null,
        change_kg: round(change, 1),
        ...(imperial ? { change_lb: round(change == null ? null : change / KG_PER_LB, 1) } : {}),
        avg_calories_per_logged_day: loggedDays.length
          ? Math.round(loggedDays.reduce((s, r) => s + r.calories_logged, 0) / loggedDays.length)
          : null,
        days_with_calorie_logs: loggedDays.length,
        // Keep the series short: up to ~40 points is plenty for the model.
        points: thin(weights, 40).map((r) => ({ date: r.day, kg: round(r.weight_kg, 1) })),
      },
    }
  },
})

export const getExerciseSummary = defineTool({
  definition: {
    name: 'get_exercise_summary',
    description:
      "Summarize the user's exercise for a date range: active days, quick-logged exercise minutes and calories burned, and workout sessions and minutes, with one row per active day.",
    strict: true,
    input_schema: rangeInput,
  },
  schema: rangeSchema(PAST_PRESETS),
  async run(input, { db, tz }) {
    const range = rangeFromInput(input, tz)
    const { rows } = await db.query<DailyRow>(
      `select day::text as day, exercise_minutes, exercise_calories, exercise_entries,
              workout_count, workout_minutes
         from public.get_analytics_daily($1::date, $2::date, $3::text)`,
      [range.start, range.end, tz],
    )
    const active = rows.filter((r) => r.exercise_entries > 0 || r.workout_count > 0)
    const sum = (key: keyof DailyRow) => active.reduce((s, r) => s + Number(r[key] ?? 0), 0)
    return {
      result: {
        start: range.start,
        end: range.end,
        days_in_range: rows.length,
        active_days: active.length,
        exercise_minutes: sum('exercise_minutes'),
        exercise_calories_burned: sum('exercise_calories'),
        workouts: sum('workout_count'),
        workout_minutes: sum('workout_minutes'),
        days: active.map((r) => ({
          date: r.day,
          exercise_min: r.exercise_minutes,
          burned: r.exercise_calories,
          workouts: r.workout_count,
          workout_min: r.workout_minutes,
        })),
      },
    }
  },
})

/** Evenly sample at most `max` items, always keeping the first and last. */
function thin<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items
  const step = (items.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => items[Math.round(i * step)]!)
}
