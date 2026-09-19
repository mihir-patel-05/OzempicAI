import { useMemo, useState } from 'react'
import { Banner } from '../../components/Banner'
import { Card } from '../../components/Card'
import { Field } from '../../components/Field'
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
const MEALS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]
const CATEGORIES: GroceryCategory[] = ['produce', 'dairy', 'protein', 'grains', 'beverages', 'snacks', 'other']

export function PlansScreen() {
  const [tab, setTab] = useState<Tab>('meals')
  return (
    <div className="screen-stack">
      <header>
        <p style={eyebrowStyle}>Plan ahead</p>
        <h1 style={titleStyle}>Plan it once, follow it all week.</h1>
        <p style={subtitleStyle}>Sketch out upcoming meals and workouts, and keep a grocery list that travels with you.</p>
      </header>
      <div style={{ maxWidth: 480 }}>
        <SegmentedPicker options={[{ value: 'meals', label: 'Meal plan' }, { value: 'workouts', label: 'Workouts' }, { value: 'groceries', label: 'Groceries' }]} value={tab} onChange={setTab} ariaLabel="Planning view" />
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
      <Card padding="lg" radius="hero" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h2 style={sectionTitleStyle}>Add a meal</h2>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <Field label="Meal name" value={name} onChange={setName} placeholder="Roasted salmon bowl" autoCapitalize="sentences" />
          <div style={{ display: 'grid', gridTemplateColumns: '1.25fr .75fr', gap: 10 }}>
            <Field label="Date" value={date} onChange={setDate} type="date" min={new Date().toLocaleDateString('en-CA')} />
            <Field label="Calories" value={calories} onChange={setCalories} type="number" inputMode="numeric" placeholder="kcal" min="1" />
          </div>
          <SegmentedPicker options={MEALS} value={meal} onChange={setMeal} ariaLabel="Meal type" />
          {error && <Banner tone="error">{error}</Banner>}
          <PrimaryButton type="submit" loading={createPlan.isPending} disabled={!canSubmit}>Add to plan</PrimaryButton>
        </form>
      </Card>
      <Card padding="lg" radius="hero" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <h2 style={sectionTitleStyle}>Upcoming</h2>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{plans.data?.length ?? 0} meals</span>
        </div>
        {plans.isLoading && <MutedText>Loading your plan…</MutedText>}
        {plans.isError && <Banner tone="error">Could not load your meal plan.</Banner>}
        {!plans.isLoading && !plans.isError && !plans.data?.length && <MutedText>No meals planned yet. Add the first one.</MutedText>}
        {Object.entries(grouped).map(([plannedDate, entries]) => (
          <div key={plannedDate} style={{ marginTop: 18 }}>
            <p style={{ ...eyebrowStyle, marginBottom: 6 }}>{formatPlanDate(plannedDate)}</p>
            {entries.map((plan) => <ListRow key={plan.id} title={plan.name} meta={`${capitalize(plan.meal_type)} · ${plan.calories} kcal`} onDelete={() => deletePlan.mutate(plan.id)} />)}
          </div>
        ))}
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
      <Card padding="lg" radius="hero" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h2 style={sectionTitleStyle}>Add an item</h2>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <Field label="Item" value={name} onChange={setName} placeholder="Baby spinach" autoCapitalize="sentences" />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={eyebrowStyle}>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as GroceryCategory)} style={selectStyle}>
              {CATEGORIES.map((value) => <option key={value} value={value}>{capitalize(value)}</option>)}
            </select>
          </label>
          {error && <Banner tone="error">{error}</Banner>}
          <PrimaryButton type="submit" loading={createItem.isPending} disabled={!name.trim()}>Add item</PrimaryButton>
        </form>
      </Card>
      <Card padding="lg" radius="hero" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <h2 style={sectionTitleStyle}>Your list</h2>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{remaining} remaining</span>
        </div>
        {items.isLoading && <MutedText>Loading your list…</MutedText>}
        {!items.isLoading && !items.data?.length && <MutedText>Your grocery list is clear.</MutedText>}
        {(items.data ?? []).map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 0', borderBottom: '1px solid var(--divider)' }}>
            <button type="button" aria-label={item.is_purchased ? `Mark ${item.name} as needed` : `Mark ${item.name} as purchased`} onClick={() => toggleItem.mutate({ id: item.id, is_purchased: !item.is_purchased })} style={{ display: 'grid', flex: '0 0 auto', width: 24, height: 24, placeItems: 'center', borderRadius: 8, border: `1px solid ${item.is_purchased ? 'var(--sage-deep)' : 'var(--dust)'}`, background: item.is_purchased ? 'var(--sage-deep)' : 'transparent', color: 'white' }}>
              {item.is_purchased ? '✓' : ''}
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ textDecoration: item.is_purchased ? 'line-through' : 'none', color: item.is_purchased ? 'var(--text-tertiary)' : 'var(--text-primary)', fontSize: 14 }}>{item.name}</div>
              <div style={{ color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'capitalize' }}>{item.category}</div>
            </div>
            <DeleteButton label={`Delete ${item.name}`} onClick={() => deleteItem.mutate(item.id)} />
          </div>
        ))}
      </Card>
    </div>
  )
}

function ListRow({ title, meta, onDelete }: { title: string; meta: string; onDelete: () => void }) {
  return <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--divider)' }}><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 14 }}>{title}</div><div style={{ marginTop: 2, color: 'var(--text-tertiary)', fontSize: 10 }}>{meta}</div></div><DeleteButton label={`Delete ${title}`} onClick={onDelete} /></div>
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" aria-label={label} onClick={onClick} style={{ padding: 8, color: 'var(--text-tertiary)', fontSize: 17 }}>×</button>
}

function MutedText({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '16px 0 0', color: 'var(--text-tertiary)', fontSize: 13 }}>{children}</p>
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

const eyebrowStyle: React.CSSProperties = { margin: '0 0 3px', color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 700, letterSpacing: 1.1, textTransform: 'uppercase' }
const titleStyle: React.CSSProperties = { margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 42px)', fontWeight: 500, letterSpacing: -1 }
const subtitleStyle: React.CSSProperties = { maxWidth: 590, margin: '9px 0 8px', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }
const sectionTitleStyle: React.CSSProperties = { margin: '0 0 16px', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }
const selectStyle: React.CSSProperties = { width: '100%', border: '1px solid var(--divider)', borderRadius: 'var(--radius-sm)', background: 'var(--cream-dim)', padding: '12px 14px', fontSize: 16 }
