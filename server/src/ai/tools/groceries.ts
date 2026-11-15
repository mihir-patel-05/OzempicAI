import { z } from 'zod'
import { defineTool } from './types.js'

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

/** Case- and whitespace-insensitive key for duplicate checks. */
export function groceryKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
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
    const name = item.name.trim().replace(/\s+/g, ' ')
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
      "Get the user's grocery list. Call this before adding items so you don't add duplicates. Set include_purchased to false unless the user asks about items they already bought.",
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
    const { rows } = await db.query<{ name: string; category: string; is_purchased: boolean }>(
      `select name, category, is_purchased
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
          r.is_purchased ? { name: r.name, category: r.category, purchased: true } : { name: r.name, category: r.category },
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
      'select name from public.grocery_items where user_id = $1 and not is_purchased',
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
    }
  },
})
