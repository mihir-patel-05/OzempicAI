import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { api } from '../lib/api'
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
    queryFn: () => api<MealPlan[]>('/meal-plans', { query: { from_date: today, limit: 50 } }),
  })
}

export function useCreateMealPlan() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateMealPlanInput) => {
      if (!userId) throw new Error('Not signed in')
      await api('/meal-plans', { method: 'POST', body: input })
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
      await api(`/meal-plans/${id}`, { method: 'DELETE' })
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
    queryFn: () => api<GroceryItem[]>('/grocery-items'),
  })
}

export function useCreateGroceryItem() {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateGroceryItemInput) => {
      if (!userId) throw new Error('Not signed in')
      await api('/grocery-items', { method: 'POST', body: input })
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
      await api(`/grocery-items/${id}`, { method: 'PATCH', body: { is_purchased } })
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
      await api(`/grocery-items/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grocery-items'] }),
  })
}
