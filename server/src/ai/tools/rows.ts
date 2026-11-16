import type { Db } from '../../db.js'
import { RESOURCE_TABLES } from './snapshots.js'
import { ToolInputError, missingIds, repeatedIds } from './types.js'
import type { ToolResource } from './types.js'

/** How to describe a resource's rows in errors the model reads. */
const ROW_NOUNS: Record<ToolResource, { noun: string; readTool: string }> = {
  'grocery-items': { noun: 'grocery item', readTool: 'get_grocery_list' },
  'meal-plans': { noun: 'planned meal', readTool: 'get_meal_plans' },
  'workout-plans': { noun: 'workout plan', readTool: 'get_workout_plans' },
}

/**
 * Lock the user's rows with these ids for the rest of the transaction and
 * return `columns` for each. Throws, naming every repeated or unknown id,
 * unless each id appears once and all of them exist. `action` completes
 * "Nothing was …" ("changed", "removed").
 *
 * `columns` must be a fixed string from the caller, never input.
 */
export async function lockOwnRows<T extends { id: string }>(
  db: Db,
  resource: ToolResource,
  userId: string,
  ids: readonly string[],
  action: string,
  columns = 'id',
): Promise<T[]> {
  const repeated = repeatedIds(ids)
  if (repeated.length > 0) {
    throw new ToolInputError(`Nothing was ${action}: each id may appear once (repeated: ${repeated.join(', ')}).`)
  }
  const { rows } = await db.query<T>(
    `select ${columns} from public.${RESOURCE_TABLES[resource]}
      where id = any($1::uuid[]) and user_id = $2
      order by id
        for update`,
    [ids, userId],
  )
  const missing = missingIds(
    ids,
    rows.map((r) => r.id),
  )
  if (missing.length > 0) {
    const { noun, readTool } = ROW_NOUNS[resource]
    throw new ToolInputError(`Nothing was ${action}: no ${noun} with id ${missing.join(', ')}. Call ${readTool} for current ids.`)
  }
  return rows
}
