import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { HeartRateLog } from '../types/db'

const RECENT_LIMIT = 30

export function useRecentHeartRateLogs() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  return useQuery({
    enabled: !!userId,
    queryKey: ['heart-rate-logs', userId],
    queryFn: async (): Promise<HeartRateLog[]> => {
      const { data, error } = await supabase
        .from('heart_rate_logs')
        .select('*')
        .eq('user_id', userId!)
        .order('recorded_at', { ascending: false })
        .limit(RECENT_LIMIT)
      if (error) throw error
      return (data ?? []) as HeartRateLog[]
    },
  })
}

export function useLogHeartRate() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (bpm: number) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase
        .from('heart_rate_logs')
        .insert({ user_id: userId, bpm, source: 'manual' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heart-rate-logs'] })
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
      const { error } = await supabase
        .from('heart_rate_logs')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heart-rate-logs'] })
    },
  })
}
