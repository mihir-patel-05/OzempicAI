import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { WeightLog } from '../types/db'

const RECENT_LIMIT = 30

export function useRecentWeightLogs() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  return useQuery({
    enabled: !!userId,
    queryKey: ['weight-logs', userId],
    queryFn: async (): Promise<WeightLog[]> => {
      const { data, error } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', userId!)
        .order('logged_at', { ascending: false })
        .limit(RECENT_LIMIT)
      if (error) throw error
      return (data ?? []) as WeightLog[]
    },
  })
}

export function useLogWeight() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (weight_kg: number) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase
        .from('weight_logs')
        .insert({ user_id: userId, weight_kg })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weight-logs'] })
    },
  })
}

export function useDeleteWeightLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weight_logs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weight-logs'] })
    },
  })
}
