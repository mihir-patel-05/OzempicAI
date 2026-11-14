import { Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { IconButton } from '../../components/IconButton'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
      <datalist id={listId}>
        {MACHINE_SUGGESTIONS[workoutType].map((machine) => (
          <option key={machine} value={machine} />
        ))}
      </datalist>

      {rows.map((row, index) => {
        const n = index + 1
        return (
          <div
            key={row.key}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-sm)',
              minWidth: 0,
              padding: 'var(--space-ms)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-inset)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', minWidth: 0 }}>
              <span
                aria-hidden="true"
                style={{
                  display: 'grid',
                  flex: 'none',
                  width: 26,
                  height: 26,
                  placeItems: 'center',
                  borderRadius: '50%',
                  background: 'var(--card-bg)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                }}
              >
                {n}
              </span>
              <input
                className="field-input"
                aria-label={`Exercise ${n} movement`}
                value={row.exercise_name}
                onChange={(e) => update(row.key, { exercise_name: e.target.value })}
                placeholder={exercisePlaceholder(workoutType)}
                autoCapitalize="sentences"
                autoCorrect="off"
                spellCheck={false}
                style={{ flex: 1, fontWeight: 500 }}
              />
              <IconButton
                icon="close"
                label={`Remove exercise ${n}`}
                onClick={() => remove(row.key)}
                style={{ margin: '0 -6px 0 -4px' }}
              />
            </div>

            <input
              className="field-input"
              aria-label={`Exercise ${n} machine or equipment`}
              value={row.machine}
              onChange={(e) => update(row.key, { machine: e.target.value })}
              placeholder="Machine or equipment"
              list={listId}
              autoCapitalize="sentences"
              autoCorrect="off"
              spellCheck={false}
              style={{ fontSize: 'var(--text-md)' }}
            />

            {cardio ? (
              <div style={twoColumns}>
                <Field
                  label={planning ? 'Target min' : 'Minutes'}
                  value={row.duration}
                  onChange={(v) => update(row.key, { duration: v })}
                  type="number"
                  inputMode="numeric"
                  placeholder="min"
                  min="1"
                />
                <Field
                  label={planning ? `Target ${distanceUnit(unitSystem)}` : `Distance (${distanceUnit(unitSystem)})`}
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
                  label="Reps"
                  value={row.reps}
                  onChange={(v) => update(row.key, { reps: v })}
                  type="number"
                  inputMode="numeric"
                  placeholder="10"
                  min="1"
                />
                <Field
                  label={`Load (${weightUnit(unitSystem)})`}
                  value={row.weight}
                  onChange={(v) => update(row.key, { weight: v })}
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  min="0"
                  step="0.5"
                />
              </div>
            )}
          </div>
        )
      })}

      <button
        type="button"
        className="btn btn-outline"
        onClick={() => onChange([...rows, emptyExerciseRow()])}
        style={{ width: '100%' }}
      >
        <Icon name="plus" size={18} strokeWidth={2.2} /> Add exercise
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
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 'var(--space-sm)',
}

const threeColumns: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 'var(--space-sm)',
}
