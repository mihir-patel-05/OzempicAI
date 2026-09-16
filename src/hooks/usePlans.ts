import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import type { GroceryCategory, GroceryItem, MealPlan, MealType } from '../types/db'

export interface CreateMealPlanInput {
  name: string
  planned_date: string
  meal_type: MealType
  calories: number
}

export interface CreateGroceryItemInput {
  name: string
  category: GroceryCategory
}

export function useUpcomingMealPlans() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const today = new Date().toLocaleDateString('en-CA')

  return useQuery({
    enabled: !!userId,
    queryKey: ['meal-plans', userId, today],
    queryFn: async (): Promise<MealPlan[]> => {
      const { data, error } = await supabase.from('meal_plans').select('*').eq('user_id', userId!).gte('planned_date', today).order('planned_date').order('meal_type').limit(50)
      if (error) throw error
      return (data ?? []) as MealPlan[]
    },
  })
}

export function useCreateMealPlan() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateMealPlanInput) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase.from('meal_plans').insert({ user_id: userId, ...input })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meal-plans'] }),
  })
}

export function useDeleteMealPlan() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase.from('meal_plans').delete().eq('id', id).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meal-plans'] }),
  })
}

export function useGroceryItems() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  return useQuery({
    enabled: !!userId,
    queryKey: ['grocery-items', userId],
    queryFn: async (): Promise<GroceryItem[]> => {
      const { data, error } = await supabase.from('grocery_items').select('*').eq('user_id', userId!).order('is_purchased').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as GroceryItem[]
    },
  })
}

export function useCreateGroceryItem() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateGroceryItemInput) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase.from('grocery_items').insert({ user_id: userId, ...input })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grocery-items'] }),
  })
}

export function useToggleGroceryItem() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, is_purchased }: Pick<GroceryItem, 'id' | 'is_purchased'>) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase.from('grocery_items').update({ is_purchased }).eq('id', id).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grocery-items'] }),
  })
}

export function useDeleteGroceryItem() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('Not signed in')
      const { error } = await supabase.from('grocery_items').delete().eq('id', id).eq('user_id', userId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grocery-items'] }),
  })
}
