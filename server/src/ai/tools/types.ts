import type Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import type { Db } from '../../db.js'
import type { RowChanges } from './snapshots.js'

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
export type ToolResource = 'grocery-items' | 'meal-plans' | 'workout-plans'

export interface ToolOutcome {
  /** Compact JSON sent back to the model. Every token is re-sent on later turns. */
  result: unknown
  /** One line for the action card, e.g. "Added 9 items to Groceries". Writes only. */
  summary?: string
  /** Rows the tool inserted, for Undo (which deletes them). Edits leave this empty. */
  createdIds?: string[]
  resource?: ToolResource
  /** Writes only: the rows of `resource` before and after, for the activity feed's Undo. */
  changes?: RowChanges
}

/** What an MCP connection must be granted to see and call a tool. */
export type ToolScope = 'read' | 'write'

/** Who can call a tool: the built-in coach, or AI apps connected over MCP. */
export type ToolSurface = 'coach' | 'mcp'

export interface CoachTool<S extends z.ZodType = z.ZodType> {
  definition: Anthropic.Beta.BetaTool
  /** Short human-readable name, shown by MCP clients such as Claude. */
  title: string
  scope: ToolScope
  /** Write tools only: may overwrite or remove data the user already has. */
  destructive?: boolean
  /** Write tools only: repeating a call with the same input changes nothing more. */
  idempotent?: boolean
  /**
   * Where the tool is offered; every surface unless set to false. Each coach
   * tool is re-sent with every coach request, so tools only AI apps need can
   * stay out of its prompt and cost.
   */
  surfaces?: Partial<Record<ToolSurface, boolean>>
  /** Validates the model's input on the server, even when `strict` is set. */
  schema: S
  run(input: z.infer<S>, ctx: ToolContext): Promise<ToolOutcome>
}

/** Input the model can fix. Sent back as an `is_error` tool result. */
export class ToolInputError extends Error {}

export function defineTool<S extends z.ZodType>(tool: CoachTool<S>): CoachTool<S> {
  return tool
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A row id the model copied from a read tool's result, lower-cased the way
 * Postgres prints uuids so every later lookup by id agrees with the database.
 */
export function rowId(readTool: string) {
  return z
    .string()
    .regex(UUID, `must be an id from ${readTool}`)
    .transform((id) => id.toLowerCase())
}

/** Ids that appear more than once, so a call can't name a row twice. */
export function repeatedIds(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const repeated = new Set<string>()
  for (const id of ids) {
    const key = id.toLowerCase()
    if (seen.has(key)) repeated.add(id)
    seen.add(key)
  }
  return [...repeated]
}

/** Lower-cased ids from `requested` that aren't in `found`. */
export function missingIds(requested: readonly string[], found: readonly string[]): string[] {
  const have = new Set(found.map((id) => id.toLowerCase()))
  return requested.filter((id) => !have.has(id.toLowerCase()))
}

/** "1 item" / "3 items" */
export function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}
