import type { WorkoutType } from '../../types/db'
import type {
  AnalyticsDailyRow,
  AnalyticsExerciseRow,
  ExerciseOption,
} from './types'

export interface OverviewSummary {
  totalWorkouts: number
  totalWorkoutMinutes: number
  averageWorkoutsPerWeek: number
  activeWeeks: number
  totalWeeks: number
  activeWeekPercent: number
  mostFrequentWorkoutType: WorkoutType | null
}

export interface WeightPoint {
  day: string
  weightKg: number
  trendKg: number
}

export interface WeightSummary {
  points: WeightPoint[]
  firstKg: number | null
  latestKg: number | null
  changeKg: number | null
  minimumKg: number | null
  maximumKg: number | null
}

export interface StrengthPoint {
  day: string
  bestWeightKg: number | null
  volumeKg: number
  estimatedOneRepMaxKg: number | null
}

export interface StrengthSummary {
  points: StrengthPoint[]
  bestWeightKg: number | null
  totalVolumeKg: number
  bestEstimatedOneRepMaxKg: number | null
}

export interface CardioPoint {
  day: string
  distanceKm: number
  durationMinutes: number
  bestPaceMinutesPerKm: number | null
}

export interface CardioSummary {
  points: CardioPoint[]
  totalDistanceKm: number
  totalDurationMinutes: number
  longestDistanceKm: number
  bestPaceMinutesPerKm: number | null
}

export interface WellnessSummary {
  calorieAverage: number | null
  calorieLoggedDays: number
  waterAverageMl: number | null
  waterLoggedDays: number
  waterGoalDays: number
  heartRateAverage: number | null
  heartRateMinimum: number | null
  heartRateMaximum: number | null
  heartRateReadings: number
}

export interface WeeklyActivityPoint {
  week: string
  workouts: number
  workoutMinutes: number
}

export interface WeeklyVolumePoint {
  week: string
  volumeKg: number
}

export function buildOverview(rows: AnalyticsDailyRow[]): OverviewSummary {
  const totalWorkouts = sum(rows, (row) => row.workout_count)
  const totalWorkoutMinutes = sum(rows, (row) => row.workout_minutes)
  const weeks = new Set(rows.map((row) => weekKey(row.day)))
  const activeWeeks = new Set(
    rows.filter((row) => row.workout_count > 0).map((row) => weekKey(row.day)),
  )
  const workoutTypeTotals = new Map<WorkoutType, number>()

  for (const row of rows) {
    for (const [type, count] of Object.entries(row.workout_type_counts)) {
      const workoutType = type as WorkoutType
      workoutTypeTotals.set(
        workoutType,
        (workoutTypeTotals.get(workoutType) ?? 0) + count,
      )
    }
  }

  const mostFrequentWorkoutType = [...workoutTypeTotals.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0] ?? null
  const totalWeeks = weeks.size

  return {
    totalWorkouts,
    totalWorkoutMinutes,
    averageWorkoutsPerWeek: totalWeeks > 0 ? totalWorkouts / totalWeeks : 0,
    activeWeeks: activeWeeks.size,
    totalWeeks,
    activeWeekPercent:
      totalWeeks > 0 ? (activeWeeks.size / totalWeeks) * 100 : 0,
    mostFrequentWorkoutType,
  }
}

export function buildWeightSummary(rows: AnalyticsDailyRow[]): WeightSummary {
  const logged = rows.flatMap((row) =>
    row.weight_kg === null ? [] : [{ day: row.day, weightKg: row.weight_kg }],
  )
  const points = logged.map((point) => {
    const pointTime = dateKeyToUtc(point.day).getTime()
    const windowValues = logged
      .filter(({ day }) => {
        const difference = pointTime - dateKeyToUtc(day).getTime()
        return difference >= 0 && difference <= 6 * DAY_MS
      })
      .map(({ weightKg }) => weightKg)

    return {
      ...point,
      trendKg: average(windowValues) ?? point.weightKg,
    }
  })
  const weights = logged.map(({ weightKg }) => weightKg)
  const firstKg = weights[0] ?? null
  const latestKg = weights.at(-1) ?? null

  return {
    points,
    firstKg,
    latestKg,
    changeKg:
      firstKg === null || latestKg === null ? null : latestKg - firstKg,
    minimumKg: weights.length > 0 ? Math.min(...weights) : null,
    maximumKg: weights.length > 0 ? Math.max(...weights) : null,
  }
}

export function buildWeeklyActivity(
  rows: AnalyticsDailyRow[],
): WeeklyActivityPoint[] {
  const grouped = new Map<string, WeeklyActivityPoint>()
  for (const row of rows) {
    const key = weekKey(row.day)
    const current = grouped.get(key) ?? {
      week: key,
      workouts: 0,
      workoutMinutes: 0,
    }
    current.workouts += row.workout_count
    current.workoutMinutes += row.workout_minutes
    grouped.set(key, current)
  }
  return [...grouped.values()]
}

export function getExerciseOptions(
  rows: AnalyticsExerciseRow[],
  kind: 'strength' | 'cardio',
): ExerciseOption[] {
  const options = new Map<string, ExerciseOption>()

  for (const row of rows) {
    const isCardio = row.workout_type === 'cardio'
    if ((kind === 'cardio') !== isCardio) continue
    options.set(row.exercise_key, {
      key: row.exercise_key,
      label: row.exercise_name,
      machine: row.machine,
    })
  }

  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export function buildStrengthSummary(
  rows: AnalyticsExerciseRow[],
  exerciseKey: string | null,
): StrengthSummary {
  const matching = rows.filter(
    (row) => row.exercise_key === exerciseKey && row.workout_type !== 'cardio',
  )
  const byDay = groupByDay(matching)
  const points = [...byDay.entries()].map(([day, entries]) => ({
    day,
    bestWeightKg: maximum(entries.map((row) => row.weight_kg)),
    volumeKg: sum(entries, (row) => row.volume_kg ?? 0),
    estimatedOneRepMaxKg: maximum(
      entries.map((row) => row.estimated_1rm_kg),
    ),
  }))

  return {
    points,
    bestWeightKg: maximum(matching.map((row) => row.weight_kg)),
    totalVolumeKg: sum(matching, (row) => row.volume_kg ?? 0),
    bestEstimatedOneRepMaxKg: maximum(
      matching.map((row) => row.estimated_1rm_kg),
    ),
  }
}

export function buildWeeklyStrengthVolume(
  points: StrengthPoint[],
): WeeklyVolumePoint[] {
  const grouped = new Map<string, WeeklyVolumePoint>()
  for (const point of points) {
    const key = weekKey(point.day)
    const current = grouped.get(key) ?? { week: key, volumeKg: 0 }
    current.volumeKg += point.volumeKg
    grouped.set(key, current)
  }
  return [...grouped.values()]
}

export function buildCardioSummary(
  rows: AnalyticsExerciseRow[],
  exerciseKey: string | null,
): CardioSummary {
  const matching = rows.filter(
    (row) => row.exercise_key === exerciseKey && row.workout_type === 'cardio',
  )
  const byDay = groupByDay(matching)
  const points = [...byDay.entries()].map(([day, entries]) => ({
    day,
    distanceKm: sum(entries, (row) => row.distance_km ?? 0),
    durationMinutes: sum(entries, (row) => row.duration_minutes ?? 0),
    bestPaceMinutesPerKm: minimum(
      entries.map((row) => row.pace_minutes_per_km),
    ),
  }))

  return {
    points,
    totalDistanceKm: sum(matching, (row) => row.distance_km ?? 0),
    totalDurationMinutes: sum(
      matching,
      (row) => row.duration_minutes ?? 0,
    ),
    longestDistanceKm: maximum(matching.map((row) => row.distance_km)) ?? 0,
    bestPaceMinutesPerKm: minimum(
      matching.map((row) => row.pace_minutes_per_km),
    ),
  }
}

export function buildWellnessSummary(
  rows: AnalyticsDailyRow[],
  waterGoalMl: number,
): WellnessSummary {
  const calorieDays = rows.filter((row) => row.calorie_entries > 0)
  const waterDays = rows.filter((row) => row.water_entries > 0)
  const heartRateDays = rows.filter((row) => row.heart_rate_readings > 0)
  const heartRateReadings = sum(
    heartRateDays,
    (row) => row.heart_rate_readings,
  )
  const weightedHeartRate = sum(
    heartRateDays,
    (row) => (row.heart_rate_avg ?? 0) * row.heart_rate_readings,
  )

  return {
    calorieAverage: average(calorieDays.map((row) => row.calories_logged)),
    calorieLoggedDays: calorieDays.length,
    waterAverageMl: average(waterDays.map((row) => row.water_ml)),
    waterLoggedDays: waterDays.length,
    waterGoalDays: waterDays.filter((row) => row.water_ml >= waterGoalMl).length,
    heartRateAverage:
      heartRateReadings > 0 ? weightedHeartRate / heartRateReadings : null,
    heartRateMinimum: minimum(rows.map((row) => row.heart_rate_min)),
    heartRateMaximum: maximum(rows.map((row) => row.heart_rate_max)),
    heartRateReadings,
  }
}

function groupByDay(
  rows: AnalyticsExerciseRow[],
): Map<string, AnalyticsExerciseRow[]> {
  const grouped = new Map<string, AnalyticsExerciseRow[]>()
  for (const row of rows) {
    const bucket = grouped.get(row.performed_on)
    if (bucket) bucket.push(row)
    else grouped.set(row.performed_on, [row])
  }
  return grouped
}

function weekKey(day: string): string {
  const date = dateKeyToUtc(day)
  const weekday = date.getUTCDay()
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1
  date.setUTCDate(date.getUTCDate() - daysFromMonday)
  return date.toISOString().slice(0, 10)
}

function dateKeyToUtc(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}

function sum<T>(values: T[], select: (value: T) => number): number {
  return values.reduce((total, value) => total + select(value), 0)
}

function average(values: number[]): number | null {
  return values.length > 0
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null
}

function maximum(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null)
  return present.length > 0 ? Math.max(...present) : null
}

function minimum(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => value !== null)
  return present.length > 0 ? Math.min(...present) : null
}

const DAY_MS = 24 * 60 * 60 * 1000
