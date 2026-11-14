import { Hono } from 'hono'
import type { AppEnv } from '../auth.js'
import { withUser } from '../db.js'
import { HttpError, pick, readJson } from '../http.js'

const UPDATABLE = [
  'name',
  'height_cm',
  'weight_kg',
  'age',
  'daily_calorie_goal',
  'daily_water_goal_ml',
  'unit_system',
] as const

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
  const values = pick(await readJson(c), UPDATABLE)
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
