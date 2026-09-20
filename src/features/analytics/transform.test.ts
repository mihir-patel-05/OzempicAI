import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { WorkoutType } from '../../types/db'
import {
  buildCardioSummary,
  buildOverview,
  buildStrengthSummary,
  buildWeeklyStrengthVolume,
  buildWeightSummary,
  buildWellnessSummary,
  getExerciseOptions,
} from './transform'
import type { AnalyticsDailyRow, AnalyticsExerciseRow } from './types'

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

