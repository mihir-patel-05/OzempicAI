import { z } from 'zod'
import type { Db } from '../../db.js'
import { PLAN_HORIZON_DAYS, addDays, isValidDate, isoWeekday } from '../dates.js'
import { groceryKey } from './groceries.js'
import { WEEKDAYS, formatSpan } from './mealPlans.js'
import { KG_PER_LB } from './profile.js'
import { WORKOUT_PRESETS, rangeFromInput, rangeProperties, rangeSchema } from './range.js'
import { insertedChanges, requireUnlinkedPlans, snapshotRows } from './snapshots.js'
import { lockOwnRows } from './rows.js'
import { ToolInputError, defineTool, plural, rowId } from './types.js'

/** Matches the workout_plans.workout_type check constraint and WorkoutType. */
export const WORKOUT_TYPES = ['push', 'pull', 'legs', 'full_body', 'cardio', 'other'] as const
export const UNIT_SYSTEMS = ['metric', 'imperial'] as const
export const MAX_WORKOUTS = 14
export const MAX_EXERCISES = 20
export const MAX_WORKOUT_REMOVALS = 30
const MAX_NAME = 80
const MAX_NOTES = 500
const LIST_LIMIT = 100
const KM_PER_MI = 1.609344

type UnitSystem = (typeof UNIT_SYSTEMS)[number]

// ─── Schemas ────────────────────────────────────────────────────────────────
//
// create_workout_plans and update_workout_plan are deliberately NOT strict.
// Their workout → exercises nesting, with six optional exercise targets and
// the schema repeated in both tools, compiles to a grammar over the API's
// internal size cap ("The compiled grammar is too large"), even though it
// stays under the counted limits (20 tools, 24 optional, 16 union params).
// Every call is still validated by the Zod schemas below, and invalid input
// goes back to the model as an is_error result it can fix.

const exerciseJson = {
  type: 'object',
  properties: {
    exercise_name: { type: 'string' },
    machine: { type: 'string', description: 'Equipment or machine, e.g. "Leg press" or "Treadmill". Omit if none.' },
    sets: { type: 'integer', description: '1-20' },
    reps: { type: 'integer', description: 'Reps per set, 1-100' },
    weight: {
      type: 'number',
      description: 'Target load in kg (metric) or lb (imperial). Omit for bodyweight and cardio.',
    },
    duration_minutes: { type: 'integer', description: '1-600, mainly for cardio' },
    distance: { type: 'number', description: 'Target distance in km (metric) or mi (imperial), mainly for cardio' },
  },
  required: ['exercise_name'],
  additionalProperties: false,
}

const workoutJson = {
  type: 'object',
  properties: {
    name: { type: 'string', description: `Short title, e.g. "Push day" or "Easy 5k". Up to ${MAX_NAME} characters.` },
    workout_type: { type: 'string', enum: [...WORKOUT_TYPES] },
    planned_date: { type: 'string', format: 'date', description: 'YYYY-MM-DD' },
    notes: { type: 'string', description: 'Short notes such as warm-up or rest times; "" for none.' },
    exercises: { type: 'array', items: exerciseJson, description: `In order, at most ${MAX_EXERCISES}.` },
  },
  required: ['name', 'workout_type', 'planned_date', 'notes', 'exercises'],
  additionalProperties: false,
}

const unitSystemJson = {
  type: 'string',
  enum: [...UNIT_SYSTEMS],
  description: "Units of every weight and distance in this call. Use the user's unit system.",
}

const exerciseSchema = z.object({
  exercise_name: z.string().trim().min(1).max(MAX_NAME),
  machine: z.string().trim().max(MAX_NAME).nullish(),
  sets: z.number().int().min(1).max(20).nullish(),
  reps: z.number().int().min(1).max(100).nullish(),
  weight: z.number().min(0).max(1000).nullish(),
  duration_minutes: z.number().int().min(1).max(600).nullish(),
  distance: z.number().positive().max(500).nullish(),
})

const workoutSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME),
  workout_type: z.enum(WORKOUT_TYPES),
  planned_date: z.string(),
  notes: z.string().trim().max(MAX_NOTES),
  exercises: z.array(exerciseSchema).max(MAX_EXERCISES),
})

export type ExerciseInput = z.infer<typeof exerciseSchema>
export type WorkoutInput = z.infer<typeof workoutSchema>

// ─── Conversions ────────────────────────────────────────────────────────────

/** A workout_plan_exercises row's target columns (metric). */
export interface ExerciseRow {
  exercise_name: string
  machine: string | null
  target_sets: number | null
  target_reps: number | null
  target_weight_kg: number | null
  target_duration_minutes: number | null
  target_distance_km: number | null
}

/** Model input (in the user's units) to database columns (kg, km). */
export function exerciseToRow(exercise: ExerciseInput, units: UnitSystem): ExerciseRow {
  const imperial = units === 'imperial'
  const weight = exercise.weight ?? null
  const distance = exercise.distance ?? null
  return {
    exercise_name: exercise.exercise_name.trim(),
    machine: exercise.machine?.trim() || null,
    target_sets: exercise.sets ?? null,
    target_reps: exercise.reps ?? null,
    target_weight_kg: weight == null ? null : imperial ? weight * KG_PER_LB : weight,
    target_duration_minutes: exercise.duration_minutes ?? null,
    target_distance_km: distance == null ? null : imperial ? distance * KM_PER_MI : distance,
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Database row back to the same shape the write tools take, in the user's
 * units, so the model can copy a plan, change it and send it back.
 */
export function rowToExercise(row: ExerciseRow, units: UnitSystem): ExerciseInput {
  const imperial = units === 'imperial'
  const out: ExerciseInput = { exercise_name: row.exercise_name }
  if (row.machine) out.machine = row.machine
  if (row.target_sets != null) out.sets = row.target_sets
  if (row.target_reps != null) out.reps = row.target_reps
  if (row.target_weight_kg != null) {
    out.weight = round2(imperial ? row.target_weight_kg / KG_PER_LB : row.target_weight_kg)
  }
  if (row.target_duration_minutes != null) out.duration_minutes = row.target_duration_minutes
  if (row.target_distance_km != null) {
    out.distance = round2(imperial ? row.target_distance_km / KM_PER_MI : row.target_distance_km)
  }
  return out
}

/** Problems with a date a workout would be planned on (empty when fine). */
function dateProblem(date: string, today: string): string | null {
  const last = addDays(today, PLAN_HORIZON_DAYS)
  if (!isValidDate(date)) return 'planned_date must be a real date in YYYY-MM-DD'
  if (date < today || date > last) return `planned_date must be between ${today} and ${last}`
  return null
}

/** Every problem with requested workouts, so the model can fix them in one retry. */
export function workoutPlanProblems(workouts: WorkoutInput[], today: string): string[] {
  const problems: string[] = []
  workouts.forEach((workout, i) => {
    const problem = dateProblem(workout.planned_date, today)
    if (problem) problems.push(`workouts[${i}] (${workout.planned_date} ${workout.name}): ${problem}`)
  })
  return problems
}

const workoutKey = (date: string, name: string) => `${date}|${groceryKey(name)}`

// ─── Database helpers ───────────────────────────────────────────────────────

interface PlanRow {
  id: string
  name: string
  workout_type: string
  planned_date: string
  notes: string | null
  completed_at: string | null
}

async function unitSystemOf(db: Db, userId: string): Promise<UnitSystem> {
  const { rows } = await db.query<{ unit_system: string }>('select unit_system from public.users where id = $1', [
    userId,
  ])
  return rows[0]?.unit_system === 'imperial' ? 'imperial' : 'metric'
}

async function exercisesByPlan(db: Db, planIds: string[]): Promise<Map<string, ExerciseRow[]>> {
  const byPlan = new Map<string, ExerciseRow[]>()
  if (planIds.length === 0) return byPlan
  const { rows } = await db.query<ExerciseRow & { plan_id: string }>(
    `select plan_id, exercise_name, machine, target_sets, target_reps, target_weight_kg,
            target_duration_minutes, target_distance_km
       from public.workout_plan_exercises
      where plan_id = any($1::uuid[])
      order by plan_id, position, created_at`,
    [planIds],
  )
  for (const row of rows) {
    const list = byPlan.get(row.plan_id)
    if (list) list.push(row)
    else byPlan.set(row.plan_id, [row])
  }
  return byPlan
}

async function insertExercises(db: Db, userId: string, planId: string, rows: ExerciseRow[]) {
  if (rows.length === 0) return
  await db.query(
    `insert into public.workout_plan_exercises
       (plan_id, user_id, position, exercise_name, machine, target_sets, target_reps,
        target_weight_kg, target_duration_minutes, target_distance_km)
     select $1, $2, e.n - 1, e.exercise_name, e.machine, e.sets, e.reps, e.weight_kg, e.duration, e.distance_km
       from unnest($3::text[], $4::text[], $5::int[], $6::int[], $7::float8[], $8::int[], $9::float8[])
              with ordinality as e(exercise_name, machine, sets, reps, weight_kg, duration, distance_km, n)`,
    [
      planId,
      userId,
      rows.map((r) => r.exercise_name),
      rows.map((r) => r.machine),
      rows.map((r) => r.target_sets),
      rows.map((r) => r.target_reps),
      rows.map((r) => r.target_weight_kg),
      rows.map((r) => r.target_duration_minutes),
      rows.map((r) => r.target_distance_km),
    ],
  )
}

/** A plan as the model sees it: the write-tool shape plus id and status. */
function describePlan(plan: PlanRow, exercises: ExerciseRow[], units: UnitSystem) {
  return {
    plan_id: plan.id,
    planned_date: plan.planned_date,
    weekday: WEEKDAYS[isoWeekday(plan.planned_date) - 1],
    name: plan.name,
    workout_type: plan.workout_type,
    notes: plan.notes ?? '',
    completed: plan.completed_at != null,
    exercises: exercises.map((e) => rowToExercise(e, units)),
  }
}

/** "Thu, Nov 19" */
function dayLabel(date: string): string {
  return `${WEEKDAYS[isoWeekday(date) - 1]}, ${formatSpan(date, date)}`
}

/** Action-card text for create_workout_plans; also rebuilt from history. */
export function createdSummary(saved: { planned_date: string; name: string }[]): string {
  const n = saved.length
  if (n === 0) return 'Those workouts were already planned'
  if (n === 1) return `Planned ${saved[0]!.name} for ${dayLabel(saved[0]!.planned_date)}`
  const dates = saved.map((s) => s.planned_date).sort()
  return `Planned ${n} workouts for ${formatSpan(dates[0]!, dates[n - 1]!)}`
}

/** Action-card text for update_workout_plan; also rebuilt from history. */
export function updatedSummary(plan: { planned_date: string; name: string }): string {
  return `Updated ${plan.name} for ${dayLabel(plan.planned_date)}`
}

// ─── Tools ──────────────────────────────────────────────────────────────────

export const getWorkoutPlans = defineTool({
  title: 'Get workout plans',
  scope: 'read',
  definition: {
    name: 'get_workout_plans',
    description:
      "List the user's planned workouts for a date range (inclusive), each with its plan_id, name, type, notes, whether it was completed, and its exercises in order. Weights and distances are in the user's unit system (given as unit_system), in the same shape create_workout_plans and update_workout_plan take. Use range=upcoming for everything from today on. Call before creating workouts so you don't duplicate them, and before editing one to get its plan_id and current exercises.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: rangeProperties(WORKOUT_PRESETS),
      required: ['range', 'start_date', 'end_date'],
      additionalProperties: false,
    },
  },
  schema: rangeSchema(WORKOUT_PRESETS),
  async run(input, { db, userId, tz }) {
    const range = rangeFromInput(input, tz)
    const [plans, units] = await Promise.all([
      db.query<PlanRow>(
        `select id, name, workout_type, planned_date, notes, completed_at
           from public.workout_plans
          where user_id = $1 and planned_date between $2::date and $3::date
          order by planned_date, created_at
          limit $4`,
        [userId, range.start, range.end, LIST_LIMIT],
      ),
      unitSystemOf(db, userId),
    ])
    const exercises = await exercisesByPlan(
      db,
      plans.rows.map((p) => p.id),
    )
    return {
      result: {
        start: range.start,
        end: range.end,
        unit_system: units,
        planned_workouts: plans.rows.length,
        plans: plans.rows.map((p) => describePlan(p, exercises.get(p.id) ?? [], units)),
      },
    }
  },
})

export const createWorkoutPlans = defineTool({
  title: 'Add planned workouts',
  scope: 'write',
  idempotent: true,
  definition: {
    name: 'create_workout_plans',
    description: `Add workouts to the user's workout plan (Plans → Workouts). Send every workout for the request in one call (at most ${MAX_WORKOUTS}). Each workout is one session on one date, with its exercises in order (at most ${MAX_EXERCISES}). planned_date is YYYY-MM-DD between today and ${PLAN_HORIZON_DAYS} days from today. Strength exercises use sets, reps and weight; cardio uses duration_minutes and distance; leave out what doesn't apply. If any workout is invalid, nothing is saved and the error lists every problem so you can fix them and call again. A workout with the same date and name as one already planned is skipped.`,
    input_schema: {
      type: 'object',
      properties: {
        unit_system: unitSystemJson,
        workouts: { type: 'array', items: workoutJson },
      },
      required: ['unit_system', 'workouts'],
      additionalProperties: false,
    },
  },
  schema: z.object({
    unit_system: z.enum(UNIT_SYSTEMS),
    workouts: z.array(workoutSchema).min(1).max(MAX_WORKOUTS),
  }),
  async run({ unit_system, workouts }, { db, userId, today }) {
    const problems = workoutPlanProblems(workouts, today)
    if (problems.length > 0) {
      throw new ToolInputError(`Nothing was saved. Fix these and call again: ${problems.join('; ')}`)
    }

    const dates = workouts.map((w) => w.planned_date).sort()
    const existing = await db.query<{ planned_date: string; name: string }>(
      `select planned_date, name from public.workout_plans
        where user_id = $1 and planned_date between $2::date and $3::date`,
      [userId, dates[0], dates[dates.length - 1]],
    )
    const seen = new Set(existing.rows.map((r) => workoutKey(r.planned_date, r.name)))
    const skipped: string[] = []
    const saved: { plan_id: string; planned_date: string; name: string }[] = []

    for (const workout of workouts) {
      const key = workoutKey(workout.planned_date, workout.name)
      if (seen.has(key)) {
        skipped.push(`${workout.planned_date}: ${workout.name}`)
        continue
      }
      seen.add(key)
      const { rows } = await db.query<{ id: string }>(
        `insert into public.workout_plans (user_id, name, workout_type, planned_date, notes)
         values ($1, $2, $3, $4::date, $5)
         returning id`,
        [userId, workout.name.trim(), workout.workout_type, workout.planned_date, workout.notes.trim() || null],
      )
      const planId = rows[0]!.id
      await insertExercises(
        db,
        userId,
        planId,
        workout.exercises.map((e) => exerciseToRow(e, unit_system)),
      )
      saved.push({ plan_id: planId, planned_date: workout.planned_date, name: workout.name.trim() })
    }

    return {
      result: { saved: saved.length, plans: saved, skipped_already_planned: skipped },
      summary: createdSummary(saved),
      createdIds: saved.map((s) => s.plan_id),
      resource: 'workout-plans',
      changes: await insertedChanges(
        db,
        'workout-plans',
        saved.map((s) => s.plan_id),
      ),
    }
  },
})

export const updateWorkoutPlan = defineTool({
  title: 'Edit a planned workout',
  scope: 'write',
  destructive: true,
  idempotent: true,
  definition: {
    name: 'update_workout_plan',
    description: `Edit one planned workout. Call get_workout_plans first, then send the plan_id and the whole workout as it should be after the edit: name, type, date, notes and the full exercise list in order. The exercise list replaces the old one, so include exercises that stay the same. A new planned_date must be between today and ${PLAN_HORIZON_DAYS} days from today; an unchanged date may be in the past. Whether the workout was completed is kept. The result includes the previous version, which you can send back to revert the edit.`,
    input_schema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', format: 'uuid', description: 'From get_workout_plans' },
        unit_system: unitSystemJson,
        workout: workoutJson,
      },
      required: ['plan_id', 'unit_system', 'workout'],
      additionalProperties: false,
    },
  },
  schema: z.object({
    plan_id: rowId('get_workout_plans'),
    unit_system: z.enum(UNIT_SYSTEMS),
    workout: workoutSchema,
  }),
  async run({ plan_id, unit_system, workout }, { db, userId, today }) {
    const found = await db.query<PlanRow>(
      `select id, name, workout_type, planned_date, notes, completed_at
         from public.workout_plans
        where id = $1 and user_id = $2
        for update`,
      [plan_id, userId],
    )
    const before = found.rows[0]
    if (!before) {
      throw new ToolInputError('No workout plan with that plan_id. Call get_workout_plans to find it.')
    }
    if (workout.planned_date !== before.planned_date) {
      const problem = dateProblem(workout.planned_date, today)
      if (problem) throw new ToolInputError(`Nothing was changed: ${problem}`)
    }

    const beforeExercises = (await exercisesByPlan(db, [plan_id])).get(plan_id) ?? []
    const beforeSnapshot = await snapshotRows(db, 'workout-plans', [plan_id])
    const units = await unitSystemOf(db, userId)

    const updated = await db.query<PlanRow>(
      `update public.workout_plans
          set name = $3, workout_type = $4, planned_date = $5::date, notes = $6
        where id = $1 and user_id = $2
        returning id, name, workout_type, planned_date, notes, completed_at`,
      [plan_id, userId, workout.name.trim(), workout.workout_type, workout.planned_date, workout.notes.trim() || null],
    )
    const after = updated.rows[0]!
    const rows = workout.exercises.map((e) => exerciseToRow(e, unit_system))
    await db.query('delete from public.workout_plan_exercises where plan_id = $1 and user_id = $2', [plan_id, userId])
    await insertExercises(db, userId, plan_id, rows)

    return {
      result: {
        updated: describePlan(after, rows, units),
        previous: describePlan(before, beforeExercises, units),
        unit_system: units,
      },
      summary: updatedSummary(after),
      resource: 'workout-plans',
      changes: { before: beforeSnapshot, after: await snapshotRows(db, 'workout-plans', [plan_id]) },
    }
  },
})

// ─── Removing and completing (AI apps only) ─────────────────────────────────

export const deleteWorkoutPlans = defineTool({
  title: 'Remove planned workouts',
  scope: 'write',
  destructive: true,
  idempotent: true,
  surfaces: { coach: false },
  definition: {
    name: 'delete_workout_plans',
    description: `Remove planned workouts, with their exercises, by plan_id (at most ${MAX_WORKOUT_REMOVALS} per call). Call get_workout_plans first for the ids, and only remove what the user asked for. To change a workout, use update_workout_plan instead. Workouts the user already logged stay in their history. If any plan_id is unknown, nothing is removed.`,
    input_schema: {
      type: 'object',
      properties: {
        plan_ids: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'From get_workout_plans' },
      },
      required: ['plan_ids'],
      additionalProperties: false,
    },
  },
  schema: z.object({ plan_ids: z.array(rowId('get_workout_plans')).min(1).max(MAX_WORKOUT_REMOVALS) }),
  async run({ plan_ids }, { db, userId }) {
    await lockOwnRows(db, 'workout-plans', userId, plan_ids, 'removed')
    await requireUnlinkedPlans(db, 'workout-plans', plan_ids)
    const before = (await snapshotRows(db, 'workout-plans', plan_ids)).map((row): typeof row => ({ ...row, links_checked: true }))
    // Exercises go with the plan (on delete cascade); logged sessions keep
    // their data and lose only the link (on delete set null).
    await db.query('delete from public.workout_plans where id = any($1::uuid[]) and user_id = $2', [plan_ids, userId])
    const removed = before.map((row) => ({ planned_date: String(row.planned_date), name: String(row.name) }))
    return {
      result: { removed },
      summary:
        removed.length === 1
          ? `Removed ${removed[0]!.name} on ${dayLabel(removed[0]!.planned_date)}`
          : `Removed ${plural(removed.length, 'planned workout')}`,
      resource: 'workout-plans',
      changes: { before, after: [] },
    }
  },
})

export const completeWorkoutPlan = defineTool({
  title: 'Mark a workout done',
  scope: 'write',
  idempotent: true,
  surfaces: { coach: false },
  definition: {
    name: 'complete_workout_plan',
    description:
      'Tick a planned workout off as done (completed: true), or un-tick it (completed: false), like the checkbox in Plans → Workouts. Call get_workout_plans first for the plan_id. This only marks the plan; it does not log sets or reps.',
    input_schema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', format: 'uuid', description: 'From get_workout_plans' },
        completed: { type: 'boolean' },
      },
      required: ['plan_id', 'completed'],
      additionalProperties: false,
    },
  },
  schema: z.object({ plan_id: rowId('get_workout_plans'), completed: z.boolean() }),
  async run({ plan_id, completed }, { db, userId }) {
    const [plan] = await lockOwnRows<{ id: string; name: string; planned_date: string; completed_at: string | null }>(
      db,
      'workout-plans',
      userId,
      [plan_id],
      'changed',
      'id, name, planned_date, completed_at',
    )
    const { name, planned_date } = plan!
    const label = `${name} on ${dayLabel(planned_date)}`
    if ((plan!.completed_at != null) === completed) {
      return {
        result: { plan_id, completed, unchanged: true },
        summary: completed ? `${label} was already done` : `${label} wasn't marked done`,
        resource: 'workout-plans',
        changes: { before: [], after: [] },
      }
    }
    const before = await snapshotRows(db, 'workout-plans', [plan_id])
    await db.query(
      `update public.workout_plans
          set completed_at = case when $3 then now() else null end
        where id = $1 and user_id = $2`,
      [plan_id, userId, completed],
    )
    return {
      result: { plan_id, completed },
      summary: completed ? `Marked ${label} done` : `Marked ${label} not done`,
      resource: 'workout-plans',
      changes: { before, after: await snapshotRows(db, 'workout-plans', [plan_id]) },
    }
  },
})
