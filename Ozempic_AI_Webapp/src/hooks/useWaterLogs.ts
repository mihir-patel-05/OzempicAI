import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
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
    queryFn: async (): Promise<WaterLog[]> => {
      const { data, error } = await supabase
        .from('water_logs')
        .select('*')
        .eq('user_id', userId!)
        .gte('logged_at', startISO)
        .lte('logged_at', endISO)
        .order('logged_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as WaterLog[]
    },
  })
}

export function useLogWater() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (amount_ml: number) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase
        .from('water_logs')
        .insert({ user_id: userId, amount_ml })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water-logs'] })
      queryClient.invalidateQueries({ queryKey: ['daily-total', 'water'] })
    },
  })
}

export function useDeleteWaterLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('water_logs').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water-logs'] })
      queryClient.invalidateQueries({ queryKey: ['daily-total', 'water'] })
    },
  })
}
