import type Anthropic from '@anthropic-ai/sdk'
import { DateInputError } from '../dates.js'
import { getCalorieEntries, getCalorieSummary } from './calories.js'
import { addGroceryItems, getGroceryList } from './groceries.js'
import { createMealPlan, getMealPlans } from './mealPlans.js'
import { getProfile } from './profile.js'
import { getExerciseSummary, getWeightTrend } from './trends.js'
import { createWorkoutPlans, getWorkoutPlans, updateWorkoutPlan } from './workoutPlans.js'
import { ToolInputError } from './types.js'
import type { CoachTool, ToolContext, ToolOutcome, ToolResource } from './types.js'

const REGISTRY: CoachTool[] = [
  getProfile,
  getCalorieSummary,
  getCalorieEntries,
  getGroceryList,
  addGroceryItems,
  getMealPlans,
  createMealPlan,
  getWeightTrend,
  getExerciseSummary,
  getWorkoutPlans,
  createWorkoutPlans,
  updateWorkoutPlan,
]

const BY_NAME = new Map(REGISTRY.map((tool) => [tool.definition.name, tool]))

/**
 * Tool definitions in a fixed order. Tools render first in the prompt, so the
 * list must be identical on every request for prompt caching to work.
 */
export const TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = REGISTRY.map((tool) => tool.definition).sort(
  (a, b) => a.name.localeCompare(b.name),
)

/** What the browser hears about a tool call (SSE `tool` event). */
export interface ToolEvent {
  id: string
  name: string
  status: 'ok' | 'error'
  summary: string | null
  created_ids: string[]
  resource: ToolResource | null
}

export interface ToolExecution {
  result: Anthropic.Beta.BetaToolResultBlockParam
  event: ToolEvent
}

/** An `is_error` result the model can read and recover from. */
export function toolFailure(block: Anthropic.Beta.BetaToolUseBlock, message: string): ToolExecution {
  return {
    result: { type: 'tool_result', tool_use_id: block.id, is_error: true, content: message },
    event: { id: block.id, name: block.name, status: 'error', summary: null, created_ids: [], resource: null },
  }
}

/** The outcome of one tool call, independent of who asked (coach or MCP). */
export type ToolRun = { ok: true; outcome: ToolOutcome } | { ok: false; message: string }

export function findTool(name: string): CoachTool | undefined {
  return BY_NAME.get(name)
}

/**
 * Validate and run one tool by name. Bad input and unknown tools come back as
 * `{ ok: false }` with a message the model can act on. Database and other
 * unexpected errors are rethrown so the caller's transaction rolls back.
 */
export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolRun> {
  const tool = BY_NAME.get(name)
  if (!tool) return { ok: false, message: `Unknown tool: ${name}` }

  const parsed = tool.schema.safeParse(input)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
    return { ok: false, message: `Invalid input. ${issues.join('; ')}` }
  }

  try {
    return { ok: true, outcome: await tool.run(parsed.data, ctx) }
  } catch (err) {
    if (err instanceof ToolInputError || err instanceof DateInputError) return { ok: false, message: err.message }
    throw err
  }
}

/** Run one of the coach's tool calls and shape the result for the API and the browser. */
export async function executeTool(
  block: Anthropic.Beta.BetaToolUseBlock,
  ctx: ToolContext,
): Promise<ToolExecution> {
  const run = await runTool(block.name, block.input, ctx)
  if (!run.ok) return toolFailure(block, run.message)
  const { outcome } = run
  return {
    result: { type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(outcome.result) },
    event: {
      id: block.id,
      name: block.name,
      status: 'ok',
      summary: outcome.summary ?? null,
      created_ids: outcome.createdIds ?? [],
      resource: outcome.resource ?? null,
    },
  }
}
