import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthProvider'
import { todayRangeISO } from '../lib/date'
import type { WaterLog } from '../types/db'

export function useWaterLogsToday() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const { startISO, endISO } = todayRangeISO()

  return useQuery({
    enabled: !!userId,
    queryKey: ['water-logs', userId, startISO.slice(0, 10)],
    queryFn: () => api<WaterLog[]>('/water-logs', { query: { from: startISO, to: endISO } }),
  })
}

export function useLogWater() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (amount_ml: number) => {
      if (!userId) throw new Error('Not signed in')
      await api('/water-logs', { method: 'POST', body: { amount_ml } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water-logs'] })
      queryClient.invalidateQueries({ queryKey: ['daily-total', 'water'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}

export function useDeleteWaterLog() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Not signed in')
      await api(`/water-logs/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water-logs'] })
      queryClient.invalidateQueries({ queryKey: ['daily-total', 'water'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
    },
  })
}
