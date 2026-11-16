import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import type { CoachResource } from '../features/coach/types'
import { api } from '../lib/api'
import { refreshResource } from './useCoach'

/** One change a connected AI app made (Plans → AI activity). */
export interface AgentActivity {
  id: string
  client_name: string
  tool_name: string
  summary: string | null
  resource: CoachResource | null
  created_at: string
  undone_at: string | null
  can_undo: boolean
}

export function useAgentActivity() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  return useQuery({
    enabled: !!userId,
    queryKey: ['agent-activity', userId],
    queryFn: () => api<AgentActivity[]>('/agent-activity', { query: { limit: 20 } }),
    // Changes usually arrive while the app is in the background.
    refetchOnWindowFocus: true,
  })
}

/**
 * Undo one AI-app change on the server. It refuses (409) when the rows were
 * changed again since, and the error message says so.
 */
export function useUndoActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entry: AgentActivity) =>
      api<{ resource: CoachResource }>(`/agent-activity/${entry.id}/undo`, { method: 'POST' }),
    onSuccess: (result) => refreshResource(queryClient, result.resource),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['agent-activity'] }),
  })
}
