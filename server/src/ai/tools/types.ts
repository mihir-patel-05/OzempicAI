import type Anthropic from '@anthropic-ai/sdk'
import type { z } from 'zod'
import type { Db } from '../../db.js'

/** Everything a tool may use. `db` is already scoped to the user by withUser(). */
export interface ToolContext {
  db: Db
  userId: string
  /** The user's IANA timezone for this turn. */
  tz: string
  /** Today's date (YYYY-MM-DD) in `tz`. */
  today: string
}

/** Which react-query collection a write touched, so the client can refresh it. */
export type ToolResource = 'grocery-items' | 'meal-plans'

export interface ToolOutcome {
  /** Compact JSON sent back to the model. Every token is re-sent on later turns. */
  result: unknown
  /** One line for the action card, e.g. "Added 9 items to Groceries". Writes only. */
  summary?: string
  /** Rows the tool inserted, for Undo. */
  createdIds?: string[]
  resource?: ToolResource
}

export interface CoachTool<S extends z.ZodType = z.ZodType> {
  definition: Anthropic.Beta.BetaTool
  /** Validates the model's input on the server, even when `strict` is set. */
  schema: S
  run(input: z.infer<S>, ctx: ToolContext): Promise<ToolOutcome>
}

/** Input the model can fix. Sent back as an `is_error` tool result. */
export class ToolInputError extends Error {}

export function defineTool<S extends z.ZodType>(tool: CoachTool<S>): CoachTool<S> {
  return tool
}
