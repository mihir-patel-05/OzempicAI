import { Hono } from 'hono'
import type { AppEnv } from '../auth.js'
import { withUser } from '../db.js'
import { HttpError, optionalDate } from '../http.js'

export const analyticsRoutes = new Hono<AppEnv>()

/**
 * Everything the Analytics tab draws, in one round trip. The three SQL
 * functions are SECURITY INVOKER, so row level security scopes them to the
 * caller exactly as it did on Supabase.
 */
analyticsRoutes.get('/analytics', async (c) => {
  const userId = c.get('user').id
  const start = optionalDate(c.req.query('start'), 'start')
  const end = optionalDate(c.req.query('end'), 'end')
  const timezone = c.req.query('timezone') || 'UTC'
  if (!start || !end) throw new HttpError(400, 'start and end are required')
  if (timezone.length > 64) throw new HttpError(400, 'Invalid timezone')

  const args = [start, end, timezone]
  const data = await withUser(userId, async (db) => {
    const daily = await db.query(
      'select * from public.get_analytics_daily($1::date, $2::date, $3::text)',
      args,
    )
    const exercises = await db.query(
      'select * from public.get_analytics_exercise_progress($1::date, $2::date, $3::text)',
      args,
    )
    const meals = await db.query(
      'select * from public.get_analytics_meal_entries($1::date, $2::date, $3::text)',
      args,
    )
    return { daily: daily.rows, exercises: exercises.rows, meals: meals.rows }
  })
  return c.json(data)
})
