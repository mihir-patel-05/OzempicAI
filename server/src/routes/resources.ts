import { Hono } from 'hono'
import type { AppEnv } from '../auth.js'
import { withUser } from '../db.js'
import {
  HttpError,
  MAX_NAME_CHARS,
  int,
  limitParam,
  num,
  oneOf,
  optionalDate,
  optionalTimestamp,
  readFields,
  readJson,
  requireUuid,
  text,
} from '../http.js'
import type { FieldRules } from '../http.js'

/**
 * A per-user table exposed as list / create / update / delete. Table, column
 * and ORDER BY names come only from the fixed configs below, never from the
 * request, so they are safe to interpolate.
 */
interface ResourceConfig {
  table: string
  /** Columns a client may set on insert, and what each may hold. user_id is always the caller. */
  insertable: FieldRules
  /** Columns a client may change with PATCH. Omit to disable PATCH. */
  updatable?: FieldRules
  /** timestamptz column filtered by ?from=&to= (ISO timestamps). */
  timeColumn?: string
  /** date column filtered by ?from_date=&to_date= (YYYY-MM-DD). */
  dateColumn?: string
  orderBy: string
  defaultLimit: number
  maxLimit: number
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const GROCERY_CATEGORIES = ['produce', 'dairy', 'protein', 'grains', 'beverages', 'snacks', 'other'] as const
const name = text(MAX_NAME_CHARS)
const when = { kind: 'timestamp' } as const

const RESOURCES: Record<string, ResourceConfig> = {
  'calorie-logs': {
    table: 'calorie_logs',
    insertable: { food_name: name, calories: int(1, 100_000), meal_type: oneOf(MEAL_TYPES), logged_at: when },
    timeColumn: 'logged_at',
    orderBy: 'logged_at desc',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  'water-logs': {
    table: 'water_logs',
    insertable: { amount_ml: int(1, 100_000), logged_at: when },
    timeColumn: 'logged_at',
    orderBy: 'logged_at desc',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  'exercise-logs': {
    table: 'exercise_logs',
    insertable: {
      exercise_name: name,
      category: oneOf(['cardio', 'strength', 'flexibility', 'sports', 'other']),
      duration_minutes: int(1, 10_000),
      calories_burned: int(0, 100_000),
      sets: int(1, 1000, true),
      reps_per_set: int(1, 10_000, true),
      weight_kg: num(0, 10_000, true),
      body_part: oneOf(['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'full_body'], true),
      logged_at: when,
    },
    timeColumn: 'logged_at',
    orderBy: 'logged_at desc',
    defaultLimit: 500,
    maxLimit: 2000,
  },
  'heart-rate-logs': {
    table: 'heart_rate_logs',
    insertable: { bpm: int(31, 239), source: oneOf(['healthkit', 'manual']), recorded_at: when },
    timeColumn: 'recorded_at',
    orderBy: 'recorded_at desc',
    defaultLimit: 30,
    maxLimit: 500,
  },
  'weight-logs': {
    table: 'weight_logs',
    insertable: { weight_kg: num(0, 2000), logged_at: when },
    timeColumn: 'logged_at',
    orderBy: 'logged_at desc',
    defaultLimit: 30,
    maxLimit: 500,
  },
  'meal-plans': {
    table: 'meal_plans',
    insertable: { name, planned_date: { kind: 'date' }, meal_type: oneOf(MEAL_TYPES), calories: int(1, 100_000) },
    dateColumn: 'planned_date',
    orderBy: 'planned_date asc, meal_type asc',
    defaultLimit: 50,
    maxLimit: 500,
  },
  'grocery-items': {
    table: 'grocery_items',
    insertable: {
      name,
      category: oneOf(GROCERY_CATEGORIES),
      is_purchased: { kind: 'boolean' },
      meal_plan_id: { kind: 'uuid', nullable: true },
    },
    updatable: { name, category: oneOf(GROCERY_CATEGORIES), is_purchased: { kind: 'boolean' } },
    orderBy: 'is_purchased asc, created_at desc',
    defaultLimit: 500,
    maxLimit: 2000,
  },
}

export const resourceRoutes = new Hono<AppEnv>()

for (const [path, config] of Object.entries(RESOURCES)) {
  const { table } = config

  resourceRoutes.get(`/${path}`, async (c) => {
    const userId = c.get('user').id
    const where = ['user_id = $1']
    const params: unknown[] = [userId]
    const add = (clause: string, value: unknown) => {
      params.push(value)
      where.push(clause.replace('?', `$${params.length}`))
    }

    if (config.timeColumn) {
      const from = optionalTimestamp(c.req.query('from'), 'from')
      const to = optionalTimestamp(c.req.query('to'), 'to')
      if (from) add(`${config.timeColumn} >= ?`, from)
      if (to) add(`${config.timeColumn} <= ?`, to)
    }
    if (config.dateColumn) {
      const fromDate = optionalDate(c.req.query('from_date'), 'from_date')
      const toDate = optionalDate(c.req.query('to_date'), 'to_date')
      if (fromDate) add(`${config.dateColumn} >= ?`, fromDate)
      if (toDate) add(`${config.dateColumn} <= ?`, toDate)
    }
    params.push(limitParam(c.req.query('limit'), config.defaultLimit, config.maxLimit))

    const rows = await withUser(userId, async (db) => {
      const result = await db.query(
        `select * from public.${table}
          where ${where.join(' and ')}
          order by ${config.orderBy}
          limit $${params.length}`,
        params,
      )
      return result.rows
    })
    return c.json(rows)
  })

  resourceRoutes.post(`/${path}`, async (c) => {
    const userId = c.get('user').id
    const values = readFields(await readJson(c), config.insertable)
    const columns = ['user_id', ...Object.keys(values)]
    const params = [userId, ...Object.values(values)]
    const placeholders = params.map((_, i) => `$${i + 1}`)

    const row = await withUser(userId, async (db) => {
      const result = await db.query(
        `insert into public.${table} (${columns.join(', ')})
         values (${placeholders.join(', ')})
         returning *`,
        params,
      )
      return result.rows[0]
    })
    return c.json(row, 201)
  })

  if (config.updatable) {
    const updatable = config.updatable
    resourceRoutes.patch(`/${path}/:id`, async (c) => {
      const userId = c.get('user').id
      const id = requireUuid(c.req.param('id'))
      const values = readFields(await readJson(c), updatable)
      const keys = Object.keys(values)
      if (keys.length === 0) throw new HttpError(400, 'Nothing to update')

      const assignments = keys.map((key, i) => `${key} = $${i + 3}`)
      const row = await withUser(userId, async (db) => {
        const result = await db.query(
          `update public.${table} set ${assignments.join(', ')}
            where id = $1 and user_id = $2
            returning *`,
          [id, userId, ...Object.values(values)],
        )
        return result.rows[0]
      })
      if (!row) throw new HttpError(404, 'Not found')
      return c.json(row)
    })
  }

  resourceRoutes.delete(`/${path}/:id`, async (c) => {
    const userId = c.get('user').id
    const id = requireUuid(c.req.param('id'))
    await withUser(userId, (db) =>
      db.query(`delete from public.${table} where id = $1 and user_id = $2`, [id, userId]),
    )
    return c.body(null, 204)
  })
}
