import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { MealType, WorkoutType } from '../../types/db'
import {
  buildCalorieSummary,
  buildCardioSummary,
  buildEatingWindow,
  buildEnergyBalance,
  buildMealSplit,
  buildMealTiming,
  buildOverview,
  buildStrengthSummary,
  buildWeeklyStrengthVolume,
  buildWeightSummary,
  buildWellnessSummary,
  getExerciseOptions,
} from './transform'
import type {
  AnalyticsDailyRow,
  AnalyticsExerciseRow,
  AnalyticsMealEntryRow,
} from './types'

describe('analytics transforms', () => {
  it('summarizes workout frequency without mixing weeks', () => {
    const rows = [
      daily('2026-09-01', {
        workout_count: 2,
        workout_minutes: 90,
        workout_type_counts: { push: 2 },
      }),
      daily('2026-09-08', {
        workout_count: 1,
        workout_minutes: 45,
        workout_type_counts: { pull: 1 },
      }),
      daily('2026-09-09'),
    ]

    assert.deepEqual(buildOverview(rows), {
      totalWorkouts: 3,
      totalWorkoutMinutes: 135,
      averageWorkoutsPerWeek: 1.5,
      activeWeeks: 2,
      totalWeeks: 2,
      activeWeekPercent: 100,
      mostFrequentWorkoutType: 'push',
    })
  })

  it('calculates a calendar-based seven-day weight trend', () => {
    const summary = buildWeightSummary([
      daily('2026-09-01', { weight_kg: 100 }),
      daily('2026-09-04', { weight_kg: 98 }),
      daily('2026-09-08', { weight_kg: 96 }),
    ])

    assert.equal(summary.firstKg, 100)
    assert.equal(summary.latestKg, 96)
    assert.equal(summary.changeKg, -4)
    assert.equal(summary.minimumKg, 96)
    assert.equal(summary.maximumKg, 100)
    assert.equal(summary.points[1].trendKg, 99)
    assert.equal(summary.points[2].trendKg, 97)
  })

  it('keeps strength exercises distinct and aggregates their metrics', () => {
    const rows = [
      exercise('2026-09-01', 'bench|barbell', 'push', {
        weight_kg: 80,
        volume_kg: 2400,
        estimated_1rm_kg: 100,
      }),
      exercise('2026-09-03', 'bench|barbell', 'push', {
        weight_kg: 85,
        volume_kg: 2550,
        estimated_1rm_kg: 106.25,
      }),
      exercise('2026-09-03', 'bench|machine', 'push', {
        exercise_name: 'Bench',
        machine: 'Machine',
        weight_kg: 100,
        volume_kg: 3000,
      }),
    ]

    assert.equal(getExerciseOptions(rows, 'strength').length, 2)
    const summary = buildStrengthSummary(rows, 'bench|barbell')
    assert.equal(summary.bestWeightKg, 85)
    assert.equal(summary.totalVolumeKg, 4950)
    assert.equal(summary.bestEstimatedOneRepMaxKg, 106.25)
    assert.equal(buildWeeklyStrengthVolume(summary.points)[0].volumeKg, 4950)
  })

  it('computes cardio totals and treats a lower pace as best', () => {
    const rows = [
      exercise('2026-09-01', 'run|outdoors', 'cardio', {
        distance_km: 5,
        duration_minutes: 30,
        pace_minutes_per_km: 6,
      }),
      exercise('2026-09-03', 'run|outdoors', 'cardio', {
        distance_km: 10,
        duration_minutes: 55,
        pace_minutes_per_km: 5.5,
      }),
    ]

    const summary = buildCardioSummary(rows, 'run|outdoors')
    assert.equal(summary.totalDistanceKm, 15)
    assert.equal(summary.totalDurationMinutes, 85)
    assert.equal(summary.longestDistanceKm, 10)
    assert.equal(summary.bestPaceMinutesPerKm, 5.5)
  })

  it('averages wellness values over logged days only', () => {
    const summary = buildWellnessSummary(
      [
        daily('2026-09-01', {
          calories_logged: 1800,
          calorie_entries: 3,
          water_ml: 2500,
          water_entries: 4,
          heart_rate_avg: 70,
          heart_rate_min: 65,
          heart_rate_max: 75,
          heart_rate_readings: 2,
        }),
        daily('2026-09-02'),
        daily('2026-09-03', {
          calories_logged: 2200,
          calorie_entries: 2,
          water_ml: 1500,
          water_entries: 2,
          heart_rate_avg: 80,
          heart_rate_min: 80,
          heart_rate_max: 80,
          heart_rate_readings: 1,
        }),
      ],
      2500,
    )

    assert.equal(summary.calorieAverage, 2000)
    assert.equal(summary.calorieLoggedDays, 2)
    assert.equal(summary.waterAverageMl, 2000)
    assert.equal(summary.waterGoalDays, 1)
    assert.equal(summary.heartRateAverage, 220 / 3)
    assert.equal(summary.heartRateMinimum, 65)
    assert.equal(summary.heartRateMaximum, 80)
  })

  it('summarizes calorie intake against the goal and by weekday', () => {
    const summary = buildCalorieSummary(
      [
        // 2026-09-04 is a Friday, 09-05 Saturday, 09-06 Sunday.
        daily('2026-09-04', { calories_logged: 1800, calorie_entries: 3 }),
        daily('2026-09-05', { calories_logged: 2400, calorie_entries: 2 }),
        daily('2026-09-06', { calories_logged: 2000, calorie_entries: 2 }),
        daily('2026-09-07'),
      ],
      2000,
    )

    assert.equal(summary.loggedDays, 3)
    assert.equal(summary.totalDays, 4)
    assert.equal(summary.averageCalories, 6200 / 3)
    assert.equal(summary.daysOnGoal, 2)
    assert.equal(summary.daysOverGoal, 1)
    assert.equal(summary.adherencePercent, (2 / 3) * 100)
    assert.equal(summary.weekdayAverage, 1800)
    assert.equal(summary.weekendAverage, 2200)
    assert.deepEqual(
      summary.points.map(({ trend }) => trend),
      [1800, 2100, 6200 / 3],
    )
  })

  it('returns empty calorie metrics when nothing is logged', () => {
    const summary = buildCalorieSummary([daily('2026-09-01')], 2000)
    assert.equal(summary.averageCalories, null)
    assert.equal(summary.adherencePercent, null)
    assert.deepEqual(summary.points, [])
  })

  it('buckets meals by local hour and averages per logged day', () => {
    const summary = buildMealTiming([
      meal('2026-09-01', 0, 'snack', 100),
      meal('2026-09-01', 8 * 60 + 15, 'breakfast', 400),
      meal('2026-09-01', 23 * 60 + 59, 'snack', 300),
      meal('2026-09-02', 8 * 60 + 45, 'breakfast', 600),
      meal('2026-09-02', 20 * 60, 'dinner', 600),
    ])

    assert.equal(summary.buckets.length, 24)
    assert.equal(summary.loggedDays, 2)
    assert.equal(summary.buckets[0].snack, 50)
    assert.equal(summary.buckets[8].breakfast, 500)
    assert.equal(summary.buckets[8].total, 500)
    assert.equal(summary.buckets[23].snack, 150)
    assert.equal(summary.peakHour, 8)
    assert.equal(summary.lateCaloriesPercent, (900 / 2000) * 100)
  })

  it('reports no peak or late share without meals', () => {
    const summary = buildMealTiming([])
    assert.equal(summary.peakHour, null)
    assert.equal(summary.lateCaloriesPercent, null)
    assert.ok(summary.buckets.every((bucket) => bucket.total === 0))
  })

  it('measures the eating window only on days with two or more meals', () => {
    const summary = buildEatingWindow([
      meal('2026-09-01', 8 * 60, 'breakfast', 300),
      meal('2026-09-01', 12 * 60, 'lunch', 500),
      meal('2026-09-01', 20 * 60, 'dinner', 700),
      meal('2026-09-02', 9 * 60, 'breakfast', 300),
      meal('2026-09-02', 19 * 60, 'dinner', 600),
      meal('2026-09-03', 13 * 60, 'lunch', 800),
    ])

    assert.equal(summary.days, 2)
    assert.equal(summary.averageFirstMinute, 8.5 * 60)
    assert.equal(summary.averageLastMinute, 19.5 * 60)
    assert.equal(summary.averageWindowHours, 11)

    const single = buildEatingWindow([meal('2026-09-03', 13 * 60, 'lunch', 800)])
    assert.equal(single.days, 0)
    assert.equal(single.averageWindowHours, null)
  })

  it('splits calories by meal type in a fixed order', () => {
    const split = buildMealSplit([
      meal('2026-09-01', 8 * 60, 'breakfast', 300),
      meal('2026-09-01', 12 * 60, 'lunch', 500),
      meal('2026-09-02', 12 * 60, 'lunch', 700),
      meal('2026-09-02', 19 * 60, 'dinner', 500),
    ])

    assert.deepEqual(
      split.map(({ mealType }) => mealType),
      ['breakfast', 'lunch', 'dinner', 'snack'],
    )
    assert.equal(split[1].calories, 1200)
    assert.equal(split[1].averagePerEntry, 600)
    assert.equal(split[1].percent, 60)
    assert.equal(split[3].entries, 0)
    assert.equal(split[3].averagePerEntry, null)
    assert.equal(
      split.reduce((total, entry) => total + entry.percent, 0),
      100,
    )
  })

  it('estimates maintenance calories from intake and the weight trend', () => {
    const rows = Array.from({ length: 15 }, (_, index) => {
      const day = `2026-09-${String(index + 1).padStart(2, '0')}`
      return daily(day, {
        calories_logged: 2000,
        calorie_entries: 3,
        exercise_calories: index === 0 ? 300 : 0,
        weight_kg: index === 0 ? 100 : index === 14 ? 99.5 : null,
      })
    })

    const balance = buildEnergyBalance(rows)
    assert.equal(balance.insufficientReason, null)
    assert.equal(balance.averageNetCalories, 2000 - 300 / 15)
    assert.equal(balance.maintenance?.spanDays, 14)
    assert.equal(balance.maintenance?.loggedDays, 15)
    assert.equal(balance.maintenance?.coveragePercent, 100)
    assert.equal(balance.maintenance?.trendChangeKg, -0.5)
    assert.equal(balance.maintenance?.estimatedCalories, 2275)
  })

  it('withholds the maintenance estimate when data is too thin', () => {
    const shortSpan = buildEnergyBalance([
      daily('2026-09-01', { weight_kg: 100, calories_logged: 2000, calorie_entries: 1 }),
      daily('2026-09-10', { weight_kg: 99, calories_logged: 2000, calorie_entries: 1 }),
    ])
    assert.equal(shortSpan.maintenance, null)
    assert.match(shortSpan.insufficientReason ?? '', /weight entries/)
    assert.equal(shortSpan.averageNetCalories, 2000)

    const fewCalorieDays = buildEnergyBalance([
      daily('2026-09-01', { weight_kg: 100, calories_logged: 2000, calorie_entries: 1 }),
      daily('2026-09-20', { weight_kg: 99 }),
    ])
    assert.equal(fewCalorieDays.maintenance, null)
    assert.match(fewCalorieDays.insufficientReason ?? '', /logged calories/)
  })
})

function daily(
  day: string,
  overrides: Partial<AnalyticsDailyRow> = {},
): AnalyticsDailyRow {
  return {
    day,
    weight_kg: null,
    calories_logged: 0,
    calorie_entries: 0,
    water_ml: 0,
    water_entries: 0,
    exercise_minutes: 0,
    exercise_calories: 0,
    exercise_entries: 0,
    workout_count: 0,
    workout_minutes: 0,
    strength_volume_kg: 0,
    cardio_minutes: 0,
    cardio_distance_km: 0,
    heart_rate_avg: null,
    heart_rate_min: null,
    heart_rate_max: null,
    heart_rate_readings: 0,
    planned_workouts: 0,
    completed_plans: 0,
    workout_type_counts: {},
    ...overrides,
  }
}

function exercise(
  performedOn: string,
  key: string,
  workoutType: WorkoutType,
  overrides: Partial<AnalyticsExerciseRow> = {},
): AnalyticsExerciseRow {
  return {
    performed_on: performedOn,
    session_id: `${performedOn}-${key}`,
    workout_type: workoutType,
    exercise_key: key,
    exercise_name: key.split('|')[0],
    machine: key.split('|')[1] || null,
    sets: null,
    reps_per_set: null,
    weight_kg: null,
    volume_kg: null,
    estimated_1rm_kg: null,
    duration_minutes: null,
    distance_km: null,
    pace_minutes_per_km: null,
    ...overrides,
  }
}

function meal(
  day: string,
  minuteOfDay: number,
  mealType: MealType,
  calories: number,
): AnalyticsMealEntryRow {
  return {
    day,
    minute_of_day: minuteOfDay,
    iso_dow: ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1,
    meal_type: mealType,
    calories,
  }
}
