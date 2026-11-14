import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthProvider'
import type { WeightLog } from '../types/db'

const RECENT_LIMIT = 30

export function useRecentWeightLogs() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  return useQuery({
    enabled: !!userId,
    queryKey: ['weight-logs', userId],
    queryFn: () => api<WeightLog[]>('/weight-logs', { query: { limit: RECENT_LIMIT } }),
  })
}

export function useLogWeight() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (weight_kg: number) => {
      if (!userId) throw new Error('Not signed in')
      await api('/weight-logs', { method: 'POST', body: { weight_kg } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weight-logs'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

export function useDeleteWeightLog() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Not signed in')
      await api(`/weight-logs/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weight-logs'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}
