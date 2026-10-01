import type { MealType, WorkoutType } from '../../types/db'
import type {
  AnalyticsDailyRow,
  AnalyticsExerciseRow,
  AnalyticsMealEntryRow,
  ExerciseOption,
} from './types'

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

/** Minute of day from which a meal counts as late eating (20:00). */
export const LATE_EATING_MINUTE = 20 * 60

/** Approximate energy content of one kilogram of body mass. */
export const KCAL_PER_KG = 7700

/** Minimum days of data before estimating maintenance calories. */
export const MAINTENANCE_MIN_DAYS = 14

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

export interface CaloriePoint {
  day: string
  calories: number
  trend: number
}

export interface CalorieSummary {
  points: CaloriePoint[]
  averageCalories: number | null
  loggedDays: number
  totalDays: number
  daysOnGoal: number
  daysOverGoal: number
  adherencePercent: number | null
  weekdayAverage: number | null
  weekendAverage: number | null
}

export type MealTimingBucket = { hour: number; total: number } & Record<
  MealType,
  number
>

export interface MealTimingSummary {
  buckets: MealTimingBucket[]
  loggedDays: number
  peakHour: number | null
  lateCaloriesPercent: number | null
}

export interface EatingWindowSummary {
  days: number
  averageFirstMinute: number | null
  averageLastMinute: number | null
  averageWindowHours: number | null
}

export interface MealSplitEntry {
  mealType: MealType
  calories: number
  entries: number
  percent: number
  averagePerEntry: number | null
}

export interface EnergyBalanceSummary {
  averageNetCalories: number | null
  averageExerciseCalories: number | null
  maintenance: {
    estimatedCalories: number
    averageIntake: number
    trendChangeKg: number
    spanDays: number
    loggedDays: number
    coveragePercent: number
  } | null
  insufficientReason: string | null
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
  const trend = rollingAverage(
    logged.map(({ day, weightKg }) => ({ day, value: weightKg })),
  )
  const points = logged.map((point, index) => ({
    ...point,
    trendKg: trend[index],
  }))
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

export function buildCalorieSummary(
  rows: AnalyticsDailyRow[],
  goal: number,
): CalorieSummary {
  const logged = rows.filter((row) => row.calorie_entries > 0)
  const trend = rollingAverage(
    logged.map((row) => ({ day: row.day, value: row.calories_logged })),
  )
  const daysOnGoal = logged.filter((row) => row.calories_logged <= goal).length
  const isWeekend = (day: string) => {
    const weekday = dateKeyToUtc(day).getUTCDay()
    return weekday === 0 || weekday === 6
  }

  return {
    points: logged.map((row, index) => ({
      day: row.day,
      calories: row.calories_logged,
      trend: trend[index],
    })),
    averageCalories: average(logged.map((row) => row.calories_logged)),
    loggedDays: logged.length,
    totalDays: rows.length,
    daysOnGoal,
    daysOverGoal: logged.length - daysOnGoal,
    adherencePercent:
      logged.length > 0 ? (daysOnGoal / logged.length) * 100 : null,
    weekdayAverage: average(
      logged.filter((row) => !isWeekend(row.day)).map((row) => row.calories_logged),
    ),
    weekendAverage: average(
      logged.filter((row) => isWeekend(row.day)).map((row) => row.calories_logged),
    ),
  }
}

export function buildMealTiming(
  meals: AnalyticsMealEntryRow[],
): MealTimingSummary {
  const loggedDays = new Set(meals.map((meal) => meal.day)).size
  const buckets: MealTimingBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    total: 0,
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    snack: 0,
  }))

  for (const meal of meals) {
    const bucket = buckets[Math.floor(meal.minute_of_day / 60)]
    bucket[meal.meal_type] += meal.calories
    bucket.total += meal.calories
  }

  if (loggedDays > 0) {
    for (const bucket of buckets) {
      bucket.total /= loggedDays
      for (const mealType of MEAL_TYPES) bucket[mealType] /= loggedDays
    }
  }

  const totalCalories = sum(meals, (meal) => meal.calories)
  const lateCalories = sum(
    meals.filter((meal) => meal.minute_of_day >= LATE_EATING_MINUTE),
    (meal) => meal.calories,
  )
  const peak = buckets.reduce<MealTimingBucket | null>(
    (best, bucket) =>
      bucket.total > 0 && (best === null || bucket.total > best.total)
        ? bucket
        : best,
    null,
  )

  return {
    buckets,
    loggedDays,
    peakHour: peak?.hour ?? null,
    lateCaloriesPercent:
      totalCalories > 0 ? (lateCalories / totalCalories) * 100 : null,
  }
}

export function buildEatingWindow(
  meals: AnalyticsMealEntryRow[],
): EatingWindowSummary {
  const byDay = new Map<string, number[]>()
  for (const meal of meals) {
    const minutes = byDay.get(meal.day)
    if (minutes) minutes.push(meal.minute_of_day)
    else byDay.set(meal.day, [meal.minute_of_day])
  }

  const windows = [...byDay.values()]
    .filter((minutes) => minutes.length >= 2)
    .map((minutes) => ({
      first: Math.min(...minutes),
      last: Math.max(...minutes),
    }))

  const averageFirstMinute = average(windows.map(({ first }) => first))
  const averageLastMinute = average(windows.map(({ last }) => last))
  const averageWindowMinutes = average(
    windows.map(({ first, last }) => last - first),
  )

  return {
    days: windows.length,
    averageFirstMinute,
    averageLastMinute,
    averageWindowHours:
      averageWindowMinutes === null ? null : averageWindowMinutes / 60,
  }
}

export function buildMealSplit(meals: AnalyticsMealEntryRow[]): MealSplitEntry[] {
  const totalCalories = sum(meals, (meal) => meal.calories)

  return MEAL_TYPES.map((mealType) => {
    const matching = meals.filter((meal) => meal.meal_type === mealType)
    const calories = sum(matching, (meal) => meal.calories)
    return {
      mealType,
      calories,
      entries: matching.length,
      percent: totalCalories > 0 ? (calories / totalCalories) * 100 : 0,
      averagePerEntry:
        matching.length > 0 ? calories / matching.length : null,
    }
  })
}

export function buildEnergyBalance(
  rows: AnalyticsDailyRow[],
): EnergyBalanceSummary {
  const calorieDays = rows.filter((row) => row.calorie_entries > 0)
  const summary: EnergyBalanceSummary = {
    averageNetCalories: average(
      calorieDays.map((row) => row.calories_logged - row.exercise_calories),
    ),
    averageExerciseCalories: average(
      calorieDays.map((row) => row.exercise_calories),
    ),
    maintenance: null,
    insufficientReason: null,
  }

  const trend = buildWeightSummary(rows).points
  const first = trend[0]
  const last = trend.at(-1)
  const spanDays =
    first && last
      ? Math.round(
          (dateKeyToUtc(last.day).getTime() - dateKeyToUtc(first.day).getTime()) /
            DAY_MS,
        )
      : 0

  if (spanDays < MAINTENANCE_MIN_DAYS) {
    summary.insufficientReason = `Needs weight entries at least ${MAINTENANCE_MIN_DAYS} days apart.`
    return summary
  }

  const spanCalorieDays = calorieDays.filter(
    (row) => row.day >= first.day && row.day <= last!.day,
  )
  if (spanCalorieDays.length < MAINTENANCE_MIN_DAYS) {
    summary.insufficientReason = `Needs at least ${MAINTENANCE_MIN_DAYS} days of logged calories alongside your weight.`
    return summary
  }

  const averageIntake = average(
    spanCalorieDays.map((row) => row.calories_logged),
  )!
  const trendChangeKg = last!.trendKg - first.trendKg

  summary.maintenance = {
    estimatedCalories:
      averageIntake - (trendChangeKg * KCAL_PER_KG) / spanDays,
    averageIntake,
    trendChangeKg,
    spanDays,
    loggedDays: spanCalorieDays.length,
    coveragePercent: (spanCalorieDays.length / (spanDays + 1)) * 100,
  }
  return summary
}

/** Average of each point and the points in the six calendar days before it. */
function rollingAverage(points: { day: string; value: number }[]): number[] {
  return points.map((point) => {
    const pointTime = dateKeyToUtc(point.day).getTime()
    const windowValues = points
      .filter(({ day }) => {
        const difference = pointTime - dateKeyToUtc(day).getTime()
        return difference >= 0 && difference <= 6 * DAY_MS
      })
      .map(({ value }) => value)
    return average(windowValues) ?? point.value
  })
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
