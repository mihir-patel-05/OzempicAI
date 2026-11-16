import type { Db } from '../../db.js'
import type { ToolResource } from './types.js'
import { HttpError } from '../../http.js'

/**
 * Row snapshots taken around a write, so the activity feed can undo it.
 *
 * A snapshot is the row as Postgres renders it with to_jsonb(), so taking the
 * same snapshot later gives an identical value unless the row changed. A
 * workout plan's snapshot also carries its exercises (without their ids,
 * which update_workout_plan replaces).
 */
export type RowSnapshot = { id: string } & Record<string, unknown>

export interface RowChanges {
  /** The affected rows before the write. Empty for inserts. */
  before: RowSnapshot[]
  /** The same rows after the write. Empty for deletes. */
  after: RowSnapshot[]
}

/** The table behind each resource. Fixed strings only: they are interpolated into SQL. */
export const RESOURCE_TABLES: Record<ToolResource, string> = {
  'grocery-items': 'grocery_items',
  'meal-plans': 'meal_plans',
  'workout-plans': 'workout_plans',
}

/** Call with the parent rows locked FOR UPDATE so new links cannot race deletion. */
export async function requireUnlinkedPlans(db: Db, resource: ToolResource, ids: readonly string[]): Promise<void> {
  if (resource === 'grocery-items' || ids.length === 0) return
  const table = resource === 'meal-plans' ? 'grocery_items' : 'workout_sessions'
  const column = resource === 'meal-plans' ? 'meal_plan_id' : 'plan_id'
  const { rows } = await db.query<{ linked: boolean }>(
    `select exists (select 1 from public.${table} where ${column} = any($1::uuid[])) as linked`,
    [ids],
  )
  // ON DELETE SET NULL would destroy links that the parent snapshot cannot
  // restore. Refuse the whole operation instead of reporting a partial Undo.
  if (rows[0]?.linked) throw new HttpError(409, 'This plan has linked groceries or logged workouts. Remove those links before deleting or undoing this plan.')
}

const SNAPSHOT_SQL: Record<ToolResource, string> = {
  'grocery-items': 'select to_jsonb(t) as row from public.grocery_items t where t.id = any($1::uuid[])',
  'meal-plans': 'select to_jsonb(t) as row from public.meal_plans t where t.id = any($1::uuid[])',
  'workout-plans': `
    select to_jsonb(p) || jsonb_build_object('exercises', coalesce((
             select jsonb_agg(to_jsonb(e) - 'id' - 'plan_id' - 'created_at' order by e.position, e.created_at)
               from public.workout_plan_exercises e
              where e.plan_id = p.id
           ), '[]'::jsonb)) as row
      from public.workout_plans p
     where p.id = any($1::uuid[])`,
}

/** Snapshots of the rows with these ids that still exist, in the order of `ids`. */
export async function snapshotRows(db: Db, resource: ToolResource, ids: readonly string[]): Promise<RowSnapshot[]> {
  if (ids.length === 0) return []
  const { rows } = await db.query<{ row: RowSnapshot }>(SNAPSHOT_SQL[resource], [ids])
  const byId = new Map(rows.map((r) => [r.row.id.toLowerCase(), r.row]))
  return ids.flatMap((id) => byId.get(id.toLowerCase()) ?? [])
}

/** Changes for rows a tool inserted. */
export async function insertedChanges(db: Db, resource: ToolResource, ids: readonly string[]): Promise<RowChanges> {
  return { before: [], after: await snapshotRows(db, resource, ids) }
}

/** Deep equality for JSON values, ignoring object key order. */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => sameJson(item, b[i]))
  }
  const ak = Object.keys(a as object)
  const bk = Object.keys(b as object)
  if (ak.length !== bk.length) return false
  return ak.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      sameJson((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  )
}
