import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthProvider'
import type { Fast } from '../types/db'

/** Enough history for the Fasting screen's list and stats. */
const HISTORY_LIMIT = 200

export interface StartFastInput {
  target_minutes: number
  /** Backdate the start; omitted means now (the server's clock). */
  started_at?: string
}

export interface LogPastFastInput {
  target_minutes: number
  started_at: string
  ended_at: string
  notes?: string | null
}

export interface UpdateFastInput {
  id: string
  started_at?: string
  target_minutes?: number
  /** null reopens an ended fast. */
  ended_at?: string | null
  notes?: string | null
}

/**
 * The running fast, or null. Refetched when the app comes back to the
 * foreground, since the fast may have been ended on another device.
 */
export function useActiveFast() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  return useQuery({
    enabled: !!userId,
    queryKey: ['fasts', 'active', userId],
    queryFn: () => api<Fast | null>('/fasts/active'),
    refetchOnWindowFocus: true,
  })
}

/** Recent fasts, running one included, newest first. */
export function useFastHistory() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  return useQuery({
    enabled: !!userId,
    queryKey: ['fasts', 'history', userId],
    queryFn: () => api<Fast[]>('/fasts', { query: { limit: HISTORY_LIMIT } }),
    refetchOnWindowFocus: true,
  })
}

/** Every fasting mutation changes both the running fast and the history. */
function useFastMutation<TInput>(request: (input: TInput) => Promise<Fast | undefined>) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: TInput) => {
      if (!userId) throw new Error('Not signed in')
      return request(input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fasts'] })
    },
  })
}

export function useStartFast() {
  return useFastMutation((input: StartFastInput) =>
    api<Fast>('/fasts', { method: 'POST', body: input }),
  )
}

/** Record a fast that has already finished. */
export function useLogPastFast() {
  return useFastMutation((input: LogPastFastInput) =>
    api<Fast>('/fasts', { method: 'POST', body: input }),
  )
}

export function useEndFast() {
  return useFastMutation(({ id, ended_at }: { id: string; ended_at?: string }) =>
    api<Fast>(`/fasts/${id}/end`, { method: 'POST', body: ended_at ? { ended_at } : {} }),
  )
}

export function useUpdateFast() {
  return useFastMutation(({ id, ...changes }: UpdateFastInput) =>
    api<Fast>(`/fasts/${id}`, { method: 'PATCH', body: changes }),
  )
}

export function useDeleteFast() {
  return useFastMutation((id: string) =>
    api<undefined>(`/fasts/${id}`, { method: 'DELETE' }),
  )
}
