import type { WorkoutType } from '../../types/db'

export const WORKOUT_TYPE_OPTIONS: { value: WorkoutType; label: string }[] = [
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'full_body', label: 'Full body' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'other', label: 'Other' },
]

const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  full_body: 'Full body',
  cardio: 'Cardio',
  other: 'Other',
}

export function workoutTypeLabel(type: WorkoutType): string {
  return WORKOUT_TYPE_LABELS[type]
}

/** Cardio entries record time and distance; everything else records load. */
export function isCardio(type: WorkoutType): boolean {
  return type === 'cardio'
}

/**
 * Suggestions only — the machine field stays free text because no two gyms
 * label their equipment the same way.
 */
export const MACHINE_SUGGESTIONS: Record<WorkoutType, string[]> = {
  push: [
    'Bench press',
    'Incline bench press',
    'Chest press machine',
    'Pec deck',
    'Cable crossover',
    'Shoulder press machine',
    'Overhead press rack',
    'Triceps pushdown cable',
    'Dip station',
  ],
  pull: [
    'Lat pulldown',
    'Seated cable row',
    'Chest-supported row machine',
    'T-bar row',
    'Assisted pull-up machine',
    'Preacher curl bench',
    'Cable curl station',
    'Rear delt fly machine',
    'Deadlift platform',
  ],
  legs: [
    'Leg press',
    'Hack squat',
    'Squat rack',
    'Smith machine',
    'Leg extension',
    'Seated leg curl',
    'Lying leg curl',
    'Hip thrust bench',
    'Standing calf raise',
    'Romanian deadlift platform',
  ],
  full_body: [
    'Squat rack',
    'Smith machine',
    'Cable tower',
    'Dumbbell rack',
    'Kettlebell rack',
    'Trap bar platform',
  ],
  cardio: [
    'Treadmill',
    'Stationary bike',
    'Rowing machine',
    'Elliptical',
    'Stair climber',
    'Assault bike',
    'Ski erg',
    'Outdoors',
  ],
  other: ['Bodyweight', 'Resistance bands', 'Dumbbells', 'Cable tower'],
}

/** Placeholder exercise name that reads sensibly for the selected split. */
export function exercisePlaceholder(type: WorkoutType): string {
  switch (type) {
    case 'push':
      return 'Incline dumbbell press'
    case 'pull':
      return 'Lat pulldown'
    case 'legs':
      return 'Back squat'
    case 'cardio':
      return 'Treadmill intervals'
    case 'full_body':
      return 'Trap bar deadlift'
    default:
      return 'Exercise'
  }
}
