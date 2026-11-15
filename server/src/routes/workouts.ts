import { Hono } from 'hono'
import type { AppEnv } from '../auth.js'
import { withUser } from '../db.js'
import type { Db } from '../db.js'
import {
  HttpError,
  MAX_NAME_CHARS,
  MAX_NOTES_CHARS,
  int,
  limitParam,
  num,
  oneOf,
  optionalDate,
  readFields,
  readJson,
  requireUuid,
  text,
} from '../http.js'
import type { FieldRules } from '../http.js'

/** One exercise as the web forms send it (metric units). */
interface ExerciseDraft {
  exercise_name: unknown
  machine?: unknown
  sets?: unknown
  reps?: unknown
  weight_kg?: unknown
  duration_minutes?: unknown
  distance_km?: unknown
}

const WORKOUT_TYPES = ['push', 'pull', 'legs', 'full_body', 'cardio', 'other'] as const

const EXERCISE_FIELDS: FieldRules = {
  exercise_name: text(MAX_NAME_CHARS),
  machine: text(MAX_NAME_CHARS, true),
  sets: int(1, 1000, true),
  reps: int(1, 10_000, true),
  weight_kg: num(0, 10_000, true),
  duration_minutes: int(1, 10_000, true),
  distance_km: num(0, 100_000, true),
}

const PLAN_FIELDS: FieldRules = {
  name: text(MAX_NAME_CHARS),
  workout_type: oneOf(WORKOUT_TYPES),
  planned_date: { kind: 'date' },
  notes: text(MAX_NOTES_CHARS, true),
}

const SESSION_FIELDS: FieldRules = {
  name: text(MAX_NAME_CHARS),
  workout_type: oneOf(WORKOUT_TYPES),
  performed_at: { kind: 'timestamp', nullable: true },
  duration_minutes: int(1, 10_000, true),
  notes: text(MAX_NOTES_CHARS, true),
  plan_id: { kind: 'uuid', nullable: true },
}

function readExercises(value: unknown): ExerciseDraft[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new HttpError(400, 'exercises must be an array')
  if (value.length > 100) throw new HttpError(400, 'Too many exercises')
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new HttpError(400, 'Invalid exercise')
    const exercise = readFields(item as Record<string, unknown>, EXERCISE_FIELDS)
    if (typeof exercise.exercise_name !== 'string') throw new HttpError(400, 'exercise_name is required')
    return exercise as unknown as ExerciseDraft
  })
}

/** Load child rows for `parentIds` and nest them under each parent as `exercises`. */
async function attachExercises<T extends { id: string }>(
  db: Db,
  parents: T[],
  childTable: string,
  parentColumn: string,
): Promise<(T & { exercises: unknown[] })[]> {
  if (parents.length === 0) return []
  const { rows } = await db.query<Record<string, unknown>>(
    `select * from public.${childTable}
      where ${parentColumn} = any($1::uuid[])
      order by position`,
    [parents.map((p) => p.id)],
  )
  const byParent = new Map<string, unknown[]>()
  for (const row of rows) {
    const key = row[parentColumn] as string
    const bucket = byParent.get(key)
    if (bucket) bucket.push(row)
    else byParent.set(key, [row])
  }
  return parents.map((parent) => ({ ...parent, exercises: byParent.get(parent.id) ?? [] }))
}

export const workoutRoutes = new Hono<AppEnv>()

// ─── Plans ──────────────────────────────────────────────────────────────────

workoutRoutes.get('/workout-plans', async (c) => {
  const userId = c.get('user').id
  const fromDate = optionalDate(c.req.query('from_date'), 'from_date')
  const limit = limitParam(c.req.query('limit'), 50, 200)

  const plans = await withUser(userId, async (db) => {
    const { rows } = await db.query<{ id: string }>(
      `select * from public.workout_plans
        where user_id = $1 and ($2::date is null or planned_date >= $2::date)
        order by planned_date, created_at
        limit $3`,
      [userId, fromDate ?? null, limit],
    )
    return attachExercises(db, rows, 'workout_plan_exercises', 'plan_id')
  })
  return c.json(plans)
})

workoutRoutes.post('/workout-plans', async (c) => {
  const userId = c.get('user').id
  const body = await readJson(c)
  const plan = readFields(body, PLAN_FIELDS)
  const exercises = readExercises(body.exercises)

  // One transaction: a plan is never saved without the exercises it was sent with.
  const created = await withUser(userId, async (db) => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.workout_plans (user_id, name, workout_type, planned_date, notes)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [userId, plan.name, plan.workout_type, plan.planned_date, plan.notes ?? null],
    )
    const row = rows[0]!
    for (const [index, exercise] of exercises.entries()) {
      await db.query(
        `insert into public.workout_plan_exercises
           (plan_id, user_id, position, exercise_name, machine, target_sets, target_reps,
            target_weight_kg, target_duration_minutes, target_distance_km)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          row.id,
          userId,
          index,
          exercise.exercise_name,
          exercise.machine ?? null,
          exercise.sets ?? null,
          exercise.reps ?? null,
          exercise.weight_kg ?? null,
          exercise.duration_minutes ?? null,
          exercise.distance_km ?? null,
        ],
      )
    }
    const [withExercises] = await attachExercises(db, [row], 'workout_plan_exercises', 'plan_id')
    return withExercises
  })
  return c.json(created, 201)
})

/** Tick a plan off (or un-tick it). */
workoutRoutes.patch('/workout-plans/:id', async (c) => {
  const userId = c.get('user').id
  const id = requireUuid(c.req.param('id'))
  const body = await readJson(c)
  if (typeof body.completed !== 'boolean') throw new HttpError(400, 'completed must be a boolean')

  const row = await withUser(userId, async (db) => {
    const { rows } = await db.query(
      `update public.workout_plans
          set completed_at = case when $3 then now() else null end
        where id = $1 and user_id = $2
        returning *`,
      [id, userId, body.completed],
    )
    return rows[0]
  })
  if (!row) throw new HttpError(404, 'Not found')
  return c.json(row)
})

workoutRoutes.delete('/workout-plans/:id', async (c) => {
  const userId = c.get('user').id
  const id = requireUuid(c.req.param('id'))
  // workout_plan_exercises cascade; sessions keep a null plan_id.
  await withUser(userId, (db) =>
    db.query('delete from public.workout_plans where id = $1 and user_id = $2', [id, userId]),
  )
  return c.body(null, 204)
})

// ─── Sessions ───────────────────────────────────────────────────────────────

workoutRoutes.get('/workout-sessions', async (c) => {
  const userId = c.get('user').id
  const limit = limitParam(c.req.query('limit'), 20, 200)

  const sessions = await withUser(userId, async (db) => {
    const { rows } = await db.query<{ id: string }>(
      `select * from public.workout_sessions
        where user_id = $1
        order by performed_at desc
        limit $2`,
      [userId, limit],
    )
    return attachExercises(db, rows, 'workout_session_exercises', 'session_id')
  })
  return c.json(sessions)
})

workoutRoutes.post('/workout-sessions', async (c) => {
  const userId = c.get('user').id
  const body = await readJson(c)
  const session = readFields(body, SESSION_FIELDS)
  const exercises = readExercises(body.exercises)

  const created = await withUser(userId, async (db) => {
    const { rows } = await db.query<{ id: string }>(
      `insert into public.workout_sessions
         (user_id, name, workout_type, performed_at, duration_minutes, notes, plan_id)
       values ($1, $2, $3, coalesce($4::timestamptz, now()), $5, $6, $7)
       returning *`,
      [
        userId,
        session.name,
        session.workout_type,
        session.performed_at ?? null,
        session.duration_minutes ?? null,
        session.notes ?? null,
        session.plan_id ?? null,
      ],
    )
    const row = rows[0]!
    for (const [index, exercise] of exercises.entries()) {
      await db.query(
        `insert into public.workout_session_exercises
           (session_id, user_id, position, exercise_name, machine, sets, reps_per_set,
            weight_kg, duration_minutes, distance_km)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          row.id,
          userId,
          index,
          exercise.exercise_name,
          exercise.machine ?? null,
          exercise.sets ?? null,
          exercise.reps ?? null,
          exercise.weight_kg ?? null,
          exercise.duration_minutes ?? null,
          exercise.distance_km ?? null,
        ],
      )
    }
    const [withExercises] = await attachExercises(
      db,
      [row],
      'workout_session_exercises',
      'session_id',
    )
    return withExercises
  })
  return c.json(created, 201)
})

workoutRoutes.delete('/workout-sessions/:id', async (c) => {
  const userId = c.get('user').id
  const id = requireUuid(c.req.param('id'))
  // workout_session_exercises cascade.
  await withUser(userId, (db) =>
    db.query('delete from public.workout_sessions where id = $1 and user_id = $2', [id, userId]),
  )
  return c.body(null, 204)
})
