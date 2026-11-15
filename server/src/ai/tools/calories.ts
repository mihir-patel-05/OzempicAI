import { z } from 'zod'
import type { Db } from '../../db.js'
import { eachDay, isoWeekday } from '../dates.js'
import type { DateRange } from '../dates.js'
import { PAST_PRESETS, rangeFromInput, rangeProperties, rangeSchema } from './range.js'
import { defineTool } from './types.js'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = (typeof MEAL_TYPES)[number]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export interface MealEntryRow {
  day: string
  meal_type: string
  calories: number
}

export interface DaySummary {
  date: string
  weekday: string
  /** null when nothing was logged: no data, not zero calories. */
  total: number | null
  entries: number
  by_meal?: Partial<Record<MealType, number>>
}

/**
 * Fold per-entry rows into one row per calendar day plus range totals. Pure,
 * so it is unit tested without a database.
 */
export function summarizeCalories(rows: MealEntryRow[], range: DateRange, goal: number | null) {
  const byDay = new Map<string, DaySummary>()
  for (const date of eachDay(range)) {
    byDay.set(date, { date, weekday: WEEKDAYS[isoWeekday(date) - 1]!, total: null, entries: 0 })
  }
  for (const row of rows) {
    const day = byDay.get(row.day)
    if (!day) continue
    day.total = (day.total ?? 0) + row.calories
    day.entries += 1
    const meal = row.meal_type as MealType
    day.by_meal ??= {}
    day.by_meal[meal] = (day.by_meal[meal] ?? 0) + row.calories
  }

  const days = [...byDay.values()]
  const logged = days.filter((d) => d.total !== null)
  const total = logged.reduce((sum, d) => sum + (d.total ?? 0), 0)
  const avg = (list: DaySummary[]) =>
    list.length ? Math.round(list.reduce((s, d) => s + (d.total ?? 0), 0) / list.length) : null
  const weekend = logged.filter((d) => d.weekday === 'Sat' || d.weekday === 'Sun')
  const weekday = logged.filter((d) => d.weekday !== 'Sat' && d.weekday !== 'Sun')

  return {
    start: range.start,
    end: range.end,
    calorie_goal: goal,
    days_in_range: days.length,
    days_logged: logged.length,
    total_calories: total,
    avg_per_logged_day: avg(logged),
    avg_logged_weekday: avg(weekday),
    avg_logged_weekend: avg(weekend),
    ...(goal
      ? {
          days_over_goal: logged.filter((d) => (d.total ?? 0) > goal).length,
          days_at_or_under_goal: logged.filter((d) => (d.total ?? 0) <= goal).length,
        }
      : {}),
    days,
  }
}

async function calorieGoal(db: Db, userId: string): Promise<number | null> {
  const { rows } = await db.query<{ daily_calorie_goal: number }>(
    'select daily_calorie_goal from public.users where id = $1',
    [userId],
  )
  return rows[0]?.daily_calorie_goal ?? null
}

export const getCalorieSummary = defineTool({
  title: 'Summarize calories',
  scope: 'read',
  definition: {
    name: 'get_calorie_summary',
    description:
      "Summarize logged calories for a date range in the user's timezone. Returns one row per day (total, calories by meal type, number of entries) plus the range total, the average per logged day, weekday vs weekend averages, days logged vs days in range, and the calorie goal. Days with no logs have total null, which means no data, not zero. Use range presets whenever possible instead of computing dates.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: rangeProperties(PAST_PRESETS),
      required: ['range', 'start_date', 'end_date'],
      additionalProperties: false,
    },
  },
  schema: rangeSchema(PAST_PRESETS),
  async run(input, { db, userId, tz }) {
    const range = rangeFromInput(input, tz)
    // Same SECURITY INVOKER function the Analytics tab uses, so numbers match.
    const { rows } = await db.query<MealEntryRow>(
      `select day::text as day, meal_type, calories
         from public.get_analytics_meal_entries($1::date, $2::date, $3::text)`,
      [range.start, range.end, tz],
    )
    return { result: summarizeCalories(rows, range, await calorieGoal(db, userId)) }
  },
})

const entriesSchema = rangeSchema(PAST_PRESETS).extend({
  limit: z.number().int().min(1).max(200).nullish(),
})

export const getCalorieEntries = defineTool({
  title: 'List food log entries',
  scope: 'read',
  definition: {
    name: 'get_calorie_entries',
    description:
      'List individual food entries (food name, calories, meal type, local date and time) for a date range, newest first. Use when the user asks what they ate or wants food-level feedback. limit is at most 200 (default 100).',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        ...rangeProperties(PAST_PRESETS),
        limit: { type: ['integer', 'null'], description: 'Maximum entries to return, 1-200. null for 100.' },
      },
      required: ['range', 'start_date', 'end_date', 'limit'],
      additionalProperties: false,
    },
  },
  schema: entriesSchema,
  async run(input, { db, userId, tz }) {
    const range = rangeFromInput(input, tz)
    const limit = input.limit ?? 100
    const { rows } = await db.query<{ food: string; kcal: number; meal: string; at: string }>(
      `select food_name as food, calories as kcal, meal_type as meal,
              to_char(logged_at at time zone $4, 'YYYY-MM-DD HH24:MI') as at
         from public.calorie_logs
        where user_id = $1
          and logged_at >= ($2::date)::timestamp at time zone $4
          and logged_at < ($3::date + 1)::timestamp at time zone $4
        order by logged_at desc
        limit $5`,
      [userId, range.start, range.end, tz, limit + 1],
    )
    const truncated = rows.length > limit
    return {
      result: {
        start: range.start,
        end: range.end,
        entries: rows.slice(0, limit),
        ...(truncated ? { truncated: true } : {}),
      },
    }
  },
})
