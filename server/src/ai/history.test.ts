import assert from 'node:assert/strict'
import { test } from 'node:test'
import type Anthropic from '@anthropic-ai/sdk'
import {
  historySummary,
  renderForUi,
  runnableToolUses,
  toMessageParams,
  toReplayContent,
  unansweredToolResults,
} from './history.js'
import type { StoredMessage } from './history.js'

type Block = Anthropic.Beta.BetaContentBlock

const thinking = { type: 'thinking', thinking: '', signature: 'sig' } as Block
const text = (t: string) => ({ type: 'text', text: t, citations: null }) as Block
const toolUse = (id: string, name = 'get_profile') => ({ type: 'tool_use', id, name, input: {} }) as Block
const fallback = {
  type: 'fallback',
  from: { model: 'claude-opus-5-5' },
  to: { model: 'claude-opus-4-8' },
} as unknown as Block

test('toReplayContent leaves turns without a fallback untouched', () => {
  const blocks = [thinking, text('hi'), toolUse('a')]
  assert.equal(toReplayContent(blocks), blocks)
})

test('toReplayContent drops thinking and tool_use before the last fallback block only', () => {
  const blocks = [thinking, text('partial'), toolUse('a'), fallback, thinking, text('rest'), toolUse('b')]
  assert.deepEqual(
    toReplayContent(blocks).map((b) => b.type),
    ['text', 'fallback', 'thinking', 'text', 'tool_use'],
  )
  assert.deepEqual(
    runnableToolUses(blocks).map((b) => b.id),
    ['b'],
  )
})

test('toMessageParams keeps roles and content in order', () => {
  const rows: StoredMessage[] = [
    { position: 0, role: 'user', content: [{ type: 'text', text: 'hello' }] },
    { position: 1, role: 'system', content: 'Today is Saturday' },
    { position: 2, role: 'assistant', content: [thinking, text('hey')] },
  ]
  const params = toMessageParams(rows)
  assert.deepEqual(
    params.map((p) => p.role),
    ['user', 'system', 'assistant'],
  )
  assert.equal(params[1]!.content, 'Today is Saturday')
  assert.deepEqual(params[2]!.content, [thinking, text('hey')])
})

test('unansweredToolResults closes a dangling tool call', () => {
  const rows: StoredMessage[] = [
    { position: 0, role: 'user', content: [{ type: 'text', text: 'plan my week' }] },
    { position: 1, role: 'assistant', content: [text('ok'), toolUse('t1'), toolUse('t2')] },
  ]
  const results = unansweredToolResults(rows, 'interrupted')
  assert.deepEqual(
    results.map((r) => [r.tool_use_id, r.is_error]),
    [
      ['t1', true],
      ['t2', true],
    ],
  )
  rows.push({ position: 2, role: 'user', content: results })
  assert.deepEqual(unansweredToolResults(rows, 'interrupted'), [])
})

test('renderForUi groups an assistant turn and shows write cards', () => {
  const rows: StoredMessage[] = [
    { id: 'm0', position: 0, role: 'user', content: [{ type: 'text', text: 'Add milk' }] },
    { id: 'm1', position: 1, role: 'system', content: 'context' },
    { id: 'm2', position: 2, role: 'assistant', content: [thinking, toolUse('t1', 'get_grocery_list')] },
    {
      id: 'm3',
      position: 3,
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"count":0,"items":[]}' }],
    },
    { id: 'm4', position: 4, role: 'assistant', content: [text('Adding it now.'), toolUse('t2', 'add_grocery_items')] },
    {
      id: 'm5',
      position: 5,
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 't2', content: '{"added":["Milk"],"skipped_duplicates":[]}' }],
    },
    { id: 'm6', position: 6, role: 'assistant', content: [text('Added milk. You can undo it.')] },
  ]
  assert.deepEqual(renderForUi(rows), [
    { id: 'm0', role: 'user', text: 'Add milk', tools: [] },
    {
      id: 'm2',
      role: 'assistant',
      text: 'Adding it now.\n\nAdded milk. You can undo it.',
      tools: [{ name: 'add_grocery_items', status: 'ok', summary: 'Added 1 item to Groceries' }],
    },
  ])
})

test('historySummary', () => {
  assert.equal(
    historySummary('create_meal_plan', JSON.stringify({ saved: 21, start: '2026-11-16', end: '2026-11-22' })),
    'Planned 21 meals (2026-11-16 to 2026-11-22)',
  )
  assert.equal(
    historySummary(
      'create_workout_plans',
      JSON.stringify({ saved: 2, plans: [{ planned_date: '2026-11-18', name: 'Legs' }, { planned_date: '2026-11-16', name: 'Push' }] }),
    ),
    'Planned 2 workouts for Nov 16–18',
  )
  assert.equal(
    historySummary('update_workout_plan', JSON.stringify({ updated: { planned_date: '2026-11-19', name: 'Leg day' } })),
    'Updated Leg day for Thu, Nov 19',
  )
  assert.equal(historySummary('get_profile', '{}'), null)
  assert.equal(historySummary('add_grocery_items', 'not json'), null)
})
