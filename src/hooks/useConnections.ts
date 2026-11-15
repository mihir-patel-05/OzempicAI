import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { api } from '../lib/api'

/** An AI app (e.g. Claude) connected to this account over OAuth + MCP. */
export interface Connection {
  id: string
  client_name: string
  scopes: ('read' | 'write')[]
  created_at: string
  last_used_at: string | null
}

export function useConnections() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  return useQuery({
    enabled: !!userId,
    queryKey: ['connections', userId],
    queryFn: () => api<Connection[]>('/connections'),
  })
}

export function useDisconnect() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/connections/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] }),
  })
}

/**
 * Whether this server accepts AI app connections (MCP_ENABLED on the API).
 * The discovery document is public and 404s when the feature is off.
 */
export function useMcpAvailable() {
  return useQuery({
    queryKey: ['mcp-available'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const response = await fetch('/.well-known/oauth-protected-resource/api/mcp')
      if (!response.ok) return null
      const metadata = (await response.json()) as { resource?: string }
      return metadata.resource ?? null
    },
  })
}
