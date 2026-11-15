import { useCallback, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { ApiError, api, apiStream } from '../lib/api'
import { markUndone, rememberLiveTurn } from '../features/coach/liveTools'
import type {
  CoachConversation,
  CoachConversationDetail,
  CoachMessage,
  CoachStreamEvent,
  CoachToolCall,
} from '../features/coach/types'

/** True when the API says the coach has no ANTHROPIC_API_KEY. */
export function isCoachNotConfigured(error: unknown): boolean {
  return error instanceof ApiError && error.status === 503
}

// 503 (not configured) and 404 won't fix themselves on a retry.
const retry = (count: number, error: unknown) =>
  !(error instanceof ApiError && (error.status === 503 || error.status === 404)) && count < 1

export function useConversations() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  return useQuery({
    enabled: !!userId,
    queryKey: ['ai-conversations', userId],
    queryFn: () => api<CoachConversation[]>('/ai/conversations', { query: { limit: 30 } }),
    retry,
  })
}

/**
 * Saved messages for one conversation. Pass `paused` while a reply streams:
 * the cached history keeps showing and the live turn isn't duplicated by a
 * refetch that already contains part of it.
 */
export function useConversation(id: string | null, paused = false) {
  return useQuery({
    enabled: !!id && !paused,
    queryKey: ['ai-conversation', id],
    queryFn: () => api<CoachConversationDetail>(`/ai/conversations/${id}`),
    retry,
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/ai/conversations/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: ['ai-conversation', id] })
      return queryClient.invalidateQueries({ queryKey: ['ai-conversations'] })
    },
  })
}

// ─── Sending ────────────────────────────────────────────────────────────────

/** The message being sent and the reply streaming in, before it is saved. */
export interface LiveTurn {
  user: CoachMessage
  assistant: CoachMessage
  /** Name of the tool the coach is running right now, if any. */
  activeTool: string | null
  /** False once the stream has ended. */
  streaming: boolean
  /** True when the turn failed before anything was saved, so it can be resent. */
  unsaved: boolean
}

function userTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

const fetchConversation = (id: string) => api<CoachConversationDetail>(`/ai/conversations/${id}`)

/**
 * Send a message and stream the reply into `turn`. Writes the coach makes
 * refresh the matching Plans queries as they happen. When the stream ends the
 * saved conversation is refetched and replaces the live turn; if nothing was
 * saved (e.g. the request failed), the live turn stays so it can be retried.
 */
export function useSendMessage(onConversation: (id: string) => void) {
  const queryClient = useQueryClient()
  const [turn, setTurn] = useState<LiveTurn | null>(null)
  const busy = useRef(false)

  const send = useCallback(
    async (input: string, conversationId: string | null) => {
      const message = input.trim()
      if (busy.current || !message) return
      busy.current = true

      const key = `live-${Date.now()}`
      const user: CoachMessage = { id: `${key}-user`, role: 'user', text: message, tools: [] }
      let assistant: CoachMessage = { id: `${key}-assistant`, role: 'assistant', text: '', tools: [] }
      let activeTool: string | null = null
      let savedId = conversationId
      const publish = (streaming: boolean, unsaved = false) =>
        setTurn({ user, assistant, activeTool, streaming, unsaved })
      publish(true)

      try {
        await apiStream('/ai/chat', { conversation_id: conversationId ?? undefined, message, timezone: userTimezone() }, (event, data) => {
          const e = { event, data } as CoachStreamEvent
          switch (e.event) {
            case 'conversation':
              savedId = e.data.conversation_id
              if (savedId !== conversationId) onConversation(savedId)
              break
            case 'text':
              assistant = { ...assistant, text: assistant.text + e.data.text }
              activeTool = null
              break
            case 'tool_start':
              activeTool = e.data.name
              break
            case 'tool': {
              const call: CoachToolCall = e.data
              assistant = { ...assistant, tools: [...assistant.tools, call] }
              activeTool = null
              if (call.status === 'ok' && call.resource) {
                void queryClient.invalidateQueries({ queryKey: [call.resource] })
              }
              break
            }
            case 'error':
              assistant = { ...assistant, error: e.data.message }
              break
            default:
              return
          }
          publish(true)
        })
      } catch (err) {
        assistant = {
          ...assistant,
          error: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
        }
      }
      activeTool = null
      publish(false)

      try {
        if (!savedId) {
          publish(false, true)
          return
        }
        const detail = await queryClient.fetchQuery({
          queryKey: ['ai-conversation', savedId],
          queryFn: () => fetchConversation(savedId!),
          staleTime: 0,
        })
        void queryClient.invalidateQueries({ queryKey: ['ai-conversations'] })
        const lastUser = [...detail.messages].reverse().find((m) => m.role === 'user')
        if (lastUser?.text !== message) {
          // The server never saved this turn; keep it on screen to retry.
          publish(false, true)
          return
        }
        const lastAssistant = detail.messages[detail.messages.length - 1]
        if (lastAssistant?.role === 'assistant') {
          const error = assistant.error && !lastAssistant.text.includes(assistant.error) ? assistant.error : undefined
          rememberLiveTurn(lastAssistant.id, { tools: assistant.tools, error })
        }
        setTurn(null)
      } catch {
        // Couldn't reload the saved chat; leave the live turn showing.
        publish(false)
      } finally {
        busy.current = false
      }
    },
    [onConversation, queryClient],
  )

  const clearTurn = useCallback(() => {
    if (!busy.current) setTurn(null)
  }, [])

  return { send, turn, isSending: turn?.streaming ?? false, clearTurn }
}

// ─── Undo ───────────────────────────────────────────────────────────────────

/**
 * Undo a coach write by deleting exactly the rows it inserted, through the
 * same DELETE endpoints Plans uses. Rows the user already deleted are fine:
 * DELETE of a missing id still succeeds.
 */
export function useUndoToolCall() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (call: CoachToolCall) => {
      if (!call.id || !call.resource || !call.created_ids?.length) return
      for (const rowId of call.created_ids) {
        await api(`/${call.resource}/${rowId}`, { method: 'DELETE' })
      }
    },
    onSuccess: (_data, call) => {
      if (call.id) markUndone(call.id)
      if (call.resource) return queryClient.invalidateQueries({ queryKey: [call.resource] })
    },
  })
}
