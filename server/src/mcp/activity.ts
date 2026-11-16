import type { Db } from '../db.js'
import { HttpError } from '../http.js'
import { RESOURCE_TABLES, sameJson, snapshotRows } from '../ai/tools/snapshots.js'
import type { RowSnapshot } from '../ai/tools/snapshots.js'
import type { ToolResource } from '../ai/tools/types.js'

/**
 * The activity feed of changes AI apps made over MCP (Plans → AI activity),
 * and Undo. Every function here takes a `db` from withUser(), so row level
 * security limits it to the caller's own rows.
 */

export interface ActivityEntry {
  id: string
  client_name: string
  tool_name: string
  summary: string | null
  resource: ToolResource | null
  created_at: string
  undone_at: string | null
  can_undo: boolean
}

export async function listActivity(db: Db, userId: string, limit: number): Promise<ActivityEntry[]> {
  const { rows } = await db.query<ActivityEntry>(
    `select id, client_name, tool_name, summary, resource, created_at, undone_at,
            (before is not null and after is not null and undone_at is null) as can_undo
       from public.agent_activity
      where user_id = $1
      order by created_at desc
      limit $2`,
    [userId, limit],
  )
  return rows
}

function isResource(value: unknown): value is ToolResource {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(RESOURCE_TABLES, value)
}

/**
 * Put back what one write changed: delete the rows it inserted, restore rows
 * it edited and re-insert rows it removed (with their original ids).
 *
 * Refuses with 409, changing nothing, if any of those rows changed since the
 * write (the user edited it, or a later write did), so Undo never overwrites
 * newer data. Throws HttpError; the caller's transaction rolls back on error.
 */
export async function undoActivity(db: Db, userId: string, id: string): Promise<{ resource: ToolResource; summary: string | null }> {
  const { rows } = await db.query<{
    resource: string | null
    summary: string | null
    before: RowSnapshot[] | null
    after: RowSnapshot[] | null
    undone_at: string | null
  }>(
    `select resource, summary, before, after, undone_at
       from public.agent_activity
      where id = $1 and user_id = $2
        for update`,
    [id, userId],
  )
  const entry = rows[0]
  if (!entry) throw new HttpError(404, 'Activity not found')
  if (entry.undone_at) throw new HttpError(409, 'This change was already undone.')
  const { resource, before, after } = entry
  if (!isResource(resource) || !Array.isArray(before) || !Array.isArray(after)) {
    throw new HttpError(409, 'This change can’t be undone.')
  }

  const beforeIds = new Set(before.map((row) => row.id))
  const afterIds = new Set(after.map((row) => row.id))
  const ids = [...new Set([...beforeIds, ...afterIds])]
  const table = RESOURCE_TABLES[resource]

  // Lock first so nothing changes between the check and the restore.
  await db.query(`select id from public.${table} where id = any($1::uuid[]) and user_id = $2 for update`, [ids, userId])
  const current = new Map((await snapshotRows(db, resource, ids)).map((row) => [row.id, row]))

  const changedSince =
    after.some((row) => !sameJson(current.get(row.id), row)) ||
    before.some((row) => !afterIds.has(row.id) && current.has(row.id))
  if (changedSince) {
    throw new HttpError(409, 'This was changed again since, so Undo would overwrite newer edits. Nothing was undone.')
  }

  const inserted = after.filter((row) => !beforeIds.has(row.id)).map((row) => row.id)
  const edited = before.filter((row) => afterIds.has(row.id))
  const removed = before.filter((row) => !afterIds.has(row.id))

  if (inserted.length > 0) {
    await db.query(`delete from public.${table} where id = any($1::uuid[]) and user_id = $2`, [inserted, userId])
  }
  if (edited.length > 0) await RESTORE[resource].update(db, userId, edited)
  if (removed.length > 0) await RESTORE[resource].insert(db, userId, removed)

  await db.query('update public.agent_activity set undone_at = now() where id = $1 and user_id = $2', [id, userId])
  return { resource, summary: entry.summary }
}

// ─── Restoring rows from snapshots ──────────────────────────────────────────
//
// Column lists are written out per table so a snapshot can only ever set the
// columns a write could have changed, and user_id always comes from the
// caller rather than the stored row.

interface Restorer {
  /** Set rows that still exist back to their snapshot. */
  update(db: Db, userId: string, rows: RowSnapshot[]): Promise<void>
  /** Re-create removed rows with their original ids. */
  insert(db: Db, userId: string, rows: RowSnapshot[]): Promise<void>
}

const json = (rows: RowSnapshot[]) => JSON.stringify(rows)

async function restoreExercises(db: Db, userId: string, plans: RowSnapshot[]) {
  await db.query(
    `insert into public.workout_plan_exercises
       (plan_id, user_id, position, exercise_name, machine, target_sets, target_reps,
        target_weight_kg, target_duration_minutes, target_distance_km)
     select (p->>'id')::uuid, $2, e.position, e.exercise_name, e.machine, e.target_sets, e.target_reps,
            e.target_weight_kg, e.target_duration_minutes, e.target_distance_km
       from jsonb_array_elements($1::jsonb) p
      cross join lateral jsonb_populate_recordset(null::public.workout_plan_exercises, coalesce(p->'exercises', '[]'::jsonb)) e`,
    [json(plans), userId],
  )
}

const RESTORE: Record<ToolResource, Restorer> = {
  'grocery-items': {
    async update(db, userId, rows) {
      await db.query(
        `update public.grocery_items t
            set name = r.name, category = r.category, is_purchased = r.is_purchased
           from jsonb_populate_recordset(null::public.grocery_items, $1::jsonb) r
          where t.id = r.id and t.user_id = $2`,
        [json(rows), userId],
      )
    },
    async insert(db, userId, rows) {
      // The meal plan an item came from may be gone by now; keep the item.
      await db.query(
        `insert into public.grocery_items (id, user_id, name, category, is_purchased, meal_plan_id, created_at)
         select r.id, $2, r.name, r.category, r.is_purchased,
                (select p.id from public.meal_plans p where p.id = r.meal_plan_id and p.user_id = $2),
                r.created_at
           from jsonb_populate_recordset(null::public.grocery_items, $1::jsonb) r`,
        [json(rows), userId],
      )
    },
  },
  'meal-plans': {
    async update(db, userId, rows) {
      await db.query(
        `update public.meal_plans t
            set planned_date = r.planned_date, meal_type = r.meal_type, name = r.name, calories = r.calories
           from jsonb_populate_recordset(null::public.meal_plans, $1::jsonb) r
          where t.id = r.id and t.user_id = $2`,
        [json(rows), userId],
      )
    },
    async insert(db, userId, rows) {
      await db.query(
        `insert into public.meal_plans (id, user_id, name, planned_date, meal_type, calories, created_at)
         select r.id, $2, r.name, r.planned_date, r.meal_type, r.calories, r.created_at
           from jsonb_populate_recordset(null::public.meal_plans, $1::jsonb) r`,
        [json(rows), userId],
      )
    },
  },
  'workout-plans': {
    async update(db, userId, rows) {
      await db.query(
        `update public.workout_plans t
            set name = r.name, workout_type = r.workout_type, planned_date = r.planned_date,
                notes = r.notes, completed_at = r.completed_at
           from jsonb_populate_recordset(null::public.workout_plans, $1::jsonb) r
          where t.id = r.id and t.user_id = $2`,
        [json(rows), userId],
      )
      await db.query('delete from public.workout_plan_exercises where plan_id = any($1::uuid[]) and user_id = $2', [
        rows.map((row) => row.id),
        userId,
      ])
      await restoreExercises(db, userId, rows)
    },
    async insert(db, userId, rows) {
      await db.query(
        `insert into public.workout_plans (id, user_id, name, workout_type, planned_date, notes, completed_at, created_at)
         select r.id, $2, r.name, r.workout_type, r.planned_date, r.notes, r.completed_at, r.created_at
           from jsonb_populate_recordset(null::public.workout_plans, $1::jsonb) r`,
        [json(rows), userId],
      )
      await restoreExercises(db, userId, rows)
    },
  },
}
