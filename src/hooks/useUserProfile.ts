import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../auth/AuthProvider'
import type { UnitSystem, UserProfile } from '../types/db'

export function useUserProfile() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  return useQuery({
    enabled: !!userId,
    queryKey: ['user-profile', userId],
    // The API creates the row with defaults if this account has none yet.
    queryFn: () => api<UserProfile>('/profile'),
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
      return api<UserProfile>('/profile', { method: 'PATCH', body: input })
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

function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

/**
 * Save the device's timezone to the profile when it differs, so AI apps
 * connected over MCP (which don't send one) know what "today" is.
 */
export function useSyncTimezone() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const profile = useUserProfile()
  const queryClient = useQueryClient()
  const saved = profile.data ? profile.data.timezone : undefined

  useEffect(() => {
    const timezone = browserTimezone()
    if (!userId || saved === undefined || !timezone || saved === timezone) return
    api<UserProfile>('/profile', { method: 'PATCH', body: { timezone } })
      .then((updated) => queryClient.setQueryData(['user-profile', userId], updated))
      .catch(() => {
        // Best effort: the next app load tries again.
      })
  }, [queryClient, saved, userId])
}
