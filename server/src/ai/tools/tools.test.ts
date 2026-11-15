import assert from 'node:assert/strict'
import { test } from 'node:test'
import type Anthropic from '@anthropic-ai/sdk'
import type { Db } from '../../db.js'
import { summarizeCalories } from './calories.js'
import { filterNewGroceries } from './groceries.js'
import { TOOL_DEFINITIONS, executeTool } from './index.js'
import { formatSpan, mealPlanProblems } from './mealPlans.js'
import type { ToolContext } from './types.js'

test('summarizeCalories treats unlogged days as no data, not zero', () => {
  const summary = summarizeCalories(
    [
      { day: '2026-11-09', meal_type: 'breakfast', calories: 400 },
      { day: '2026-11-09', meal_type: 'dinner', calories: 900 },
      { day: '2026-11-14', meal_type: 'lunch', calories: 2100 },
      { day: '2026-11-20', meal_type: 'lunch', calories: 999 }, // outside the range
    ],
    { start: '2026-11-09', end: '2026-11-15' },
    1800,
  )
  assert.equal(summary.days_in_range, 7)
  assert.equal(summary.days_logged, 2)
  assert.equal(summary.total_calories, 3400)
  assert.equal(summary.avg_per_logged_day, 1700)
  assert.equal(summary.avg_logged_weekday, 1300)
  assert.equal(summary.avg_logged_weekend, 2100)
  assert.equal(summary.days_over_goal, 1)
  assert.equal(summary.days_at_or_under_goal, 1)
  assert.equal(summary.days[1]!.total, null)
  assert.deepEqual(summary.days[0]!.by_meal, { breakfast: 400, dinner: 900 })
  assert.equal(summary.days[0]!.weekday, 'Mon')
})

test('summarizeCalories with no logs has no averages', () => {
  const summary = summarizeCalories([], { start: '2026-11-09', end: '2026-11-15' }, 2000)
  assert.equal(summary.days_logged, 0)
  assert.equal(summary.avg_per_logged_day, null)
  assert.ok(summary.days.every((d) => d.total === null))
})

test('filterNewGroceries skips unpurchased matches and repeats, ignoring case and spacing', () => {
  const { toAdd, skipped } = filterNewGroceries(
    [
      { name: 'Eggs', category: 'protein' },
      { name: '  greek   yogurt ', category: 'dairy' },
      { name: 'Spinach', category: 'produce' },
      { name: 'spinach', category: 'produce' },
    ],
    ['eggs'],
  )
  assert.deepEqual(toAdd, [
    { name: 'greek yogurt', category: 'dairy' },
    { name: 'Spinach', category: 'produce' },
  ])
  assert.deepEqual(skipped, ['Eggs', 'spinach'])
})

test('mealPlanProblems enforces real dates within today..today+21', () => {
  const meal = (planned_date: string) => ({ planned_date, meal_type: 'dinner' as const, name: 'Tacos', calories: 600 })
  assert.deepEqual(mealPlanProblems([meal('2026-11-14'), meal('2026-12-05')], '2026-11-14'), [])
  const problems = mealPlanProblems(
    [meal('2026-11-13'), meal('2026-12-06'), meal('2026-02-30'), meal('next monday')],
    '2026-11-14',
  )
  assert.equal(problems.length, 4)
  assert.match(problems[0]!, /between 2026-11-14 and 2026-12-05/)
  assert.match(problems[2]!, /real date/)
})

test('formatSpan', () => {
  assert.equal(formatSpan('2026-11-16', '2026-11-22'), 'Nov 16–22')
  assert.equal(formatSpan('2026-11-30', '2026-12-06'), 'Nov 30–Dec 6')
  assert.equal(formatSpan('2026-11-16', '2026-11-16'), 'Nov 16')
})

// ─── executeTool with a fake database ───────────────────────────────────────

function fakeDb(handler: (sql: string, params: unknown[]) => unknown[] = () => []) {
  const calls: string[] = []
  const db = {
    async query(sql: string, params: unknown[] = []) {
      calls.push(sql)
      return { rows: handler(sql, params), rowCount: 0 }
    },
  } as unknown as Db
  return { db, calls }
}

function ctx(db: Db): ToolContext {
  return { db, userId: '00000000-0000-0000-0000-000000000001', tz: 'UTC', today: '2026-11-14' }
}

function toolUse(name: string, input: unknown): Anthropic.Beta.BetaToolUseBlock {
  return { type: 'tool_use', id: 'toolu_test', name, input } as Anthropic.Beta.BetaToolUseBlock
}

test('executeTool rejects unknown tools and invalid input without touching the database', async () => {
  const { db, calls } = fakeDb()
  const unknown = await executeTool(toolUse('delete_everything', {}), ctx(db))
  assert.equal(unknown.result.is_error, true)
  assert.equal(unknown.event.status, 'error')

  const badCategory = await executeTool(
    toolUse('add_grocery_items', { items: [{ name: 'Milk', category: 'frozen' }] }),
    ctx(db),
  )
  assert.equal(badCategory.result.is_error, true)

  const tooMany = await executeTool(
    toolUse('add_grocery_items', {
      items: Array.from({ length: 41 }, (_, i) => ({ name: `Item ${i}`, category: 'other' })),
    }),
    ctx(db),
  )
  assert.equal(tooMany.result.is_error, true)

  const zeroCalories = await executeTool(
    toolUse('create_meal_plan', {
      meals: [{ planned_date: '2026-11-16', meal_type: 'dinner', name: 'Soup', calories: 0 }],
    }),
    ctx(db),
  )
  assert.equal(zeroCalories.result.is_error, true)
  assert.equal(calls.length, 0)
})

test('create_meal_plan saves nothing when any date is out of range', async () => {
  const { db, calls } = fakeDb()
  const out = await executeTool(
    toolUse('create_meal_plan', {
      meals: [
        { planned_date: '2026-11-16', meal_type: 'dinner', name: 'Soup', calories: 500 },
        { planned_date: '2027-01-01', meal_type: 'dinner', name: 'Stew', calories: 600 },
      ],
    }),
    ctx(db),
  )
  assert.equal(out.result.is_error, true)
  assert.match(String(out.result.content), /Nothing was saved/)
  assert.equal(calls.length, 0)
})

test('add_grocery_items reports created ids and skipped duplicates', async () => {
  const { db, calls } = fakeDb((sql) => {
    if (sql.includes('not is_purchased')) return [{ name: 'Eggs' }]
    if (sql.includes('insert into public.grocery_items')) return [{ id: 'g1', name: 'Milk' }]
    return []
  })
  const out = await executeTool(
    toolUse('add_grocery_items', {
      items: [
        { name: 'eggs', category: 'protein' },
        { name: 'Milk', category: 'dairy' },
      ],
    }),
    ctx(db),
  )
  assert.equal(out.result.is_error, undefined)
  assert.deepEqual(JSON.parse(String(out.result.content)), { added: ['Milk'], skipped_duplicates: ['eggs'] })
  assert.deepEqual(out.event.created_ids, ['g1'])
  assert.equal(out.event.resource, 'grocery-items')
  assert.equal(out.event.summary, 'Added 1 item to Groceries')
  assert.equal(calls.length, 2)
})

// ─── Tool definitions ───────────────────────────────────────────────────────

const UNSUPPORTED_STRICT_KEYWORDS = ['minimum', 'maximum', 'multipleOf', 'minLength', 'maxLength', 'maxItems']

function walk(node: unknown, visit: (obj: Record<string, unknown>) => void) {
  if (!node || typeof node !== 'object') return
  visit(node as Record<string, unknown>)
  for (const value of Object.values(node)) walk(value, visit)
}

test('strict tool schemas avoid keywords structured outputs rejects', () => {
  for (const tool of TOOL_DEFINITIONS) {
    assert.equal(tool.strict, true, `${tool.name} should be strict`)
    walk(tool.input_schema, (obj) => {
      for (const keyword of UNSUPPORTED_STRICT_KEYWORDS) {
        assert.ok(!(keyword in obj), `${tool.name} uses unsupported keyword ${keyword}`)
      }
      if (obj.type === 'object') {
        assert.equal(obj.additionalProperties, false, `${tool.name}: objects need additionalProperties false`)
        const props = Object.keys((obj.properties as object) ?? {})
        assert.deepEqual([...((obj.required as string[]) ?? [])].sort(), props.sort(), `${tool.name}: all properties required`)
      }
    })
  }
})

test('tool definitions are sorted and unique', () => {
  const names = TOOL_DEFINITIONS.map((t) => t.name)
  assert.deepEqual(names, [...names].sort())
  assert.equal(new Set(names).size, names.length)
  // No tool can delete data or mark items purchased.
  assert.ok(names.every((n) => !/delete|remove|purchase/.test(n)))
})
