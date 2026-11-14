import type Anthropic from '@anthropic-ai/sdk'
import { DateInputError } from '../dates.js'
import { getCalorieEntries, getCalorieSummary } from './calories.js'
import { addGroceryItems, getGroceryList } from './groceries.js'
import { createMealPlan, getMealPlans } from './mealPlans.js'
import { getProfile } from './profile.js'
import { getExerciseSummary, getWeightTrend } from './trends.js'
import { ToolInputError } from './types.js'
import type { CoachTool, ToolContext, ToolResource } from './types.js'

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

/**
 * Validate and run one tool call. Bad input and unknown tools come back as
 * `is_error` results the model can correct. Database and other unexpected
 * errors are rethrown so the caller's transaction rolls back.
 */
export async function executeTool(
  block: Anthropic.Beta.BetaToolUseBlock,
  ctx: ToolContext,
): Promise<ToolExecution> {
  const fail = (message: string) => toolFailure(block, message)

  const tool = BY_NAME.get(block.name)
  if (!tool) return fail(`Unknown tool: ${block.name}`)

  const parsed = tool.schema.safeParse(block.input)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
    return fail(`Invalid input. ${issues.join('; ')}`)
  }

  try {
    const outcome = await tool.run(parsed.data, ctx)
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
  } catch (err) {
    if (err instanceof ToolInputError || err instanceof DateInputError) return fail(err.message)
    throw err
  }
}
