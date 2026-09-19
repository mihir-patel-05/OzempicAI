import type {
  UnitSystem,
  WorkoutPlanExercise,
  WorkoutSessionExercise,
} from '../../types/db'
import { formatDistance, formatWeight } from '../../lib/units'

/** "Leg press · 4 × 10 · 120 kg" — the one-line meta under an exercise name. */
export function describeSessionExercise(
  exercise: WorkoutSessionExercise,
  unitSystem: UnitSystem,
): string {
  return joinParts([
    exercise.machine,
    setsAndReps(exercise.sets, exercise.reps_per_set),
    exercise.weight_kg === null
      ? null
      : formatWeight(exercise.weight_kg, unitSystem),
    exercise.duration_minutes === null ? null : `${exercise.duration_minutes} min`,
    exercise.distance_km === null
      ? null
      : formatDistance(exercise.distance_km, unitSystem),
  ])
}

/** Same shape as above, for the target columns on a planned exercise. */
export function describePlanExercise(
  exercise: WorkoutPlanExercise,
  unitSystem: UnitSystem,
): string {
  return joinParts([
    exercise.machine,
    setsAndReps(exercise.target_sets, exercise.target_reps),
    exercise.target_weight_kg === null
      ? null
      : formatWeight(exercise.target_weight_kg, unitSystem),
    exercise.target_duration_minutes === null
      ? null
      : `${exercise.target_duration_minutes} min`,
    exercise.target_distance_km === null
      ? null
      : formatDistance(exercise.target_distance_km, unitSystem),
  ])
}

/** Total reps × load, the closest thing to a "how hard was that" number. */
export function sessionVolumeKg(exercises: WorkoutSessionExercise[]): number {
  return exercises.reduce((total, exercise) => {
    if (!exercise.sets || !exercise.reps_per_set || !exercise.weight_kg) {
      return total
    }
    return total + exercise.sets * exercise.reps_per_set * exercise.weight_kg
  }, 0)
}

function setsAndReps(sets: number | null, reps: number | null): string | null {
  if (sets && reps) return `${sets} × ${reps}`
  if (sets) return `${sets} ${sets === 1 ? 'set' : 'sets'}`
  if (reps) return `${reps} reps`
  return null
}

function joinParts(parts: (string | null)[]): string {
  return parts.filter((part): part is string => !!part).join(' · ')
}
