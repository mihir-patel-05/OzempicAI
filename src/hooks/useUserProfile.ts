import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { UnitSystem, UserProfile } from '../types/db'

const DEFAULTS = {
  daily_calorie_goal: 2000,
  daily_water_goal_ml: 2500,
  unit_system: 'metric' as UnitSystem,
}

export function useUserProfile() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  return useQuery({
    enabled: !!userId,
    queryKey: ['user-profile', userId],
    queryFn: async (): Promise<UserProfile> => {
      const { data: existing, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId!)
        .maybeSingle()
      if (selectError) throw selectError
      if (existing) return existing as UserProfile

      // First sign-in for this account on the web — mirror iOS
      // AuthService.ensureUserProfile and create the row with defaults.
      const email = session?.user.email ?? ''
      const name = typeof session?.user.user_metadata.name === 'string'
        ? session.user.user_metadata.name.trim()
        : ''
      const { data: inserted, error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId!,
          email,
          name,
          daily_calorie_goal: DEFAULTS.daily_calorie_goal,
          daily_water_goal_ml: DEFAULTS.daily_water_goal_ml,
          unit_system: DEFAULTS.unit_system,
        })
        .select()
        .single()
      if (insertError?.code === '23505') {
        const { data: racedExisting, error: racedSelectError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId!)
          .single()
        if (racedSelectError) throw racedSelectError
        return racedExisting as UserProfile
      }
      if (insertError) throw insertError
      return inserted as UserProfile
    },
  })
}

export type UpdateProfileInput = Pick<
  UserProfile,
  | 'name'
  | 'height_cm'
  | 'weight_kg'
  | 'age'
  | 'daily_calorie_goal'
  | 'daily_water_goal_ml'
  | 'unit_system'
>

export function useUpdateUserProfile() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      if (!userId) throw new Error('Not signed in')
      const { data, error } = await supabase.from('users').update(input).eq('id', userId).select().single()
      if (error) throw error
      return data as UserProfile
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(['user-profile', userId], profile)
      queryClient.invalidateQueries({ queryKey: ['daily-total'] })
    },
  })
}

/**
 * The unit system to render in. Falls back to metric while the profile is
 * still loading so numbers never flash in the wrong unit.
 */
export function useUnitSystem(): UnitSystem {
  const profile = useUserProfile()
  return profile.data?.unit_system ?? 'metric'
}
