import { z } from 'zod'
import { PLAN_HORIZON_DAYS, addDays, daysBetween, isValidDate, isoWeekday } from '../dates.js'
import { groceryKey } from './groceries.js'
import { PLAN_PRESETS, rangeFromInput, rangeProperties, rangeSchema } from './range.js'
import { ToolInputError, defineTool } from './types.js'

export const PLAN_MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export const MAX_PLAN_MEALS = 35 // 7 days × up to 5 meals
export { PLAN_HORIZON_DAYS }
const MAX_MEAL_NAME = 120
const MAX_MEAL_CALORIES = 3000
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export interface PlannedMealInput {
  planned_date: string
  meal_type: (typeof PLAN_MEAL_TYPES)[number]
  name: string
  calories: number
}

/**
 * Every problem with a requested plan, so the model can fix them all in one
 * retry. An empty list means the plan may be saved.
 */
export function mealPlanProblems(meals: PlannedMealInput[], today: string): string[] {
  const last = addDays(today, PLAN_HORIZON_DAYS)
  const problems: string[] = []
  meals.forEach((meal, i) => {
    const where = `meals[${i}] (${meal.planned_date} ${meal.meal_type})`
    if (!isValidDate(meal.planned_date)) {
      problems.push(`${where}: planned_date must be a real date in YYYY-MM-DD`)
    } else if (meal.planned_date < today || meal.planned_date > last) {
      problems.push(`${where}: planned_date must be between ${today} and ${last}`)
    }
  })
  return problems
}

export const getMealPlans = defineTool({
  title: 'Get meal plan',
  scope: 'read',
  definition: {
    name: 'get_meal_plans',
    description:
      "List the user's planned meals for a date range (inclusive), grouped by day with each day's planned calorie total. Call before creating a plan so you don't duplicate meals already planned.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: rangeProperties(PLAN_PRESETS),
      required: ['range', 'start_date', 'end_date'],
      additionalProperties: false,
    },
  },
  schema: rangeSchema(PLAN_PRESETS),
  async run(input, { db, userId, tz }) {
    const range = rangeFromInput(input, tz)
    const { rows } = await db.query<{ planned_date: string; meal_type: string; name: string; calories: number }>(
      `select planned_date, meal_type, name, calories
         from public.meal_plans
        where user_id = $1 and planned_date between $2::date and $3::date
        order by planned_date,
                 array_position(array['breakfast','lunch','dinner','snack'], meal_type),
                 created_at
        limit 500`,
      [userId, range.start, range.end],
    )
    const days = new Map<string, { date: string; weekday: string; total: number; meals: unknown[] }>()
    for (const row of rows) {
      let day = days.get(row.planned_date)
      if (!day) {
        day = { date: row.planned_date, weekday: WEEKDAYS[isoWeekday(row.planned_date) - 1]!, total: 0, meals: [] }
        days.set(row.planned_date, day)
      }
      day.total += row.calories
      day.meals.push({ meal_type: row.meal_type, name: row.name, calories: row.calories })
    }
    return {
      result: {
        start: range.start,
        end: range.end,
        planned_meals: rows.length,
        days_with_plans: [...days.values()],
      },
    }
  },
})

export const createMealPlan = defineTool({
  title: 'Add planned meals',
  scope: 'write',
  idempotent: true,
  definition: {
    name: 'create_meal_plan',
    description: `Write planned meals to the user's meal plan. Send the whole plan in one call (at most ${MAX_PLAN_MEALS} meals). Each entry is one meal on one date. planned_date is YYYY-MM-DD between today and ${PLAN_HORIZON_DAYS} days from today. calories is your best per-serving estimate, a whole number from 1 to ${MAX_MEAL_CALORIES}. Names up to ${MAX_MEAL_NAME} characters. If any meal is invalid, nothing is saved and the error lists every problem so you can fix them and call again. Meals identical to ones already planned (same date, meal type and name) are skipped.`,
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        meals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              planned_date: { type: 'string', format: 'date', description: 'YYYY-MM-DD' },
              meal_type: { type: 'string', enum: [...PLAN_MEAL_TYPES] },
              name: { type: 'string' },
              calories: { type: 'integer' },
            },
            required: ['planned_date', 'meal_type', 'name', 'calories'],
            additionalProperties: false,
          },
        },
      },
      required: ['meals'],
      additionalProperties: false,
    },
  },
  schema: z.object({
    meals: z
      .array(
        z.object({
          planned_date: z.string(),
          meal_type: z.enum(PLAN_MEAL_TYPES),
          name: z.string().trim().min(1).max(MAX_MEAL_NAME),
          calories: z.number().int().min(1).max(MAX_MEAL_CALORIES),
        }),
      )
      .min(1)
      .max(MAX_PLAN_MEALS),
  }),
  async run({ meals }, { db, userId, today }) {
    const problems = mealPlanProblems(meals, today)
    if (problems.length > 0) {
      throw new ToolInputError(`Nothing was saved. Fix these and call again: ${problems.join('; ')}`)
    }

    const dates = meals.map((m) => m.planned_date).sort()
    const start = dates[0]!
    const end = dates[dates.length - 1]!
    const existing = await db.query<{ planned_date: string; meal_type: string; name: string }>(
      `select planned_date, meal_type, name from public.meal_plans
        where user_id = $1 and planned_date between $2::date and $3::date`,
      [userId, start, end],
    )
    const key = (m: { planned_date: string; meal_type: string; name: string }) =>
      `${m.planned_date}|${m.meal_type}|${groceryKey(m.name)}`
    const seen = new Set(existing.rows.map(key))
    const toAdd: PlannedMealInput[] = []
    const skipped: string[] = []
    for (const meal of meals) {
      const k = key(meal)
      if (seen.has(k)) {
        skipped.push(`${meal.planned_date} ${meal.meal_type}: ${meal.name}`)
        continue
      }
      seen.add(k)
      toAdd.push(meal)
    }

    let ids: string[] = []
    if (toAdd.length > 0) {
      const inserted = await db.query<{ id: string }>(
        `insert into public.meal_plans (user_id, planned_date, meal_type, name, calories)
         select $1, m.planned_date, m.meal_type, m.name, m.calories
           from unnest($2::date[], $3::text[], $4::text[], $5::int[])
                  as m(planned_date, meal_type, name, calories)
         returning id`,
        [
          userId,
          toAdd.map((m) => m.planned_date),
          toAdd.map((m) => m.meal_type),
          toAdd.map((m) => m.name.trim()),
          toAdd.map((m) => m.calories),
        ],
      )
      ids = inserted.rows.map((r) => r.id)
    }

    const dailyTotals: Record<string, number> = {}
    for (const meal of toAdd) dailyTotals[meal.planned_date] = (dailyTotals[meal.planned_date] ?? 0) + meal.calories

    const n = ids.length
    return {
      result: { saved: n, start, end, daily_totals: dailyTotals, skipped_already_planned: skipped },
      summary:
        n > 0
          ? `Planned ${n} meal${n === 1 ? '' : 's'} for ${formatSpan(start, end)}`
          : 'Those meals were already planned',
      createdIds: ids,
      resource: 'meal-plans',
    }
  },
})

/** "Nov 16–22", "Nov 30–Dec 6" or "Nov 16". */
export function formatSpan(start: string, end: string): string {
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', ...opts })
  if (start === end) return fmt(start, { month: 'short', day: 'numeric' })
  const sameMonth = start.slice(0, 7) === end.slice(0, 7) && daysBetween(start, end) < 31
  return sameMonth
    ? `${fmt(start, { month: 'short', day: 'numeric' })}–${fmt(end, { day: 'numeric' })}`
    : `${fmt(start, { month: 'short', day: 'numeric' })}–${fmt(end, { month: 'short', day: 'numeric' })}`
}
