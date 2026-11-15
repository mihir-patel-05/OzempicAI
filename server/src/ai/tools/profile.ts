import { z } from 'zod'
import { defineTool } from './types.js'

const KG_PER_LB = 0.45359237
const CM_PER_IN = 2.54

export const getProfile = defineTool({
  definition: {
    name: 'get_profile',
    description:
      "Get the user's goals and settings: daily calorie goal, daily water goal, weight, height, age and unit system. Weight and height are also given in the user's units when they use imperial.",
    strict: true,
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  schema: z.object({}),
  async run(_input, { db, userId }) {
    const { rows } = await db.query<{
      daily_calorie_goal: number
      daily_water_goal_ml: number
      weight_kg: number | null
      height_cm: number | null
      age: number | null
      unit_system: 'metric' | 'imperial'
    }>(
      `select daily_calorie_goal, daily_water_goal_ml, weight_kg, height_cm, age, unit_system
         from public.users where id = $1`,
      [userId],
    )
    const p = rows[0]
    if (!p) return { result: { profile: null, note: 'No profile found' } }

    const imperial = p.unit_system === 'imperial'
    return {
      result: {
        daily_calorie_goal: p.daily_calorie_goal,
        daily_water_goal_ml: p.daily_water_goal_ml,
        unit_system: p.unit_system,
        weight_kg: round(p.weight_kg, 1),
        ...(imperial && p.weight_kg != null ? { weight_lb: round(p.weight_kg / KG_PER_LB, 1) } : {}),
        height_cm: round(p.height_cm, 0),
        ...(imperial && p.height_cm != null ? { height_in: round(p.height_cm / CM_PER_IN, 0) } : {}),
        age: p.age,
      },
    }
  },
})

export function round(value: number | null | undefined, digits: number): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const f = 10 ** digits
  return Math.round(value * f) / f
}

export { KG_PER_LB }
