import type Anthropic from '@anthropic-ai/sdk'
import { withUser } from '../db.js'
import { toHttpError } from '../http.js'
import { AI_MODEL, getClient } from './client.js'
import { runnableToolUses, toMessageParams, toReplayContent, unansweredToolResults } from './history.js'
import type { StoredMessage } from './history.js'
import { SYSTEM_PROMPT, buildContextNote } from './prompt.js'
import type { CoachProfile } from './prompt.js'
import { appendMessages } from './store.js'
import type { NewMessage } from './store.js'
import { TOOL_DEFINITIONS, executeTool, toolFailure } from './tools/index.js'
import type { ToolEvent, ToolExecution } from './tools/index.js'

/** Model calls per user message; bounds the cost of one turn. */
export const MAX_ITERATIONS = 8
const MAX_TOKENS = 16_000

export const REFUSAL_TEXT = "Sorry, I can't help with that one."
const CUT_OFF_TEXT = 'My reply was cut off before I finished. Try asking for a shorter answer or a smaller plan.'
const STEP_LIMIT_TEXT = 'That took more steps than I can take in one reply. Ask me to continue and I will pick up from here.'

export type CoachEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_start'; id: string; name: string }
  | ({ type: 'tool' } & ToolEvent)
  | { type: 'error'; message: string }

/** Sends an event to the browser. Must not throw (the client may be gone). */
export type Emit = (event: CoachEvent) => void

export interface TurnInput {
  userId: string
  conversationId: string
  history: StoredMessage[]
  message: string
  tz: string
  today: string
  profile: CoachProfile | null
}

export interface TurnStats {
  iterations: number
  stop_reason: string | null
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
}

/**
 * One user turn: stream Claude's reply, run any tool calls as the user,
 * feed the results back, and repeat until Claude is done or a limit is hit.
 * Messages are saved as they are produced. The user message and its context
 * note are saved together with the first assistant reply, so a failed API
 * call never leaves a dangling message the next request would trip over.
 */
export async function runTurn(input: TurnInput, emit: Emit): Promise<TurnStats> {
  const { userId, conversationId, history, tz, today } = input
  const client = getClient()

  let position = history.length ? history[history.length - 1]!.position + 1 : 0
  const save = async (messages: NewMessage[]) => {
    if (messages.length === 0) return
    position = await withUser(userId, (db) => appendMessages(db, userId, conversationId, position, messages))
  }

  // Messages not yet saved; they go out with the first assistant reply.
  let pending: NewMessage[] = []
  const interrupted = unansweredToolResults(history, 'Not run: the previous reply was interrupted.')
  if (interrupted.length) pending.push({ role: 'user', content: interrupted })
  if (history[history.length - 1]?.role === 'system') {
    // A system note must be followed by an assistant turn. Shouldn't happen
    // given how turns are saved, but never let one bad row wedge a chat.
    pending.push({ role: 'assistant', content: [{ type: 'text', text: '(No reply.)' }] })
  }
  pending.push({ role: 'user', content: [{ type: 'text', text: input.message }] })
  pending.push({ role: 'system', content: buildContextNote(input.profile, today, tz) })

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...toMessageParams(history),
    ...toMessageParams(pending.map((m, i) => ({ position: i, role: m.role, content: m.content }))),
  ]

  const stats: TurnStats = {
    iterations: 0,
    stop_reason: null,
    model: AI_MODEL,
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
  }

  const runTool = async (call: Anthropic.Beta.BetaToolUseBlock): Promise<ToolExecution> => {
    try {
      // Each call is its own transaction, so one failure can't undo another.
      return await withUser(userId, (db) => executeTool(call, { db, userId, tz, today }))
    } catch (err) {
      const httpError = toHttpError(err)
      if (!httpError) console.error(`AI tool ${call.name} failed`, err)
      return toolFailure(
        call,
        httpError
          ? `The database rejected this: ${httpError.message}. Nothing was changed.`
          : 'This tool failed because of a server error. Nothing was changed.',
      )
    }
  }

  while (true) {
    stats.iterations += 1
    const stream = client.beta.messages.stream({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages,
      output_config: { effort: 'medium' },
      cache_control: { type: 'ephemeral' },
      // If a safety classifier declines, the API retries on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
    stream.on('text', (delta) => emit({ type: 'text', text: delta }))
    stream.on('streamEvent', (event) => {
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        emit({ type: 'tool_start', id: event.content_block.id, name: event.content_block.name })
      }
    })

    const response = await stream.finalMessage()
    const usage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
    }
    stats.stop_reason = response.stop_reason
    stats.model = response.model
    stats.input_tokens += usage.input_tokens
    stats.output_tokens += usage.output_tokens
    stats.cache_read_tokens += usage.cache_read_tokens
    stats.cache_write_tokens += response.usage.cache_creation_input_tokens ?? 0

    if (response.stop_reason === 'refusal') {
      // Don't replay a declined response; close the turn with a plain reply.
      await save([...pending, { role: 'assistant', content: [{ type: 'text', text: REFUSAL_TEXT }], usage }])
      emit({ type: 'error', message: REFUSAL_TEXT })
      return stats
    }

    await save([...pending, { role: 'assistant', content: response.content, usage }])
    pending = []
    messages.push({
      role: 'assistant',
      content: toReplayContent(response.content) as Anthropic.Beta.BetaContentBlockParam[],
    })

    const cutOff = response.stop_reason === 'max_tokens' || response.stop_reason === 'model_context_window_exceeded'
    const calls = runnableToolUses(response.content)
    if (calls.length === 0) {
      if (cutOff) emit({ type: 'error', message: CUT_OFF_TEXT })
      return stats
    }

    // A truncated response or the iteration cap: answer the calls without
    // running them, so the conversation stays valid for the next message.
    if (cutOff || response.stop_reason !== 'tool_use' || stats.iterations >= MAX_ITERATIONS) {
      const reason = cutOff ? 'Not run: the response was cut off.' : 'Not run: step limit reached.'
      await save([{ role: 'user', content: calls.map((call) => toolFailure(call, reason).result) }])
      emit({ type: 'error', message: cutOff ? CUT_OFF_TEXT : STEP_LIMIT_TEXT })
      return stats
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const call of calls) {
      const execution = await runTool(call)
      emit({ type: 'tool', ...execution.event })
      results.push(execution.result)
    }
    // All results go back in one user message.
    await save([{ role: 'user', content: results }])
    messages.push({ role: 'user', content: results })
  }
}
