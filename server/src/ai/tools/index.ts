import type Anthropic from '@anthropic-ai/sdk'
import { DateInputError } from '../dates.js'
import { getCalorieEntries, getCalorieSummary } from './calories.js'
import {
  addGroceryItems,
  clearPurchasedGroceries,
  getGroceryList,
  removeGroceryItems,
  updateGroceryItems,
} from './groceries.js'
import { createMealPlan, deletePlannedMeals, getMealPlans, updatePlannedMeals } from './mealPlans.js'
import { getProfile } from './profile.js'
import { getExerciseSummary, getWeightTrend } from './trends.js'
import { createWorkoutPlans, getWorkoutPlans, updateWorkoutPlan } from './workoutPlans.js'
import { ToolInputError } from './types.js'
import type { CoachTool, ToolContext, ToolOutcome, ToolResource, ToolSurface } from './types.js'

const REGISTRY: CoachTool[] = [
  getProfile,
  getCalorieSummary,
  getCalorieEntries,
  getGroceryList,
  addGroceryItems,
  updateGroceryItems,
  removeGroceryItems,
  clearPurchasedGroceries,
  getMealPlans,
  createMealPlan,
  updatePlannedMeals,
  deletePlannedMeals,
  getWeightTrend,
  getExerciseSummary,
  getWorkoutPlans,
  createWorkoutPlans,
  updateWorkoutPlan,
]

const BY_NAME = new Map(REGISTRY.map((tool) => [tool.definition.name, tool]))

/** Every tool, in registry order. */
export const TOOLS: readonly CoachTool[] = REGISTRY

export function offeredOn(tool: CoachTool, surface: ToolSurface): boolean {
  return tool.surfaces?.[surface] !== false
}

/** The tools one surface may see and call, in registry order. */
export function toolsOn(surface: ToolSurface): CoachTool[] {
  return REGISTRY.filter((tool) => offeredOn(tool, surface))
}

/**
 * The coach's tool definitions in a fixed order. Tools render first in the
 * prompt, so the list must be identical on every request for prompt caching
 * to work.
 */
export const TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = toolsOn('coach')
  .map((tool) => tool.definition)
  .sort((a, b) => a.name.localeCompare(b.name))

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

/** A tool by name, if `surface` offers it. */
export function findTool(name: string, surface: ToolSurface): CoachTool | undefined {
  const tool = BY_NAME.get(name)
  return tool && offeredOn(tool, surface) ? tool : undefined
}

/**
 * Validate and run one tool by name. Bad input and tools `surface` doesn't
 * offer come back as `{ ok: false }` with a message the model can act on.
 * Database and other unexpected errors are rethrown so the caller's
 * transaction rolls back.
 */
export async function runTool(name: string, input: unknown, ctx: ToolContext, surface: ToolSurface): Promise<ToolRun> {
  const tool = findTool(name, surface)
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
  const run = await runTool(block.name, block.input, ctx, 'coach')
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
