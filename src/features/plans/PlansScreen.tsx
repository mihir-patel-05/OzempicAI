import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Banner } from '../../components/Banner'
import { Card } from '../../components/Card'
import { CapsLabel, Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { IconButton } from '../../components/IconButton'
import { PageHeader, SectionHeader } from '../../components/PageHeader'
import { PrimaryButton } from '../../components/PrimaryButton'
import { SegmentedPicker } from '../../components/SegmentedPicker'
import {
  useCreateGroceryItem,
  useCreateMealPlan,
  useDeleteGroceryItem,
  useDeleteMealPlan,
  useGroceryItems,
  useToggleGroceryItem,
  useUpcomingMealPlans,
} from '../../hooks/usePlans'
import type { GroceryCategory, MealPlan, MealType } from '../../types/db'
import { WorkoutPlanner } from '../workouts/WorkoutPlanner'

type Tab = 'meals' | 'workouts' | 'groceries'
const TABS: readonly Tab[] = ['meals', 'workouts', 'groceries']
const MEALS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]
const MEAL_TONE: Record<MealType, string> = {
  breakfast: 'var(--meal-breakfast)',
  lunch: 'var(--meal-lunch)',
  dinner: 'var(--meal-dinner)',
  snack: 'var(--meal-snack)',
}
const CATEGORIES: GroceryCategory[] = ['produce', 'dairy', 'protein', 'grains', 'beverages', 'snacks', 'other']

export function PlansScreen() {
  // The tab lives in the URL (?tab=groceries) so other screens can link to it.
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab') as Tab | null
  const tab: Tab = requested && TABS.includes(requested) ? requested : 'meals'
  const setTab = (next: Tab) => setParams(next === 'meals' ? {} : { tab: next }, { replace: true })
  return (
    <div className="screen-stack">
      <PageHeader title="Plans" subtitle="Meals, workouts and groceries for the week ahead" />
      <div style={{ maxWidth: 480 }}>
        <SegmentedPicker
          options={[
            { value: 'meals', label: 'Meal plan' },
            { value: 'workouts', label: 'Workouts' },
            { value: 'groceries', label: 'Groceries' },
          ]}
          value={tab}
          onChange={setTab}
          ariaLabel="Planning view"
        />
      </div>
      {tab === 'meals' && <MealPlanner />}
      {tab === 'workouts' && <WorkoutPlanner />}
      {tab === 'groceries' && <GroceryList />}
    </div>
  )
}

function MealPlanner() {
  const plans = useUpcomingMealPlans()
  const createPlan = useCreateMealPlan()
  const deletePlan = useDeleteMealPlan()
  const [name, setName] = useState('')
  const [date, setDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [meal, setMeal] = useState<MealType>('dinner')
  const [calories, setCalories] = useState('')
  const [error, setError] = useState<string | null>(null)
  const calorieValue = Math.round(Number(calories))
  const canSubmit = name.trim().length > 0 && date.length === 10 && calorieValue > 0
  const grouped = useMemo(() => groupPlans(plans.data ?? []), [plans.data])
  const count = plans.data?.length ?? 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    try {
      await createPlan.mutateAsync({ name: name.trim(), planned_date: date, meal_type: meal, calories: calorieValue })
      setName('')
      setCalories('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the meal.')
    }
  }

  return (
    <div className="tracker-grid">
      <Card padding="lg">
        <SectionHeader title="Upcoming" meta={plans.isLoading ? undefined : `${count} ${count === 1 ? 'meal' : 'meals'}`} />
        {plans.isLoading && <p className="empty-note">Loading your plan…</p>}
        {plans.isError && <Banner tone="error">Could not load your meal plan.</Banner>}
        {!plans.isLoading && !plans.isError && count === 0 && (
          <p className="empty-note">No meals planned yet. Add the first one below.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {Object.entries(grouped).map(([plannedDate, entries]) => (
            <div key={plannedDate}>
              <p className="eyebrow" style={{ marginBottom: 2 }}>{formatPlanDate(plannedDate)}</p>
              <ul className="row-list">
                {entries.map((plan) => (
                  <li key={plan.id}>
                    <span className="row-dot" style={{ background: MEAL_TONE[plan.meal_type] }} aria-hidden="true" />
                    <div className="row-main">
                      <div className="row-title">{plan.name}</div>
                      <div className="row-meta">{capitalize(plan.meal_type)}</div>
                    </div>
                    <span className="row-value">{plan.calories} kcal</span>
                    <IconButton
                      icon="trash"
                      tone="danger"
                      label={`Delete ${plan.name}, ${formatPlanDate(plannedDate)}`}
                      onClick={() => deletePlan.mutate(plan.id)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="lg">
        <SectionHeader title="Add a meal" />
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <Field label="Meal name" value={name} onChange={setName} placeholder="Roasted salmon bowl" autoCapitalize="sentences" />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 0.75fr)', gap: 'var(--space-sm)' }}>
            <Field label="Date" value={date} onChange={setDate} type="date" min={new Date().toLocaleDateString('en-CA')} />
            <Field label="Calories" value={calories} onChange={setCalories} type="number" inputMode="numeric" placeholder="kcal" min="1" />
          </div>
          <SegmentedPicker options={MEALS} value={meal} onChange={setMeal} ariaLabel="Meal type" />
          {error && <Banner tone="error">{error}</Banner>}
          <PrimaryButton type="submit" loading={createPlan.isPending} disabled={!canSubmit}>Add to plan</PrimaryButton>
        </form>
      </Card>
    </div>
  )
}

function GroceryList() {
  const items = useGroceryItems()
  const createItem = useCreateGroceryItem()
  const toggleItem = useToggleGroceryItem()
  const deleteItem = useDeleteGroceryItem()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<GroceryCategory>('produce')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    try {
      await createItem.mutateAsync({ name: name.trim(), category })
      setName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the item.')
    }
  }

  const remaining = (items.data ?? []).filter((item) => !item.is_purchased).length
  return (
    <div className="tracker-grid">
      <Card padding="lg">
        <SectionHeader title="Your list" meta={items.isLoading ? undefined : `${remaining} remaining`} />
        {items.isLoading && <p className="empty-note">Loading your list…</p>}
        {!items.isLoading && !items.data?.length && <p className="empty-note">Your grocery list is clear.</p>}
        <ul className="row-list">
          {(items.data ?? []).map((item) => (
            <li key={item.id} style={{ gap: 'var(--space-xs)' }}>
              <button
                type="button"
                aria-label={item.is_purchased ? `Mark ${item.name} as needed` : `Mark ${item.name} as purchased`}
                onClick={() => toggleItem.mutate({ id: item.id, is_purchased: !item.is_purchased })}
                style={{ display: 'grid', flex: 'none', width: 'var(--tap)', height: 'var(--tap)', placeItems: 'center', marginLeft: -10 }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'grid',
                    width: 22,
                    height: 22,
                    placeItems: 'center',
                    borderRadius: 'var(--radius-xs)',
                    border: `1.5px solid ${item.is_purchased ? 'var(--success)' : 'var(--field-border-strong)'}`,
                    background: item.is_purchased ? 'var(--success)' : 'transparent',
                    color: 'var(--on-accent)',
                    transition: 'background 120ms ease-out, border-color 120ms ease-out',
                  }}
                >
                  {item.is_purchased && <Icon name="check" size={14} strokeWidth={3} />}
                </span>
              </button>
              <div className="row-main">
                <div
                  className="row-title"
                  style={item.is_purchased ? { textDecoration: 'line-through', color: 'var(--text-tertiary)' } : undefined}
                >
                  {item.name}
                </div>
                <div className="row-meta">{capitalize(item.category)}</div>
              </div>
              <IconButton
                icon="trash"
                tone="danger"
                label={`Delete ${item.name}`}
                onClick={() => deleteItem.mutate(item.id)}
              />
            </li>
          ))}
        </ul>
      </Card>

      <Card padding="lg">
        <SectionHeader title="Add an item" />
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 'var(--space-sm)' }}>
            <Field label="Item" value={name} onChange={setName} placeholder="Baby spinach" autoCapitalize="sentences" />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <CapsLabel>Category</CapsLabel>
              <select className="field-input" value={category} onChange={(e) => setCategory(e.target.value as GroceryCategory)}>
                {CATEGORIES.map((value) => <option key={value} value={value}>{capitalize(value)}</option>)}
              </select>
            </label>
          </div>
          {error && <Banner tone="error">{error}</Banner>}
          <PrimaryButton type="submit" loading={createItem.isPending} disabled={!name.trim()}>Add item</PrimaryButton>
        </form>
      </Card>
    </div>
  )
}

function groupPlans(plans: MealPlan[]): Record<string, MealPlan[]> {
  return plans.reduce<Record<string, MealPlan[]>>((groups, plan) => {
    ;(groups[plan.planned_date] ??= []).push(plan)
    return groups
  }, {})
}

function formatPlanDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace('_', ' ')
}
