import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Ring } from '../../components/Ring'
import { Icon, type IconName } from '../../components/Icon'
import { SectionHeader } from '../../components/PageHeader'
import { useUnitSystem, useUserProfile } from '../../hooks/useUserProfile'
import { useDailyExerciseTotal } from '../../hooks/useDailyTotals'
import { useAuth } from '../../auth/AuthProvider'
import { useRecentWeightLogs } from '../../hooks/useWeightLogs'
import { useRecentHeartRateLogs } from '../../hooks/useHeartRateLogs'
import { useCalorieLogsToday } from '../../hooks/useCalorieLogs'
import { useLogWater, useWaterLogsToday } from '../../hooks/useWaterLogs'
import { useSetWorkoutPlanCompleted, useUpcomingWorkoutPlans } from '../../hooks/useWorkoutPlans'
import { useUpcomingMealPlans } from '../../hooks/usePlans'
import { toLocalDateKey } from '../../lib/date'
import { formatWeight, weightFromKg, weightUnit, roundForDisplay } from '../../lib/units'
import { workoutTypeLabel } from '../workouts/constants'
import { FastingCard } from '../fasting/FastingCard'
import type { MealType } from '../../types/db'

const EXERCISE_GOAL_MINUTES = 30
const WATER_PRESETS = [250, 500]

const MEAL_TONE: Record<MealType, string> = {
  breakfast: 'var(--meal-breakfast)',
  lunch: 'var(--meal-lunch)',
  dinner: 'var(--meal-dinner)',
  snack: 'var(--meal-snack)',
}

export function TodayScreen() {
  const { session } = useAuth()
  const profile = useUserProfile()
  const meals = useCalorieLogsToday()
  const water = useWaterLogsToday()
  const logWater = useLogWater()
  const exercise = useDailyExerciseTotal()
  const weights = useRecentWeightLogs()
  const heartRates = useRecentHeartRateLogs()
  const workoutPlans = useUpcomingWorkoutPlans()
  const mealPlans = useUpcomingMealPlans()
  const setCompleted = useSetWorkoutPlanCompleted()
  const unitSystem = useUnitSystem()

  const firstError = profile.error ?? meals.error ?? water.error ?? exercise.error

  const calorieGoal = profile.data?.daily_calorie_goal ?? 2000
  const waterGoal = profile.data?.daily_water_goal_ml ?? 2500
  const name = profile.data?.name?.trim() || firstName(session?.user.email)

  const eaten = (meals.data ?? []).reduce((sum, row) => sum + row.calories, 0)
  const waterTotal = (water.data ?? []).reduce((sum, row) => sum + row.amount_ml, 0)
  const movement = exercise.data ?? 0
  const caloriesLeft = calorieGoal - eaten

  const todayKey = toLocalDateKey()
  const todaysWorkouts = (workoutPlans.data ?? []).filter((p) => p.planned_date === todayKey)
  const todaysMealPlans = (mealPlans.data ?? []).filter((p) => p.planned_date === todayKey)
  const sortedMeals = useMemo(
    () => [...(meals.data ?? [])].sort((a, b) => a.logged_at.localeCompare(b.logged_at)),
    [meals.data],
  )

  const latestWeight = weights.data?.[0]
  const weekAgoWeight = weights.data?.find(
    (row) => Date.now() - new Date(row.logged_at).getTime() >= 6 * 86_400_000,
  )
  const weightDelta =
    latestWeight && weekAgoWeight ? latestWeight.weight_kg - weekAgoWeight.weight_kg : null

  return (
    <div className="screen-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">{formatToday()}</p>
          <h1>
            {greeting()}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="subtitle">{statusLine(eaten, calorieGoal, waterTotal, waterGoal)}</p>
        </div>
      </header>

      <Link to="/coach" className="coach-entry">
        <span className="coach-entry-mark" aria-hidden="true">
          <Icon name="sparkle" size={20} />
        </span>
        <span className="coach-entry-main">
          <strong>Ask your coach</strong>
          <span>Feedback on your week, meal plans, grocery lists</span>
        </span>
        <Icon name="chevron" size={18} />
      </Link>

      <div className="today-columns">
        <div className="today-col">
          {/* Calories hero */}
          <Card padding="lg" radius="hero" style={{ order: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-md)', alignItems: 'center' }}>
              <div style={{ minWidth: 0 }}>
                <p className="eyebrow">Calories left</p>
                <strong
                  style={{
                    display: 'block',
                    marginTop: 6,
                    fontFamily: 'var(--font-display)',
                    fontSize: 'var(--text-hero)',
                    fontWeight: 500,
                    lineHeight: 1,
                    letterSpacing: 'var(--tracking-title)',
                    color: caloriesLeft < 0 ? 'var(--danger)' : 'var(--text-primary)',
                  }}
                >
                  {meals.isLoading ? '—' : Math.abs(caloriesLeft).toLocaleString()}
                </strong>
                <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                  {caloriesLeft < 0 ? 'kcal over your goal' : `of ${calorieGoal.toLocaleString()} kcal goal`}
                </p>
              </div>
              <Ring
                value={eaten}
                goal={calorieGoal}
                color="var(--calorie-ring)"
                size={112}
                stroke={11}
                label={`${eaten} of ${calorieGoal} calories eaten`}
              >
                <span style={{ display: 'grid', lineHeight: 1.1 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600 }}>
                    {eaten.toLocaleString()}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-2xs)', fontWeight: 600 }}>eaten</span>
                </span>
              </Ring>
            </div>
            <Link to="/log/calories" className="btn btn-filled" style={{ width: '100%', marginTop: 'var(--space-ml)' }}>
              <Icon name="plus" size={18} strokeWidth={2.2} /> Log a meal
            </Link>
          </Card>

          {/* Today's timeline */}
          <Card padding="lg" style={{ order: 4 }}>
            <SectionHeader
              title="Today"
              meta={sortedMeals.length ? `${sortedMeals.length} ${sortedMeals.length === 1 ? 'entry' : 'entries'}` : undefined}
            />
            {todaysWorkouts.length + todaysMealPlans.length + sortedMeals.length === 0 && !meals.isLoading && (
              <p className="empty-note">Nothing logged yet. Tap + to add your first meal, glass of water or workout.</p>
            )}
            <ul className="row-list">
              {todaysWorkouts.map((plan) => {
                const done = !!plan.completed_at
                return (
                  <li key={plan.id}>
                    <span className="tile-icon" style={{ ['--tone' as string]: 'var(--ember)', width: 36, height: 36, borderRadius: 11 }}>
                      <Icon name="dumbbell" size={18} />
                    </span>
                    <div className="row-main">
                      <div className="row-title" style={done ? { textDecoration: 'line-through', color: 'var(--text-tertiary)' } : undefined}>
                        {plan.name}
                      </div>
                      <div className="row-meta">
                        {workoutTypeLabel(plan.workout_type)} · {plan.exercises.length}{' '}
                        {plan.exercises.length === 1 ? 'exercise' : 'exercises'}
                      </div>
                    </div>
                    {done ? (
                      <span className="chip" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}>
                        <Icon name="check" size={16} strokeWidth={2.4} /> Done
                      </span>
                    ) : (
                      <Link to="/log/workout" className="chip">Start</Link>
                    )}
                    {!done && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Mark ${plan.name} done`}
                        title="Mark done"
                        disabled={setCompleted.isPending}
                        onClick={() => setCompleted.mutate({ id: plan.id, completed: true })}
                      >
                        <Icon name="check" size={18} strokeWidth={2.2} />
                      </button>
                    )}
                  </li>
                )
              })}
              {sortedMeals.map((row) => (
                <li key={row.id}>
                  <span className="row-dot" style={{ background: MEAL_TONE[row.meal_type] }} aria-hidden="true" />
                  <div className="row-main">
                    <div className="row-title">{row.food_name}</div>
                    <div className="row-meta">
                      {capitalize(row.meal_type)} · {formatTime(row.logged_at)}
                    </div>
                  </div>
                  <span className="row-value">{row.calories} kcal</span>
                </li>
              ))}
              {todaysMealPlans.map((plan) => (
                <li key={plan.id}>
                  <span
                    className="row-dot"
                    style={{ border: `2px solid ${MEAL_TONE[plan.meal_type]}` }}
                    aria-hidden="true"
                  />
                  <div className="row-main">
                    <div className="row-title" style={{ color: 'var(--text-secondary)' }}>{plan.name}</div>
                    <div className="row-meta">Planned {plan.meal_type}</div>
                  </div>
                  <span className="row-value" style={{ color: 'var(--text-tertiary)' }}>{plan.calories} kcal</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="today-col">
          {/* Fasting: right under calories on phones, where it is also the way into Fasting. */}
          <FastingCard style={{ order: 2 }} />

          {/* Habits */}
          <Card padding="lg" style={{ order: 3 }}>
            <SectionHeader title="Habits" />
            <div className="metric-row" style={{ paddingTop: 0 }}>
              <div className="metric-row-head">
                <span className="metric-row-label">
                  <span className="tile-icon" style={{ ['--tone' as string]: 'var(--saffron)', width: 28, height: 28, borderRadius: 9 }}>
                    <Icon name="drop" size={15} />
                  </span>
                  Water
                </span>
                <span className="metric-row-value">
                  <strong>{waterTotal.toLocaleString()}</strong> / {waterGoal.toLocaleString()} ml
                </span>
              </div>
              <Progress value={waterTotal} goal={waterGoal} color="var(--water-fill)" label="Water" />
              <div className="chip-row">
                {WATER_PRESETS.map((ml) => (
                  <button
                    key={ml}
                    type="button"
                    className="chip"
                    disabled={logWater.isPending}
                    onClick={() => logWater.mutate(ml)}
                    aria-label={`Add ${ml} millilitres of water`}
                  >
                    +{ml} ml
                  </button>
                ))}
                <Link to="/log/water" className="chip" style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--field-border)' }}>
                  Custom
                </Link>
              </div>
              {logWater.isError && (
                <p role="alert" style={{ margin: '8px 0 0', color: 'var(--danger)', fontSize: 'var(--text-xs)' }}>
                  Couldn't add water. Try again.
                </p>
              )}
            </div>
            <div className="metric-row">
              <div className="metric-row-head">
                <span className="metric-row-label">
                  <span className="tile-icon" style={{ ['--tone' as string]: 'var(--ember)', width: 28, height: 28, borderRadius: 9 }}>
                    <Icon name="run" size={15} />
                  </span>
                  Movement
                </span>
                <span className="metric-row-value">
                  <strong>{movement}</strong> / {EXERCISE_GOAL_MINUTES} min
                </span>
              </div>
              <Progress value={movement} goal={EXERCISE_GOAL_MINUTES} color="var(--exercise-ring)" label="Movement" />
            </div>
          </Card>

          {/* Body */}
          <div style={{ order: 5, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-sm)' }}>
            <BodyTile
              to="/log/weight"
              icon="scale"
              tone="var(--sage-deep)"
              label="Weight"
              value={latestWeight ? formatWeight(latestWeight.weight_kg, unitSystem) : '—'}
              detail={
                weightDelta === null
                  ? latestWeight
                    ? `Logged ${formatShortDate(latestWeight.logged_at)}`
                    : 'Add a reading'
                  : formatDelta(weightDelta, unitSystem)
              }
              detailClass={weightDelta === null || Math.abs(weightDelta) < 0.05 ? undefined : weightDelta < 0 ? 'delta-down' : 'delta-up'}
            />
            <BodyTile
              to="/log/heart-rate"
              icon="heart"
              tone="var(--plum)"
              label="Resting HR"
              value={heartRates.data?.[0] ? `${heartRates.data[0].bpm} bpm` : '—'}
              detail={heartRates.data?.[0] ? `Logged ${formatShortDate(heartRates.data[0].recorded_at)}` : 'Add a reading'}
            />
          </div>
        </div>
      </div>

      {firstError && (
        <Card padding="md">
          <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>
            Couldn't load today's totals: {firstError.message}
          </p>
        </Card>
      )}
    </div>
  )
}

function Progress({ value, goal, color, label }: { value: number; goal: number; color: string; label: string }) {
  const pct = percent(value, goal)
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function BodyTile({
  to,
  icon,
  tone,
  label,
  value,
  detail,
  detailClass,
}: {
  to: string
  icon: IconName
  tone: string
  label: string
  value: string
  detail: string
  detailClass?: string
}) {
  return (
    <Link to={to} className="quick-log-card" style={{ minHeight: 0, gap: 12 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="tile-icon" style={{ ['--tone' as string]: tone, width: 28, height: 28, borderRadius: 9 }}>
          <Icon name={icon} size={15} />
        </span>
        <span className="eyebrow">{label}</span>
      </span>
      <span>
        <strong style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 600 }}>
          {value}
        </strong>
        <span className={detailClass} style={{ display: 'block', marginTop: 2, fontSize: 'var(--text-xs)', color: detailClass ? undefined : 'var(--text-tertiary)', fontWeight: detailClass ? 600 : 400 }}>
          {detail}
        </span>
      </span>
    </Link>
  )
}

function statusLine(eaten: number, calorieGoal: number, water: number, waterGoal: number): string {
  if (eaten === 0 && water === 0) return 'A fresh day. Start with a glass of water.'
  const parts: string[] = []
  parts.push(`${percent(eaten, calorieGoal)}% of calories`)
  parts.push(`${percent(water, waterGoal)}% of water`)
  return `You're at ${parts.join(' and ')}.`
}

function formatDelta(deltaKg: number, unitSystem: 'metric' | 'imperial'): string {
  const delta = weightFromKg(deltaKg, unitSystem)
  if (Math.abs(delta) < 0.05) return 'Steady this week'
  const arrow = delta < 0 ? '↓' : '↑'
  return `${arrow} ${roundForDisplay(Math.abs(delta), 1)} ${weightUnit(unitSystem)} this week`
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function firstName(email: string | undefined): string {
  if (!email) return ''
  const local = email.split('@')[0]
  return local.charAt(0).toUpperCase() + local.slice(1)
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function percent(value: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((value / goal) * 100)))
}

function formatToday(): string {
  return new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  if (toLocalDateKey(d) === toLocalDateKey()) return 'today'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
