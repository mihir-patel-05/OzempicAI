import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthProvider'
import type { HeartRateLog } from '../types/db'

const RECENT_LIMIT = 30

export function useRecentHeartRateLogs() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  return useQuery({
    enabled: !!userId,
    queryKey: ['heart-rate-logs', userId],
    queryFn: () => api<HeartRateLog[]>('/heart-rate-logs', { query: { limit: RECENT_LIMIT } }),
  })
}

export function useLogHeartRate() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (bpm: number) => {
      if (!userId) throw new Error('Not signed in')
      await api('/heart-rate-logs', { method: 'POST', body: { bpm, source: 'manual' } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heart-rate-logs'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

export function useDeleteHeartRateLog() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Not signed in')
      await api(`/heart-rate-logs/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heart-rate-logs'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}
