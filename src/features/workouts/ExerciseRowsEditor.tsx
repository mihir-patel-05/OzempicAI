import { Field, CapsLabel } from '../../components/Field'
import type {
  UnitSystem,
  WorkoutExerciseDraft,
  WorkoutType,
} from '../../types/db'
import { distanceToKm, distanceUnit, weightToKg, weightUnit } from '../../lib/units'
import {
  MACHINE_SUGGESTIONS,
  exercisePlaceholder,
  isCardio,
} from './constants'

/**
 * A single exercise as the form holds it: strings, because every field is an
 * <input> the user may leave half-filled. Converted to a draft on submit.
 */
export interface ExerciseRow {
  key: string
  exercise_name: string
  machine: string
  sets: string
  reps: string
  weight: string
  duration: string
  distance: string
}

let rowCounter = 0

export function emptyExerciseRow(): ExerciseRow {
  rowCounter += 1
  return {
    key: `row-${rowCounter}`,
    exercise_name: '',
    machine: '',
    sets: '',
    reps: '',
    weight: '',
    duration: '',
    distance: '',
  }
}

/** A row counts once it has an exercise name; everything else is optional. */
export function hasContent(row: ExerciseRow): boolean {
  return row.exercise_name.trim().length > 0
}

/**
 * Form rows → the metric drafts the hooks insert. Weight and distance are
 * converted out of the user's display unit here; strength and cardio columns
 * stay mutually exclusive so a row never claims to be both.
 */
export function exerciseRowsToDrafts(
  rows: ExerciseRow[],
  workoutType: WorkoutType,
  unitSystem: UnitSystem,
): WorkoutExerciseDraft[] {
  const cardio = isCardio(workoutType)
  return rows.filter(hasContent).map((row) => ({
    exercise_name: row.exercise_name.trim(),
    machine: row.machine.trim() || null,
    sets: cardio ? null : positiveInt(row.sets),
    reps: cardio ? null : positiveInt(row.reps),
    weight_kg: cardio
      ? null
      : mapNumber(row.weight, (n) => weightToKg(n, unitSystem), 0),
    duration_minutes: cardio ? positiveInt(row.duration) : null,
    distance_km: cardio
      ? mapNumber(row.distance, (n) => distanceToKm(n, unitSystem))
      : null,
  }))
}

interface ExerciseRowsEditorProps {
  rows: ExerciseRow[]
  onChange: (rows: ExerciseRow[]) => void
  workoutType: WorkoutType
  unitSystem: UnitSystem
  /** "Targets" when planning, plain labels when logging what happened. */
  planning?: boolean
}

export function ExerciseRowsEditor({
  rows,
  onChange,
  workoutType,
  unitSystem,
  planning = false,
}: ExerciseRowsEditorProps) {
  const cardio = isCardio(workoutType)
  const listId = `machines-${workoutType}`

  function update(key: string, patch: Partial<ExerciseRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function remove(key: string) {
    const next = rows.filter((row) => row.key !== key)
    onChange(next.length > 0 ? next : [emptyExerciseRow()])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <datalist id={listId}>
        {MACHINE_SUGGESTIONS[workoutType].map((machine) => (
          <option key={machine} value={machine} />
        ))}
      </datalist>

      {rows.map((row, index) => (
        <div
          key={row.key}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 12,
            borderRadius: 'var(--radius-md)',
            background: 'var(--cream-dim)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <CapsLabel>Exercise {index + 1}</CapsLabel>
            <button
              type="button"
              onClick={() => remove(row.key)}
              aria-label={`Remove exercise ${index + 1}`}
              style={{
                color: 'var(--text-tertiary)',
                fontSize: 12,
                fontWeight: 600,
                padding: '2px 4px',
              }}
            >
              Remove
            </button>
          </div>

          <Field
            label="Movement"
            value={row.exercise_name}
            onChange={(v) => update(row.key, { exercise_name: v })}
            placeholder={exercisePlaceholder(workoutType)}
            autoCapitalize="sentences"
          />
          <Field
            label="Machine / equipment"
            value={row.machine}
            onChange={(v) => update(row.key, { machine: v })}
            placeholder={MACHINE_SUGGESTIONS[workoutType][0]}
            list={listId}
            autoCapitalize="sentences"
          />

          {cardio ? (
            <div style={twoColumns}>
              <Field
                label={planning ? 'Target minutes' : 'Minutes'}
                value={row.duration}
                onChange={(v) => update(row.key, { duration: v })}
                type="number"
                inputMode="numeric"
                placeholder="min"
                min="1"
              />
              <Field
                label={`${planning ? 'Target distance' : 'Distance'} (${distanceUnit(unitSystem)})`}
                value={row.distance}
                onChange={(v) => update(row.key, { distance: v })}
                type="number"
                inputMode="decimal"
                placeholder={distanceUnit(unitSystem)}
                min="0"
                step="0.01"
              />
            </div>
          ) : (
            <div style={threeColumns}>
              <Field
                label="Sets"
                value={row.sets}
                onChange={(v) => update(row.key, { sets: v })}
                type="number"
                inputMode="numeric"
                placeholder="4"
                min="1"
              />
              <Field
                label="Reps / set"
                value={row.reps}
                onChange={(v) => update(row.key, { reps: v })}
                type="number"
                inputMode="numeric"
                placeholder="10"
                min="1"
              />
              <Field
                label={`Weight (${weightUnit(unitSystem)})`}
                value={row.weight}
                onChange={(v) => update(row.key, { weight: v })}
                type="number"
                inputMode="decimal"
                placeholder={weightUnit(unitSystem)}
                min="0"
                step="0.5"
              />
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...rows, emptyExerciseRow()])}
        style={{
          alignSelf: 'flex-start',
          color: 'var(--accent)',
          fontSize: 13,
          fontWeight: 700,
          padding: '4px 0',
        }}
      >
        + Add another exercise
      </button>
    </div>
  )
}

function positiveInt(value: string): number | null {
  const parsed = Number(value)
  if (!value.trim() || !Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed)
}

function mapNumber(
  value: string,
  convert: (n: number) => number,
  min = Number.MIN_VALUE,
): number | null {
  const parsed = Number(value)
  if (!value.trim() || !Number.isFinite(parsed) || parsed < min) return null
  return convert(parsed)
}

const twoColumns: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
}

const threeColumns: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 10,
}
