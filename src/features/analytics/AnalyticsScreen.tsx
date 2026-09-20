import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banner } from '../../components/Banner'
import { Card } from '../../components/Card'
import { SegmentedPicker } from '../../components/SegmentedPicker'
import { useAnalyticsDashboard } from '../../hooks/useAnalyticsDashboard'
import { useUnitSystem, useUserProfile } from '../../hooks/useUserProfile'
import {
  distanceFromKm,
  distanceUnit,
  formatDistance,
  formatWeight,
  roundForDisplay,
  weightFromKg,
  weightUnit,
} from '../../lib/units'
import { workoutTypeLabel } from '../workouts/constants'
import type { UnitSystem } from '../../types/db'
import { AnalyticsBarChart, AnalyticsLineChart } from './AnalyticsCharts'
import { ANALYTICS_RANGE_OPTIONS, getAnalyticsDateRange } from './range'
import {
  buildCardioSummary,
  buildOverview,
  buildStrengthSummary,
  buildWeeklyActivity,
  buildWeeklyStrengthVolume,
  buildWeightSummary,
  buildWellnessSummary,
  getExerciseOptions,
} from './transform'
import type {
  AnalyticsDailyRow,
  AnalyticsRange,
  ExerciseOption,
} from './types'

const RANGE_STORAGE_KEY = 'ozempicai.analytics.range'

export function AnalyticsScreen() {
  const [range, setRange] = useState<AnalyticsRange>(readStoredRange)
  const [strengthKey, setStrengthKey] = useState<string | null>(null)
  const [cardioKey, setCardioKey] = useState<string | null>(null)
  const analytics = useAnalyticsDashboard(range)
  const profile = useUserProfile()
  const unitSystem = useUnitSystem()
  const rows = analytics.data?.daily ?? []
  const exercises = analytics.data?.exercises ?? []
  const dateRange = getAnalyticsDateRange(range)

  const overview = useMemo(() => buildOverview(rows), [rows])
  const weights = useMemo(() => buildWeightSummary(rows), [rows])
  const weeklyActivity = useMemo(() => buildWeeklyActivity(rows), [rows])
  const strengthOptions = useMemo(
    () => getExerciseOptions(exercises, 'strength'),
    [exercises],
  )
  const cardioOptions = useMemo(
    () => getExerciseOptions(exercises, 'cardio'),
    [exercises],
  )

  useEffect(() => {
    sessionStorage.setItem(RANGE_STORAGE_KEY, range)
  }, [range])

  useEffect(() => {
    if (!strengthOptions.some((option) => option.key === strengthKey)) {
      setStrengthKey(strengthOptions[0]?.key ?? null)
    }
  }, [strengthKey, strengthOptions])

  useEffect(() => {
    if (!cardioOptions.some((option) => option.key === cardioKey)) {
      setCardioKey(cardioOptions[0]?.key ?? null)
    }
  }, [cardioKey, cardioOptions])

  const strength = useMemo(
    () => buildStrengthSummary(exercises, strengthKey),
    [exercises, strengthKey],
  )
  const cardio = useMemo(
    () => buildCardioSummary(exercises, cardioKey),
    [exercises, cardioKey],
  )
  const wellness = useMemo(
    () =>
      buildWellnessSummary(
        rows,
        profile.data?.daily_water_goal_ml ?? 2500,
      ),
    [profile.data?.daily_water_goal_ml, rows],
  )
  const hasData = rows.some(hasAnalyticsData)

  return (
    <div className="screen-stack analytics-screen">
      <header className="analytics-header">
        <div>
          <p className="eyebrow">Your progress</p>
          <h1>Analytics</h1>
          <p>
            {formatRange(dateRange.start, dateRange.end)} · Times use your device
            timezone
          </p>
        </div>
      </header>

      <SegmentedPicker
        options={ANALYTICS_RANGE_OPTIONS}
        value={range}
        onChange={setRange}
        ariaLabel="Analytics date range"
      />

      {analytics.isLoading && <AnalyticsLoading />}
      {analytics.isError && (
        <Banner tone="error">
          Analytics could not be loaded. Try refreshing this screen.
        </Banner>
      )}

      {!analytics.isLoading && !analytics.isError && !hasData && (
        <Card padding="lg" radius="hero">
          <EmptyState
            title="Your trends will build here"
            body="Log weight, meals, hydration, heart rate, or a workout to start seeing progress over time."
            to="/log"
            action="Log your first entry"
          />
        </Card>
      )}

      {!analytics.isLoading && !analytics.isError && hasData && (
        <>
          <section aria-labelledby="analytics-overview-heading">
            <SectionHeading
              id="analytics-overview-heading"
              title="At a glance"
              hint="Only entries in the selected range are included."
            />
            <div className="analytics-summary-grid">
              <MetricCard
                label="Weight change"
                value={formatWeightChange(weights.changeKg, unitSystem)}
                detail={weights.latestKg === null ? 'No weight entries' : `${weights.points.length} logged days`}
              />
              <MetricCard
                label="Workouts"
                value={overview.totalWorkouts.toLocaleString()}
                detail={`${roundForDisplay(overview.averageWorkoutsPerWeek, 1)} per week`}
              />
              <MetricCard
                label="Active weeks"
                value={`${overview.activeWeeks}/${overview.totalWeeks}`}
                detail={`${Math.round(overview.activeWeekPercent)}% consistency`}
              />
              <MetricCard
                label="Top workout"
                value={
                  overview.mostFrequentWorkoutType
                    ? workoutTypeLabel(overview.mostFrequentWorkoutType)
                    : '—'
                }
                detail={`${overview.totalWorkoutMinutes.toLocaleString()} structured minutes`}
              />
            </div>
          </section>

          <section aria-labelledby="weight-trend-heading">
            <Card padding="lg" radius="hero">
              <SectionHeading
                id="weight-trend-heading"
                title="Weight trend"
                hint="The softer line is a seven-calendar-day rolling average."
              />
              {weights.points.length > 0 ? (
                <>
                  <div className="analytics-inline-metrics">
                    <InlineMetric
                      label="Latest"
                      value={formatNullableWeight(weights.latestKg, unitSystem)}
                    />
                    <InlineMetric
                      label="Range"
                      value={formatWeightRange(weights.minimumKg, weights.maximumKg, unitSystem)}
                    />
                    <InlineMetric
                      label="Change"
                      value={formatWeightChange(weights.changeKg, unitSystem)}
                    />
                  </div>
                  <AnalyticsLineChart
                    data={weights.points.map((point) => ({
                      day: point.day,
                      weight: weightFromKg(point.weightKg, unitSystem),
                      trend: weightFromKg(point.trendKg, unitSystem),
                    }))}
                    xKey="day"
                    series={[
                      { dataKey: 'weight', label: 'Logged weight', color: 'var(--terracotta)' },
                      { dataKey: 'trend', label: '7-day trend', color: 'var(--sage-deep)' },
                    ]}
                    ariaLabel={`Weight history in ${weightUnit(unitSystem)}. Latest ${formatNullableWeight(weights.latestKg, unitSystem)}.`}
                    valueFormatter={(value) => `${roundForDisplay(value, 1)} ${weightUnit(unitSystem)}`}
                  />
                </>
              ) : (
                <EmptyState
                  title="No weight history in this range"
                  body="A few entries over time will make the trend more useful."
                  to="/log/weight"
                  action="Log weight"
                />
              )}
            </Card>
          </section>

          <section aria-labelledby="training-heading">
            <SectionHeading
              id="training-heading"
              title="Training"
              hint="General exercise logs stay separate from structured workouts to avoid double counting."
            />
            <div className="analytics-two-column">
              <Card padding="lg" radius="hero">
                <SectionHeading
                  title="Workout consistency"
                  hint={`${overview.totalWorkoutMinutes.toLocaleString()} structured minutes total`}
                />
                <AnalyticsBarChart
                  data={weeklyActivity.map((point) => ({
                    day: point.week,
                    workouts: point.workouts,
                  }))}
                  xKey="day"
                  series={[
                    { dataKey: 'workouts', label: 'Workouts', color: 'var(--terracotta)' },
                  ]}
                  ariaLabel={`${overview.totalWorkouts} structured workouts across ${overview.activeWeeks} active weeks.`}
                />
                <PlanAndActivity rows={rows} />
              </Card>

              <Card padding="lg" radius="hero">
                <SectionHeading
                  title="Strength progress"
                  hint="Volume is sets × reps × load. One-rep max is an estimate."
                />
                {strengthOptions.length > 0 ? (
                  <>
                    <ExerciseSelect
                      label="Strength exercise"
                      options={strengthOptions}
                      value={strengthKey}
                      onChange={setStrengthKey}
                    />
                    <div className="analytics-inline-metrics compact">
                      <InlineMetric
                        label="Best load"
                        value={formatNullableWeight(strength.bestWeightKg, unitSystem)}
                      />
                      <InlineMetric
                        label="Est. 1RM"
                        value={formatNullableWeight(
                          strength.bestEstimatedOneRepMaxKg,
                          unitSystem,
                        )}
                      />
                      <InlineMetric
                        label="Volume"
                        value={formatNullableWeight(strength.totalVolumeKg, unitSystem, 0)}
                      />
                    </div>
                    <AnalyticsBarChart
                      data={buildWeeklyStrengthVolume(strength.points).map((point) => ({
                        day: point.week,
                        volume: weightFromKg(point.volumeKg, unitSystem),
                      }))}
                      xKey="day"
                      series={[
                        { dataKey: 'volume', label: 'Weekly volume', color: 'var(--plum)' },
                      ]}
                      ariaLabel={`Weekly strength volume for ${selectedLabel(strengthOptions, strengthKey)}.`}
                      valueFormatter={(value) => `${Math.round(value).toLocaleString()} ${weightUnit(unitSystem)}`}
                    />
                  </>
                ) : (
                  <EmptyState
                    title="No strength sessions in this range"
                    body="Structured strength workouts with load, sets, and reps unlock volume and estimated one-rep-max trends."
                    to="/log/workout"
                    action="Log a workout"
                  />
                )}
              </Card>

              <Card padding="lg" radius="hero">
                <SectionHeading
                  title="Cardio progress"
                  hint="Pace appears only when a session has both time and distance."
                />
                {cardioOptions.length > 0 ? (
                  <>
                    <ExerciseSelect
                      label="Cardio exercise"
                      options={cardioOptions}
                      value={cardioKey}
                      onChange={setCardioKey}
                    />
                    <div className="analytics-inline-metrics compact">
                      <InlineMetric
                        label="Distance"
                        value={formatDistance(cardio.totalDistanceKm, unitSystem)}
                      />
                      <InlineMetric
                        label="Time"
                        value={`${cardio.totalDurationMinutes} min`}
                      />
                      <InlineMetric
                        label="Best pace"
                        value={formatPace(cardio.bestPaceMinutesPerKm, unitSystem)}
                      />
                    </div>
                    <AnalyticsLineChart
                      data={cardio.points.map((point) => ({
                        day: point.day,
                        distance: distanceFromKm(point.distanceKm, unitSystem),
                      }))}
                      xKey="day"
                      series={[
                        { dataKey: 'distance', label: 'Distance', color: 'var(--saffron)' },
                      ]}
                      ariaLabel={`Cardio distance history for ${selectedLabel(cardioOptions, cardioKey)}.`}
                      valueFormatter={(value) => `${roundForDisplay(value, 2)} ${distanceUnit(unitSystem)}`}
                    />
                  </>
                ) : (
                  <EmptyState
                    title="No cardio sessions in this range"
                    body="Time and distance from structured cardio workouts will appear here."
                    to="/log/workout"
                    action="Log cardio"
                  />
                )}
              </Card>
            </div>
          </section>

          <section aria-labelledby="wellness-heading">
            <SectionHeading
              id="wellness-heading"
              title="Wellness logs"
              hint="Averages use logged days only; missing days are not treated as zero."
            />
            <div className="analytics-three-column">
              <WellnessCard
                title="Calories"
                value={
                  wellness.calorieAverage === null
                    ? '—'
                    : `${Math.round(wellness.calorieAverage).toLocaleString()} kcal`
                }
                detail={`Average across ${wellness.calorieLoggedDays} logged days · current goal ${profile.data?.daily_calorie_goal ?? 2000} kcal`}
                rows={rows.filter((row) => row.calorie_entries > 0).map((row) => ({ day: row.day, value: row.calories_logged }))}
                color="var(--terracotta)"
                ariaLabel="Logged calories by day"
                to="/log/calories"
              />
              <WellnessCard
                title="Hydration"
                value={
                  wellness.waterAverageMl === null
                    ? '—'
                    : `${Math.round(wellness.waterAverageMl).toLocaleString()} ml`
                }
                detail={`${wellness.waterGoalDays} of ${wellness.waterLoggedDays} logged days met the current goal`}
                rows={rows.filter((row) => row.water_entries > 0).map((row) => ({ day: row.day, value: row.water_ml }))}
                color="var(--saffron)"
                ariaLabel="Logged hydration by day"
                to="/log/water"
              />
              <WellnessCard
                title="Heart rate"
                value={
                  wellness.heartRateAverage === null
                    ? '—'
                    : `${Math.round(wellness.heartRateAverage)} bpm`
                }
                detail={
                  wellness.heartRateReadings > 0
                    ? `${wellness.heartRateReadings} readings · ${wellness.heartRateMinimum}–${wellness.heartRateMaximum} bpm`
                    : 'No readings in this range'
                }
                rows={rows.filter((row) => row.heart_rate_readings > 0).map((row) => ({ day: row.day, value: row.heart_rate_avg }))}
                color="var(--ember)"
                ariaLabel="Heart-rate readings by day"
                to="/log/heart-rate"
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function AnalyticsLoading() {
  return (
    <div className="analytics-summary-grid" aria-label="Loading analytics">
      {[0, 1, 2, 3].map((key) => (
        <Card key={key} padding="lg">
          <div className="analytics-skeleton" />
          <div className="analytics-skeleton short" />
        </Card>
      ))}
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <Card padding="lg">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
    </Card>
  )
}

function InlineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function SectionHeading({
  id,
  title,
  hint,
}: {
  id?: string
  title: string
  hint?: string
}) {
  return (
    <div className="analytics-section-heading">
      <h2 id={id}>{title}</h2>
      {hint && <p>{hint}</p>}
    </div>
  )
}

function ExerciseSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: ExerciseOption[]
  value: string | null
  onChange: (value: string) => void
}) {
  return (
    <label className="analytics-select">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}{option.machine ? ` · ${option.machine}` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

function WellnessCard({
  title,
  value,
  detail,
  rows,
  color,
  ariaLabel,
  to,
}: {
  title: string
  value: string
  detail: string
  rows: { day: string; value: number | null }[]
  color: string
  ariaLabel: string
  to: string
}) {
  return (
    <Card padding="lg" radius="hero">
      <SectionHeading title={title} />
      <strong className="wellness-value">{value}</strong>
      <p className="wellness-detail">{detail}</p>
      {rows.length > 0 ? (
        <AnalyticsLineChart
          data={rows}
          xKey="day"
          series={[{ dataKey: 'value', label: title, color }]}
          ariaLabel={ariaLabel}
        />
      ) : (
        <p className="analytics-muted">Nothing logged in this range.</p>
      )}
      <Link className="analytics-card-link" to={to}>
        Add a log <span aria-hidden="true">→</span>
      </Link>
    </Card>
  )
}

function PlanAndActivity({ rows }: { rows: AnalyticsDailyRow[] }) {
  const planned = rows.reduce((total, row) => total + row.planned_workouts, 0)
  const completed = rows.reduce((total, row) => total + row.completed_plans, 0)
  const otherMinutes = rows.reduce(
    (total, row) => total + row.exercise_minutes,
    0,
  )

  return (
    <div className="analytics-note-grid">
      <span>
        <strong>{otherMinutes.toLocaleString()} min</strong>
        Other activity
      </span>
      <span>
        <strong>{planned > 0 ? `${completed}/${planned}` : '—'}</strong>
        Planned workouts completed
      </span>
    </div>
  )
}

function EmptyState({
  title,
  body,
  to,
  action,
}: {
  title: string
  body: string
  to: string
  action: string
}) {
  return (
    <div className="analytics-empty">
      <strong>{title}</strong>
      <p>{body}</p>
      <Link to={to}>{action} →</Link>
    </div>
  )
}

function formatNullableWeight(
  kg: number | null,
  unitSystem: UnitSystem,
  decimals = 1,
): string {
  return kg === null ? '—' : formatWeight(kg, unitSystem, decimals)
}

function formatWeightChange(
  kg: number | null,
  unitSystem: UnitSystem,
): string {
  if (kg === null) return '—'
  const value = roundForDisplay(weightFromKg(kg, unitSystem), 1)
  return `${value > 0 ? '+' : ''}${value} ${weightUnit(unitSystem)}`
}

function formatWeightRange(
  minimumKg: number | null,
  maximumKg: number | null,
  unitSystem: UnitSystem,
): string {
  if (minimumKg === null || maximumKg === null) return '—'
  return `${roundForDisplay(weightFromKg(minimumKg, unitSystem), 1)}–${roundForDisplay(weightFromKg(maximumKg, unitSystem), 1)} ${weightUnit(unitSystem)}`
}

function formatPace(
  minutesPerKm: number | null,
  unitSystem: UnitSystem,
): string {
  if (minutesPerKm === null) return '—'
  const pace = unitSystem === 'imperial' ? minutesPerKm / 0.6213711922 : minutesPerKm
  const minutes = Math.floor(pace)
  const seconds = Math.round((pace - minutes) * 60)
  const normalizedMinutes = seconds === 60 ? minutes + 1 : minutes
  const normalizedSeconds = seconds === 60 ? 0 : seconds
  return `${normalizedMinutes}:${String(normalizedSeconds).padStart(2, '0')} /${distanceUnit(unitSystem)}`
}

function selectedLabel(options: ExerciseOption[], key: string | null): string {
  return options.find((option) => option.key === key)?.label ?? 'selected exercise'
}

function hasAnalyticsData(row: AnalyticsDailyRow): boolean {
  return (
    row.weight_kg !== null ||
    row.calorie_entries > 0 ||
    row.water_entries > 0 ||
    row.exercise_entries > 0 ||
    row.workout_count > 0 ||
    row.heart_rate_readings > 0 ||
    row.planned_workouts > 0
  )
}

function formatRange(start: string, end: string): string {
  const format = (day: string) =>
    new Date(`${day}T00:00:00`).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  return `${format(start)} – ${format(end)}`
}

function readStoredRange(): AnalyticsRange {
  const stored = sessionStorage.getItem(RANGE_STORAGE_KEY)
  return stored === '30d' || stored === '90d' || stored === '6m' || stored === '1y'
    ? stored
    : '30d'
}
