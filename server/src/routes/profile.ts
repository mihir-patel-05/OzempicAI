import { Hono } from 'hono'
import type { AppEnv } from '../auth.js'
import { isValidTimezone } from '../ai/dates.js'
import { withUser } from '../db.js'
import { HttpError, MAX_NAME_CHARS, int, num, oneOf, readFields, readJson, text } from '../http.js'
import type { FieldRules } from '../http.js'

const UPDATABLE: FieldRules = {
  name: text(MAX_NAME_CHARS),
  height_cm: num(0, 400, true),
  weight_kg: num(0, 2000, true),
  age: int(0, 150, true),
  daily_calorie_goal: int(1, 100_000),
  daily_water_goal_ml: int(1, 100_000),
  unit_system: oneOf(['metric', 'imperial']),
  timezone: text(64),
}

export const profileRoutes = new Hono<AppEnv>()

/** The caller's profile. Created with defaults if the signup trigger missed it. */
profileRoutes.get('/profile', async (c) => {
  const user = c.get('user')
  const profile = await withUser(user.id, async (db) => {
    const existing = await db.query('select * from public.users where id = $1', [user.id])
    if (existing.rows[0]) return existing.rows[0]
    await db.query(
      `insert into public.users (id, email, name) values ($1, $2, $3)
       on conflict (id) do nothing`,
      [user.id, user.email, user.name],
    )
    const { rows } = await db.query('select * from public.users where id = $1', [user.id])
    return rows[0]
  })
  return c.json(profile)
})

profileRoutes.patch('/profile', async (c) => {
  const user = c.get('user')
  const values = readFields(await readJson(c), UPDATABLE)
  if ('timezone' in values && (typeof values.timezone !== 'string' || !isValidTimezone(values.timezone))) {
    throw new HttpError(400, 'Invalid timezone')
  }
  const keys = Object.keys(values)
  if (keys.length === 0) throw new HttpError(400, 'Nothing to update')

  const assignments = keys.map((key, i) => `${key} = $${i + 2}`)
  const profile = await withUser(user.id, async (db) => {
    const { rows } = await db.query(
      `update public.users set ${assignments.join(', ')} where id = $1 returning *`,
      [user.id, ...Object.values(values)],
    )
    return rows[0]
  })
  if (!profile) throw new HttpError(404, 'Profile not found')
  return c.json(profile)
})
