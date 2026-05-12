import { useMemo, useState } from 'react'
import { Card } from '../../components/Card'
import { Field } from '../../components/Field'
import { PrimaryButton } from '../../components/PrimaryButton'
import { Banner } from '../../components/Banner'
import { SegmentedPicker } from '../../components/SegmentedPicker'
import { ScreenHeader } from '../../components/ScreenHeader'
import {
  useCalorieLogsToday,
  useDeleteCalorieLog,
  useLogCalorie,
} from '../../hooks/useCalorieLogs'
import type { CalorieLog, MealType } from '../../types/db'

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

export function CalorieScreen() {
  const logs = useCalorieLogsToday()
  const logCalorie = useLogCalorie()
  const deleteLog = useDeleteCalorieLog()

  const [foodName, setFoodName] = useState('')
  const [calories, setCalories] = useState('')
  const [mealType, setMealType] = useState<MealType>(defaultMealForNow())
  const [error, setError] = useState<string | null>(null)

  const grouped = useMemo(() => groupByMeal(logs.data ?? []), [logs.data])
  const dailyTotal = useMemo(
    () => (logs.data ?? []).reduce((acc, row) => acc + row.calories, 0),
    [logs.data],
  )

  const calorieNum = Number(calories)
  const roundedCalories =
    Number.isFinite(calorieNum) && calorieNum > 0
      ? Math.max(1, Math.round(calorieNum))
      : 0
  const canSubmit = foodName.trim().length > 0 && roundedCalories > 0

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    try {
      await logCalorie.mutateAsync({
        food_name: foodName.trim(),
        calories: roundedCalories,
        meal_type: mealType,
      })
      setFoodName('')
      setCalories('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log meal.')
    }
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
    >
      <ScreenHeader
        title="Calories"
        subtitle={`${dailyTotal} kcal logged today`}
      />

      <Card padding="md">
        <form
          onSubmit={onSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
        >
          <Field
            label="Food"
            value={foodName}
            onChange={setFoodName}
            placeholder="Greek yogurt with honey"
            autoCapitalize="sentences"
          />
          <Field
            label="Calories"
            value={calories}
            onChange={setCalories}
            type="number"
            inputMode="numeric"
            placeholder="kcal"
          />
          <div>
            <div style={{ marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                Meal
              </span>
            </div>
            <SegmentedPicker
              options={MEAL_OPTIONS}
              value={mealType}
              onChange={setMealType}
              ariaLabel="Meal"
            />
          </div>
          {error && <Banner tone="error">{error}</Banner>}
          <PrimaryButton
            type="submit"
            loading={logCalorie.isPending}
            disabled={!canSubmit}
          >
            Log meal
          </PrimaryButton>
        </form>
      </Card>

      {logs.isLoading && (
        <Card padding="md">
          <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 13 }}>
            Loading today's entries…
          </p>
        </Card>
      )}

      {!logs.isLoading && (logs.data?.length ?? 0) === 0 && (
        <Card padding="md">
          <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 13 }}>
            No meals logged yet today.
          </p>
        </Card>
      )}

      {MEAL_OPTIONS.map((meal) => {
        const items = grouped[meal.value]
        if (!items || items.length === 0) return null
        const total = items.reduce((acc, row) => acc + row.calories, 0)
        return (
          <Card key={meal.value} padding="md">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                {meal.label}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {total} kcal
              </span>
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {items.map((row) => (
                <li
                  key={row.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 0',
                    borderBottom: '1px solid var(--divider)',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 15,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.food_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {row.calories} kcal · {formatTime(row.logged_at)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteLog.mutate(row.id)}
                    aria-label={`Delete ${row.food_name}`}
                    style={{
                      color: 'var(--text-tertiary)',
                      padding: 8,
                      marginLeft: 4,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )
      })}
    </div>
  )
}

function groupByMeal(rows: CalorieLog[]): Record<MealType, CalorieLog[]> {
  const out: Record<MealType, CalorieLog[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  }
  for (const row of rows) out[row.meal_type].push(row)
  return out
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function defaultMealForNow(): MealType {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}
