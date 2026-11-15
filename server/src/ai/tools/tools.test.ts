import assert from 'node:assert/strict'
import { test } from 'node:test'
import type Anthropic from '@anthropic-ai/sdk'
import type { Db } from '../../db.js'
import { summarizeCalories } from './calories.js'
import { filterNewGroceries } from './groceries.js'
import { TOOL_DEFINITIONS, executeTool, runTool } from './index.js'
import { formatSpan, mealPlanProblems } from './mealPlans.js'
import type { ToolContext } from './types.js'
import { exerciseToRow, rowToExercise, workoutPlanProblems } from './workoutPlans.js'

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

test('runTool reports problems as messages and successes as outcomes', async () => {
  const { db, calls } = fakeDb((sql) => (sql.includes('from public.users') ? [{ daily_calorie_goal: 1800 }] : []))
  const unknown = await runTool('delete_everything', {}, ctx(db))
  assert.deepEqual(unknown, { ok: false, message: 'Unknown tool: delete_everything' })

  const invalid = await runTool('get_grocery_list', {}, ctx(db))
  assert.equal(invalid.ok, false)
  assert.equal(calls.length, 0)

  const ok = await runTool('get_profile', {}, ctx(db))
  assert.equal(ok.ok, true)
  assert.equal(ok.ok && (ok.outcome.result as { daily_calorie_goal: number }).daily_calorie_goal, 1800)
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

// The API's limits across all strict schemas in one request.
const MAX_STRICT_TOOLS = 20
const MAX_OPTIONAL_PARAMS = 24
const MAX_UNION_PARAMS = 16

// Tools left non-strict on purpose: their nested schemas compile to a grammar
// over the API's internal size cap, which the counted limits below can't see
// ("The compiled grammar is too large"). Zod still validates their input.
// Making either strict again needs a check against the real API first
// (npm run smoke:ai).
const NON_STRICT_TOOLS = new Set(['create_workout_plans', 'update_workout_plan'])

test('strict tool schemas avoid keywords structured outputs rejects and stay within limits', () => {
  let optional = 0
  let unions = 0
  for (const tool of TOOL_DEFINITIONS) {
    if (NON_STRICT_TOOLS.has(tool.name)) {
      assert.ok(!tool.strict, `${tool.name} must stay non-strict (grammar size limit)`)
      continue
    }
    assert.equal(tool.strict, true, `${tool.name} should be strict`)
    walk(tool.input_schema, (obj) => {
      for (const keyword of UNSUPPORTED_STRICT_KEYWORDS) {
        assert.ok(!(keyword in obj), `${tool.name} uses unsupported keyword ${keyword}`)
      }
      if (obj.type === 'object') {
        assert.equal(obj.additionalProperties, false, `${tool.name}: objects need additionalProperties false`)
        const props = Object.entries((obj.properties as Record<string, Record<string, unknown>>) ?? {})
        const required = (obj.required as string[]) ?? []
        for (const name of required) {
          assert.ok(props.some(([key]) => key === name), `${tool.name}: required ${name} is not a property`)
        }
        for (const [name, schema] of props) {
          if (!required.includes(name)) optional += 1
          if (Array.isArray(schema.type) || 'anyOf' in schema) unions += 1
        }
      }
    })
  }
  assert.ok(TOOL_DEFINITIONS.length <= MAX_STRICT_TOOLS, `${TOOL_DEFINITIONS.length} strict tools`)
  assert.ok(optional <= MAX_OPTIONAL_PARAMS, `${optional} optional parameters`)
  assert.ok(unions <= MAX_UNION_PARAMS, `${unions} union-typed parameters`)
})

test('tool definitions are sorted and unique', () => {
  const names = TOOL_DEFINITIONS.map((t) => t.name)
  assert.deepEqual(names, [...names].sort())
  assert.equal(new Set(names).size, names.length)
  // No tool can delete data or mark items purchased.
  assert.ok(names.every((n) => !/delete|remove|purchase/.test(n)))
})

// ─── Workout plans ──────────────────────────────────────────────────────────

const PLAN_ID = '11111111-2222-4333-8444-555555555555'

test('exerciseToRow converts imperial input to kg and km, and rowToExercise converts back', () => {
  const row = exerciseToRow({ exercise_name: ' Bench press ', machine: '  ', sets: 3, reps: 8, weight: 135 }, 'imperial')
  assert.equal(row.exercise_name, 'Bench press')
  assert.equal(row.machine, null)
  assert.ok(Math.abs(row.target_weight_kg! - 61.235) < 0.001)
  assert.equal(row.target_distance_km, null)
  assert.deepEqual(rowToExercise(row, 'imperial'), { exercise_name: 'Bench press', sets: 3, reps: 8, weight: 135 })

  const run = exerciseToRow({ exercise_name: 'Run', distance: 3.1, duration_minutes: 30 }, 'imperial')
  assert.ok(Math.abs(run.target_distance_km! - 4.989) < 0.001)
  assert.deepEqual(rowToExercise(run, 'metric'), { exercise_name: 'Run', duration_minutes: 30, distance: 4.99 })
})

test('workoutPlanProblems enforces real dates within today..today+21', () => {
  const workout = (planned_date: string) => ({
    name: 'Push day',
    workout_type: 'push' as const,
    planned_date,
    notes: '',
    exercises: [],
  })
  assert.deepEqual(workoutPlanProblems([workout('2026-11-14'), workout('2026-12-05')], '2026-11-14'), [])
  const problems = workoutPlanProblems([workout('2026-11-13'), workout('2026-02-30')], '2026-11-14')
  assert.equal(problems.length, 2)
  assert.match(problems[0]!, /between 2026-11-14 and 2026-12-05/)
  assert.match(problems[1]!, /real date/)
})

test('create_workout_plans rejects bad input without touching the database', async () => {
  const { db, calls } = fakeDb()
  const badType = await executeTool(
    toolUse('create_workout_plans', {
      unit_system: 'metric',
      workouts: [{ name: 'Yoga', workout_type: 'stretching', planned_date: '2026-11-16', notes: '', exercises: [] }],
    }),
    ctx(db),
  )
  assert.equal(badType.result.is_error, true)

  const pastDate = await executeTool(
    toolUse('create_workout_plans', {
      unit_system: 'metric',
      workouts: [{ name: 'Legs', workout_type: 'legs', planned_date: '2026-11-01', notes: '', exercises: [] }],
    }),
    ctx(db),
  )
  assert.equal(pastDate.result.is_error, true)
  assert.match(String(pastDate.result.content), /Nothing was saved/)
  assert.equal(calls.length, 0)
})

test('create_workout_plans saves plans with exercises, skips duplicates and reports ids for Undo', async () => {
  const inserted: unknown[][] = []
  const { db } = fakeDb((sql, params) => {
    if (sql.includes('select planned_date, name from public.workout_plans')) {
      return [{ planned_date: '2026-11-16', name: 'push day' }]
    }
    if (sql.includes('insert into public.workout_plans')) return [{ id: 'w1' }]
    if (sql.includes('insert into public.workout_plan_exercises')) inserted.push(params)
    return []
  })
  const out = await executeTool(
    toolUse('create_workout_plans', {
      unit_system: 'imperial',
      workouts: [
        { name: 'Push day', workout_type: 'push', planned_date: '2026-11-16', notes: '', exercises: [] },
        {
          name: 'Leg day',
          workout_type: 'legs',
          planned_date: '2026-11-19',
          notes: 'Rest 2 min',
          exercises: [
            { exercise_name: 'Back squat', sets: 4, reps: 6, weight: 185 },
            { exercise_name: 'Leg curl', machine: 'Seated leg curl', sets: 3, reps: 12 },
          ],
        },
      ],
    }),
    ctx(db),
  )
  assert.equal(out.result.is_error, undefined)
  const result = JSON.parse(String(out.result.content))
  assert.equal(result.saved, 1)
  assert.deepEqual(result.skipped_already_planned, ['2026-11-16: Push day'])
  assert.deepEqual(out.event.created_ids, ['w1'])
  assert.equal(out.event.resource, 'workout-plans')
  assert.equal(out.event.summary, 'Planned Leg day for Thu, Nov 19')
  assert.equal(inserted.length, 1)
  assert.deepEqual(inserted[0]![2], ['Back squat', 'Leg curl'])
  assert.deepEqual(inserted[0]![3], [null, 'Seated leg curl'])
})

test('update_workout_plan replaces the workout and returns the previous version', async () => {
  const { db, calls } = fakeDb((sql) => {
    if (sql.includes('for update')) {
      return [{ id: PLAN_ID, name: 'Push day', workout_type: 'push', planned_date: '2026-11-10', notes: null, completed_at: null }]
    }
    if (sql.includes('from public.workout_plan_exercises')) {
      return [
        {
          plan_id: PLAN_ID,
          exercise_name: 'Bench press',
          machine: null,
          target_sets: 3,
          target_reps: 8,
          target_weight_kg: 60,
          target_duration_minutes: null,
          target_distance_km: null,
        },
      ]
    }
    if (sql.includes('select unit_system')) return [{ unit_system: 'metric' }]
    if (sql.includes('update public.workout_plans')) {
      return [{ id: PLAN_ID, name: 'Push day', workout_type: 'push', planned_date: '2026-11-10', notes: 'Go light', completed_at: null }]
    }
    return []
  })
  const out = await executeTool(
    toolUse('update_workout_plan', {
      plan_id: PLAN_ID,
      unit_system: 'metric',
      workout: {
        name: 'Push day',
        workout_type: 'push',
        // Unchanged, so a past date is fine.
        planned_date: '2026-11-10',
        notes: 'Go light',
        exercises: [{ exercise_name: 'Incline dumbbell press', sets: 3, reps: 10, weight: 20 }],
      },
    }),
    ctx(db),
  )
  assert.equal(out.result.is_error, undefined)
  const result = JSON.parse(String(out.result.content))
  assert.deepEqual(result.previous.exercises, [{ exercise_name: 'Bench press', sets: 3, reps: 8, weight: 60 }])
  assert.deepEqual(result.updated.exercises, [{ exercise_name: 'Incline dumbbell press', sets: 3, reps: 10, weight: 20 }])
  assert.equal(result.updated.notes, 'Go light')
  assert.deepEqual(out.event.created_ids, [])
  assert.equal(out.event.resource, 'workout-plans')
  assert.equal(out.event.summary, 'Updated Push day for Tue, Nov 10')
  assert.ok(calls.some((sql) => sql.includes('delete from public.workout_plan_exercises')))
})

test('update_workout_plan refuses unknown plans and moves into the past', async () => {
  const missing = fakeDb()
  const notFound = await executeTool(
    toolUse('update_workout_plan', {
      plan_id: PLAN_ID,
      unit_system: 'metric',
      workout: { name: 'Legs', workout_type: 'legs', planned_date: '2026-11-16', notes: '', exercises: [] },
    }),
    ctx(missing.db),
  )
  assert.equal(notFound.result.is_error, true)
  assert.match(String(notFound.result.content), /get_workout_plans/)

  const existing = fakeDb((sql) =>
    sql.includes('for update')
      ? [{ id: PLAN_ID, name: 'Legs', workout_type: 'legs', planned_date: '2026-11-16', notes: null, completed_at: null }]
      : [],
  )
  const intoPast = await executeTool(
    toolUse('update_workout_plan', {
      plan_id: PLAN_ID,
      unit_system: 'metric',
      workout: { name: 'Legs', workout_type: 'legs', planned_date: '2026-11-12', notes: '', exercises: [] },
    }),
    ctx(existing.db),
  )
  assert.equal(intoPast.result.is_error, true)
  assert.ok(!existing.calls.some((sql) => sql.startsWith('update')))

  const badId = await executeTool(
    toolUse('update_workout_plan', {
      plan_id: 'Push day',
      unit_system: 'metric',
      workout: { name: 'Legs', workout_type: 'legs', planned_date: '2026-11-16', notes: '', exercises: [] },
    }),
    ctx(missing.db),
  )
  assert.equal(badId.result.is_error, true)
})
