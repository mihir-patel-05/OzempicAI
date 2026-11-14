import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { ApiError, api } from '../lib/api'
import type { CoachConversation, CoachConversationDetail } from '../features/coach/types'

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

export function useConversation(id: string | null) {
  return useQuery({
    enabled: !!id,
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
