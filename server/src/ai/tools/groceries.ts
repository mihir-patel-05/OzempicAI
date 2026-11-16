import { z } from 'zod'
import { insertedChanges, snapshotRows } from './snapshots.js'
import { lockOwnRows } from './rows.js'
import { defineTool, plural, rowId } from './types.js'

/** Matches the grocery_items.category check constraint and GroceryCategory. */
export const GROCERY_CATEGORIES = [
  'produce',
  'dairy',
  'protein',
  'grains',
  'beverages',
  'snacks',
  'other',
] as const

export const MAX_GROCERY_ITEMS = 40
const MAX_NAME = 80
const LIST_LIMIT = 300
export const MAX_GROCERY_REMOVALS = 100
/** Purchased items cleared per call; the result says when more remain. */
export const MAX_CLEARED = 500

/** Case- and whitespace-insensitive key for duplicate checks. */
export function groceryKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Trimmed, with runs of whitespace collapsed. */
function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export interface GroceryInput {
  name: string
  category: (typeof GROCERY_CATEGORIES)[number]
}

/**
 * Split requested items into those to insert and those to skip: duplicates
 * within the request, and names already on the list and not yet purchased.
 */
export function filterNewGroceries(items: GroceryInput[], existingUnpurchased: string[]) {
  const seen = new Set(existingUnpurchased.map(groceryKey))
  const toAdd: GroceryInput[] = []
  const skipped: string[] = []
  for (const item of items) {
    const name = cleanName(item.name)
    const key = groceryKey(name)
    if (seen.has(key)) {
      skipped.push(name)
      continue
    }
    seen.add(key)
    toAdd.push({ name, category: item.category })
  }
  return { toAdd, skipped }
}

export const getGroceryList = defineTool({
  title: 'Get grocery list',
  scope: 'read',
  definition: {
    name: 'get_grocery_list',
    description:
      "Get the user's grocery list, each item with its id. Call this before adding items so you don't add duplicates. Set include_purchased to false unless the user asks about items they already bought.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: { include_purchased: { type: 'boolean' } },
      required: ['include_purchased'],
      additionalProperties: false,
    },
  },
  schema: z.object({ include_purchased: z.boolean() }),
  async run({ include_purchased }, { db, userId }) {
    const { rows } = await db.query<{ id: string; name: string; category: string; is_purchased: boolean }>(
      `select id, name, category, is_purchased
         from public.grocery_items
        where user_id = $1 and ($2 or not is_purchased)
        order by is_purchased asc, category asc, created_at desc
        limit $3`,
      [userId, include_purchased, LIST_LIMIT],
    )
    return {
      result: {
        count: rows.length,
        items: rows.map((r) =>
          r.is_purchased
            ? { id: r.id, name: r.name, category: r.category, purchased: true }
            : { id: r.id, name: r.name, category: r.category },
        ),
      },
    }
  },
})

export const addGroceryItems = defineTool({
  title: 'Add grocery items',
  scope: 'write',
  idempotent: true,
  definition: {
    name: 'add_grocery_items',
    description: `Add items to the user's grocery list (at most ${MAX_GROCERY_ITEMS} per call, names up to ${MAX_NAME} characters). Combine duplicates first and use short, shoppable names with a quantity when useful, e.g. "Chicken breast (2 lb)". Items already on the list and not yet purchased are skipped automatically. Only add what the user asked for or agreed to.`,
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              category: { type: 'string', enum: [...GROCERY_CATEGORIES] },
            },
            required: ['name', 'category'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  },
  schema: z.object({
    items: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(MAX_NAME),
          category: z.enum(GROCERY_CATEGORIES),
        }),
      )
      .min(1)
      .max(MAX_GROCERY_ITEMS),
  }),
  async run({ items }, { db, userId }) {
    const existing = await db.query<{ name: string }>(
      // Bounded: the list is only used to skip duplicates.
      'select name from public.grocery_items where user_id = $1 and not is_purchased order by created_at desc limit 2000',
      [userId],
    )
    const { toAdd, skipped } = filterNewGroceries(
      items,
      existing.rows.map((r) => r.name),
    )

    let inserted: { id: string; name: string }[] = []
    if (toAdd.length > 0) {
      const result = await db.query<{ id: string; name: string }>(
        `insert into public.grocery_items (user_id, name, category)
         select $1, item.name, item.category
           from unnest($2::text[], $3::text[]) with ordinality as item(name, category, n)
          order by item.n
         returning id, name`,
        [userId, toAdd.map((i) => i.name), toAdd.map((i) => i.category)],
      )
      inserted = result.rows
    }

    const n = inserted.length
    return {
      result: { added: inserted.map((r) => r.name), skipped_duplicates: skipped },
      summary:
        n > 0
          ? `Added ${n} item${n === 1 ? '' : 's'} to Groceries`
          : 'Everything was already on your grocery list',
      createdIds: inserted.map((r) => r.id),
      resource: 'grocery-items',
      changes: await insertedChanges(
        db,
        'grocery-items',
        inserted.map((r) => r.id),
      ),
    }
  },
})

// ─── Editing (AI apps only) ─────────────────────────────────────────────────

const itemEdit = z
  .object({
    id: rowId('get_grocery_list'),
    name: z.string().trim().min(1).max(MAX_NAME).optional(),
    category: z.enum(GROCERY_CATEGORIES).optional(),
    purchased: z.boolean().optional(),
  })
  .refine((edit) => edit.name !== undefined || edit.category !== undefined || edit.purchased !== undefined, {
    message: 'give at least one of name, category or purchased',
  })

export const updateGroceryItems = defineTool({
  title: 'Edit grocery items',
  scope: 'write',
  destructive: true,
  idempotent: true,
  surfaces: { coach: false },
  definition: {
    name: 'update_grocery_items',
    description: `Edit items on the user's grocery list: rename, change category, or mark purchased (true) or still needed (false). Call get_grocery_list first for the ids. Send only the fields that change; at most ${MAX_GROCERY_ITEMS} items per call, names up to ${MAX_NAME} characters. If any id is unknown, nothing is changed.`,
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid', description: 'From get_grocery_list' },
              name: { type: 'string' },
              category: { type: 'string', enum: [...GROCERY_CATEGORIES] },
              purchased: { type: 'boolean' },
            },
            required: ['id'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  },
  schema: z.object({ items: z.array(itemEdit).min(1).max(MAX_GROCERY_ITEMS) }),
  async run({ items }, { db, userId }) {
    const ids = items.map((item) => item.id)
    await lockOwnRows(db, 'grocery-items', userId, ids, 'changed')
    const before = await snapshotRows(db, 'grocery-items', ids)
    const { rows } = await db.query<{ id: string; name: string; category: string; is_purchased: boolean }>(
      `update public.grocery_items g
          set name = coalesce(u.name, g.name),
              category = coalesce(u.category, g.category),
              is_purchased = coalesce(u.purchased, g.is_purchased)
         from unnest($2::uuid[], $3::text[], $4::text[], $5::boolean[]) as u(id, name, category, purchased)
        where g.id = u.id and g.user_id = $1
        returning g.id, g.name, g.category, g.is_purchased`,
      [
        userId,
        ids,
        items.map((item) => (item.name === undefined ? null : cleanName(item.name))),
        items.map((item) => item.category ?? null),
        items.map((item) => item.purchased ?? null),
      ],
    )
    const after = await snapshotRows(db, 'grocery-items', ids)
    return {
      result: {
        updated: rows.map((r) => ({ id: r.id, name: r.name, category: r.category, purchased: r.is_purchased })),
      },
      summary: `Updated ${plural(rows.length, 'grocery item')}`,
      resource: 'grocery-items',
      changes: { before, after },
    }
  },
})

export const removeGroceryItems = defineTool({
  title: 'Remove grocery items',
  scope: 'write',
  destructive: true,
  idempotent: true,
  surfaces: { coach: false },
  definition: {
    name: 'remove_grocery_items',
    description: `Remove items from the user's grocery list by id (at most ${MAX_GROCERY_REMOVALS} per call). Call get_grocery_list first for the ids, and only remove what the user asked for. To remove everything already bought, use clear_purchased_groceries instead. If any id is unknown, nothing is removed.`,
    input_schema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string', format: 'uuid' }, description: 'From get_grocery_list' },
      },
      required: ['ids'],
      additionalProperties: false,
    },
  },
  schema: z.object({ ids: z.array(rowId('get_grocery_list')).min(1).max(MAX_GROCERY_REMOVALS) }),
  async run({ ids }, { db, userId }) {
    await lockOwnRows(db, 'grocery-items', userId, ids, 'removed')
    const before = await snapshotRows(db, 'grocery-items', ids)
    await db.query('delete from public.grocery_items where id = any($1::uuid[]) and user_id = $2', [ids, userId])
    return {
      result: { removed: before.map((row) => row.name) },
      summary: `Removed ${plural(before.length, 'item')} from Groceries`,
      resource: 'grocery-items',
      changes: { before, after: [] },
    }
  },
})

export const clearPurchasedGroceries = defineTool({
  title: 'Clear purchased groceries',
  scope: 'write',
  destructive: true,
  idempotent: true,
  surfaces: { coach: false },
  definition: {
    name: 'clear_purchased_groceries',
    description:
      "Remove every item the user has marked purchased from their grocery list, leaving the items they still need. Use when the user says they finished shopping or asks to clean up the list.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  schema: z.object({}),
  async run(_input, { db, userId }) {
    const { rows } = await db.query<{ id: string }>(
      `select id from public.grocery_items
        where user_id = $1 and is_purchased
        order by created_at
        limit $2
          for update`,
      [userId, MAX_CLEARED + 1],
    )
    const ids = rows.slice(0, MAX_CLEARED).map((r) => r.id)
    const before = await snapshotRows(db, 'grocery-items', ids)
    if (ids.length > 0) {
      await db.query('delete from public.grocery_items where id = any($1::uuid[]) and user_id = $2', [ids, userId])
    }
    const more = rows.length > MAX_CLEARED
    return {
      result: { removed: ids.length, ...(more ? { more_remain: true } : {}) },
      summary:
        ids.length > 0 ? `Cleared ${plural(ids.length, 'purchased item')} from Groceries` : 'No purchased items to clear',
      resource: 'grocery-items',
      changes: { before, after: [] },
    }
  },
})
