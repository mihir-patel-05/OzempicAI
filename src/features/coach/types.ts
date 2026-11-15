// Mirrors server/src/routes/ai.ts and server/src/ai/history.ts.

export interface CoachConversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

/** Which collection a write touched (the react-query key prefix to refresh). */
export type CoachResource = 'grocery-items' | 'meal-plans' | 'workout-plans'

export interface CoachToolCall {
  /** tool_use id; present for calls seen live in this session. */
  id?: string
  name: string
  status: 'ok' | 'error'
  summary: string | null
  /** Rows the call inserted. Only known live, so only live cards offer Undo. Edits insert none. */
  created_ids?: string[]
  resource?: CoachResource | null
}

export interface CoachMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  tools: CoachToolCall[]
  /** Set on an assistant bubble when the turn ended with an error message. */
  error?: string
}

export interface CoachConversationDetail extends CoachConversation {
  messages: CoachMessage[]
}

/** Events on the POST /api/ai/chat stream. */
export type CoachStreamEvent =
  | { event: 'conversation'; data: { conversation_id: string; title: string } }
  | { event: 'text'; data: { text: string } }
  | { event: 'tool_start'; data: { id: string; name: string } }
  | { event: 'tool'; data: Required<Omit<CoachToolCall, 'id'>> & { id: string } }
  | { event: 'error'; data: { message: string } }
  | { event: 'done'; data: { conversation_id: string } }
