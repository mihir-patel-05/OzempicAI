import type Anthropic from '@anthropic-ai/sdk'

type Block = Anthropic.Beta.BetaContentBlock | Anthropic.Beta.BetaContentBlockParam
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam
type ToolUse = Anthropic.Beta.BetaToolUseBlock

/** One stored ai_messages row. `content` is exactly what the API produced or received. */
export interface StoredMessage {
  id?: string
  position: number
  role: 'user' | 'assistant' | 'system'
  content: unknown
}

/**
 * Blocks that a mid-output refusal fallback leaves before the final `fallback`
 * block belong to the declined attempt. The API wants thinking and tool-use
 * blocks from that part omitted when the turn is echoed back; text and the
 * fallback block itself stay where they were. Applying this on every replay
 * (rather than editing the stored row) keeps the history append-only.
 */
const DROP_BEFORE_FALLBACK = new Set(['thinking', 'redacted_thinking', 'tool_use', 'server_tool_use'])

function lastFallbackIndex(blocks: Block[]): number {
  for (let i = blocks.length - 1; i >= 0; i--) if (blocks[i]!.type === 'fallback') return i
  return -1
}

export function toReplayContent(blocks: Block[]): Block[] {
  const boundary = lastFallbackIndex(blocks)
  if (boundary < 0) return blocks
  return blocks.filter((block, i) => i >= boundary || !DROP_BEFORE_FALLBACK.has(block.type))
}

/** The tool calls in an assistant turn that should actually run. */
export function runnableToolUses(content: Anthropic.Beta.BetaContentBlock[]): ToolUse[] {
  const boundary = lastFallbackIndex(content)
  return content.filter((b, i): b is ToolUse => b.type === 'tool_use' && i > boundary)
}

/** Map stored rows to API messages, unchanged apart from the fallback rule. */
export function toMessageParams(rows: StoredMessage[]): Anthropic.Beta.BetaMessageParam[] {
  return rows.map((row) => {
    if (row.role === 'system') return { role: 'system', content: row.content as string }
    if (row.role === 'assistant') {
      return { role: 'assistant', content: toReplayContent(row.content as Block[]) as Anthropic.Beta.BetaContentBlockParam[] }
    }
    return { role: 'user', content: row.content as Anthropic.Beta.BetaContentBlockParam[] }
  })
}

/**
 * Tool results for any tool call the last assistant turn left unanswered
 * (e.g. the server restarted mid-turn, or the turn hit a limit). Every
 * tool_use needs a tool_result before the conversation can continue.
 */
export function unansweredToolResults(rows: StoredMessage[], reason: string): ToolResult[] {
  const last = rows[rows.length - 1]
  if (!last || last.role !== 'assistant') return []
  const blocks = toReplayContent(last.content as Block[])
  return blocks
    .filter((b): b is Anthropic.Beta.BetaToolUseBlockParam => b.type === 'tool_use')
    .map((b) => ({ type: 'tool_result', tool_use_id: b.id, is_error: true, content: reason }))
}

/** True for a user row that only carries tool results (not something the user typed). */
function isToolResultRow(row: StoredMessage): boolean {
  return (
    row.role === 'user' &&
    Array.isArray(row.content) &&
    row.content.length > 0 &&
    row.content.every((b: { type?: string }) => b?.type === 'tool_result')
  )
}

// ─── Rendering for the UI ───────────────────────────────────────────────────

export interface UiToolCall {
  name: string
  status: 'ok' | 'error'
  summary: string | null
}

export interface UiMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  tools: UiToolCall[]
}

/** Action-card text for a write recorded in history (ids aren't kept in results). */
export function historySummary(name: string, content: unknown): string | null {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(String(content)) as Record<string, unknown>
  } catch {
    return null
  }
  if (name === 'add_grocery_items' && Array.isArray(data.added)) {
    const n = data.added.length
    return n > 0 ? `Added ${n} item${n === 1 ? '' : 's'} to Groceries` : 'Everything was already on your grocery list'
  }
  if (name === 'create_meal_plan' && typeof data.saved === 'number') {
    const n = data.saved
    return n > 0 ? `Planned ${n} meal${n === 1 ? '' : 's'} (${data.start} to ${data.end})` : 'Those meals were already planned'
  }
  return null
}

/**
 * Collapse stored rows into chat bubbles: each user message, then one
 * assistant bubble with all the text and tool calls up to the next user
 * message. System notes and raw tool results are hidden.
 */
export function renderForUi(rows: StoredMessage[]): UiMessage[] {
  const out: UiMessage[] = []
  const toolNames = new Map<string, string>()
  let current: UiMessage | null = null

  for (const row of rows) {
    if (row.role === 'system') continue
    const id = row.id ?? String(row.position)

    if (row.role === 'user' && !isToolResultRow(row)) {
      const text = (row.content as Block[])
        .filter((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
      out.push({ id, role: 'user', text, tools: [] })
      current = null
      continue
    }

    if (row.role === 'assistant') {
      if (!current) {
        current = { id, role: 'assistant', text: '', tools: [] }
        out.push(current)
      }
      const blocks = toReplayContent(row.content as Block[])
      for (const block of blocks) {
        if (block.type === 'text' && block.text) {
          current.text = current.text ? `${current.text}\n\n${block.text}` : block.text
        } else if (block.type === 'tool_use') {
          toolNames.set(block.id, block.name)
        }
      }
      continue
    }

    // Tool results: attach a card for each successful write. Failed calls are
    // usually retried by the model, so they aren't worth a card on reload.
    if (!current) continue
    for (const block of row.content as ToolResult[]) {
      const name = toolNames.get(block.tool_use_id)
      if (!name || block.is_error) continue
      const summary = historySummary(name, block.content)
      if (summary) current.tools.push({ name, status: 'ok', summary })
    }
  }
  return out.filter((m) => m.role === 'user' || m.text || m.tools.length > 0)
}
