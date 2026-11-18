import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Field, CapsLabel } from '../../components/Field'
import { IconButton } from '../../components/IconButton'
import { SectionHeader } from '../../components/PageHeader'
import { PrimaryButton } from '../../components/PrimaryButton'
import { Banner } from '../../components/Banner'
import { SegmentedPicker } from '../../components/SegmentedPicker'
import { ScreenHeader } from '../../components/ScreenHeader'
import {
  useCalorieLogsForDay,
  useDeleteCalorieLog,
  useLogCalorie,
} from '../../hooks/useCalorieLogs'
import type { CalorieLog, MealType } from '../../types/db'
import { useUserProfile } from '../../hooks/useUserProfile'
import { useNow } from '../../hooks/useNow'
import { toLocalDateKey } from '../../lib/date'
import { atTimeOn, dayLabel, dayPhrase, resolveDayParam } from './day'
import { DayPicker } from './DayPicker'
import { parseCalories } from './calories'

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
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

export function CalorieScreen() {
  // Re-check once a minute so "today" rolls over at midnight.
  const todayKey = toLocalDateKey(new Date(useNow(60_000)))
  const [params, setParams] = useSearchParams()
  const dayKey = resolveDayParam(params.get('date'), todayKey)
  const isToday = dayKey === todayKey
  const label = dayLabel(dayKey, todayKey)
  const phrase = dayPhrase(dayKey, todayKey)

  const logs = useCalorieLogsForDay(dayKey)
  const logCalorie = useLogCalorie()
  const deleteLog = useDeleteCalorieLog()
  const profile = useUserProfile()

  const [foodName, setFoodName] = useState('')
  const [calories, setCalories] = useState('')
  const [mealType, setMealType] = useState<MealType>(defaultMealForNow())
  const [mealTouched, setMealTouched] = useState(false)
  const [eatenAt, setEatenAt] = useState(currentTimeValue)
  const [error, setError] = useState<string | null>(null)

  const grouped = useMemo(() => groupByMeal(logs.data ?? []), [logs.data])
  const dailyTotal = useMemo(
    () => (logs.data ?? []).reduce((acc, row) => acc + row.calories, 0),
    [logs.data],
  )
  const goal = profile.data?.daily_calorie_goal ?? 2000
  const remaining = Math.max(goal - dailyTotal, 0)
  const over = Math.max(dailyTotal - goal, 0)
  const progress = Math.min(100, Math.round((dailyTotal / goal) * 100))
  const logsError = logs.error
    ? logs.error instanceof Error
      ? logs.error.message
      : String(logs.error)
    : null

  const roundedCalories = parseCalories(calories)
  const canSubmit = foodName.trim().length > 0 && roundedCalories !== null

  function selectDay(key: string) {
    const next = new URLSearchParams(params)
    if (key === todayKey) next.delete('date')
    else next.set('date', key)
    // Replace, so Back still leaves the screen instead of stepping through days.
    setParams(next, { replace: true })
    setError(null)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || roundedCalories === null) return
    setError(null)
    const eatenDate = atTimeOn(dayKey, eatenAt)
    if (!eatenDate) {
      setError('Enter the time you ate this.')
      return
    }
    if (eatenDate.getTime() > Date.now() + 60_000) {
      setError("The eaten-at time can't be in the future.")
      return
    }
    try {
      await logCalorie.mutateAsync({
        food_name: foodName.trim(),
        calories: roundedCalories,
        meal_type: mealType,
        logged_at: eatenDate.toISOString(),
      })
      setFoodName('')
      setCalories('')
      setEatenAt(currentTimeValue())
      setMealTouched(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log meal.')
    }
  }

  function onEatenAtChange(value: string) {
    setEatenAt(value)
    const date = atTimeOn(dayKey, value)
    if (date && !mealTouched) setMealType(mealForHour(date.getHours()))
  }

  return (
    <div className="screen-stack">
      <ScreenHeader title="Calories" subtitle={statusLine(logs.data?.length ?? 0, dailyTotal, phrase)} />

      <div className="tracker-grid">
        <div className="screen-stack">
          <DayPicker value={dayKey} todayKey={todayKey} onChange={selectDay} />

          <Card padding="lg" radius="hero">
            <p className="eyebrow">{over > 0 ? 'Over goal' : isToday ? 'Calories left' : 'Under goal'}</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)', marginTop: 6 }}>
              <strong
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-stat)',
                  fontWeight: 500,
                  lineHeight: 1,
                  letterSpacing: 'var(--tracking-title)',
                  color: over > 0 ? 'var(--danger)' : 'var(--text-primary)',
                }}
              >
                {logs.isLoading ? '—' : (over > 0 ? over : remaining).toLocaleString()}
              </strong>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>kcal</span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Calories eaten"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              style={{ marginTop: 'var(--space-md)' }}
            >
              <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--calorie-ring)' }} />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 'var(--space-sm)',
                marginTop: 'var(--space-sm)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
              }}
            >
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>{dailyTotal.toLocaleString()}</strong> eaten
              </span>
              <span>Goal {goal.toLocaleString()} kcal</span>
            </div>
          </Card>

          <Card padding="lg">
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
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 'var(--space-ms)',
                  alignItems: 'start',
                }}
              >
                <Field
                  label="Calories"
                  value={calories}
                  onChange={setCalories}
                  type="number"
                  inputMode="numeric"
                  placeholder="kcal"
                />
                <Field
                  label="Eaten at"
                  value={eatenAt}
                  onChange={onEatenAtChange}
                  type="time"
                  hint={label}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CapsLabel>Meal</CapsLabel>
                <SegmentedPicker
                  options={MEAL_OPTIONS}
                  value={mealType}
                  onChange={(value) => {
                    setMealType(value)
                    setMealTouched(true)
                  }}
                  ariaLabel="Meal"
                />
              </div>
              {error && <Banner tone="error">{error}</Banner>}
              <PrimaryButton
                type="submit"
                loading={logCalorie.isPending}
                disabled={!canSubmit}
              >
                {isToday ? 'Log meal' : `Log meal ${phrase}`}
              </PrimaryButton>
            </form>
          </Card>
        </div>

        <Card padding="lg">
          <SectionHeader
            title={label}
            meta={
              logs.data?.length
                ? `${logs.data.length} ${logs.data.length === 1 ? 'entry' : 'entries'}`
                : undefined
            }
          />

          {logs.isLoading && <p className="empty-note">Loading entries…</p>}

          {logs.isError && <Banner tone="error">{logsError ?? 'Failed to load meals.'}</Banner>}

          {!logs.isLoading && !logs.isError && (logs.data?.length ?? 0) === 0 && (
            <p className="empty-note">
              {isToday ? 'No meals logged yet today.' : `No meals logged ${phrase}.`}
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {MEAL_OPTIONS.map((meal) => {
              const items = grouped[meal.value]
              if (!items || items.length === 0) return null
              const total = items.reduce((acc, row) => acc + row.calories, 0)
              return (
                <section key={meal.value} aria-labelledby={`meal-${meal.value}`}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 'var(--space-sm)',
                      paddingBottom: 'var(--space-xs)',
                      borderBottom: '1px solid var(--divider)',
                    }}
                  >
                    <h3 id={`meal-${meal.value}`} className="eyebrow" style={{ color: 'var(--text-secondary)' }}>
                      {meal.label}
                    </h3>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                      {total.toLocaleString()} kcal
                    </span>
                  </div>
                  <ul className="row-list">
                    {items.map((row) => {
                      const time = formatTime(row.logged_at)
                      return (
                        <li key={row.id}>
                          <span className="row-dot" style={{ background: MEAL_TONE[row.meal_type] }} aria-hidden="true" />
                          <div className="row-main">
                            <div className="row-title">{row.food_name}</div>
                            <div className="row-meta">{time}</div>
                          </div>
                          <span className="row-value">{row.calories} kcal</span>
                          <IconButton
                            icon="trash"
                            tone="danger"
                            label={`Delete ${row.food_name} at ${time}`}
                            onClick={() => deleteLog.mutate(row.id)}
                            style={{ marginRight: -10 }}
                          />
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

function statusLine(count: number, total: number, phrase: string): string {
  if (count === 0) return phrase === 'today' ? 'Nothing logged yet today' : `Nothing logged ${phrase}`
  return `${count} ${count === 1 ? 'meal' : 'meals'} · ${total.toLocaleString()} kcal ${phrase}`
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
  return mealForHour(new Date().getHours())
}

function mealForHour(h: number): MealType {
  if (h < 10) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

function currentTimeValue(): string {
  const now = new Date()
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}
