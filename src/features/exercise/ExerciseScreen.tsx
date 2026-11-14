import { useState } from 'react'
import { Card } from '../../components/Card'
import { Field, CapsLabel } from '../../components/Field'
import { PrimaryButton } from '../../components/PrimaryButton'
import { Banner } from '../../components/Banner'
import { SegmentedPicker } from '../../components/SegmentedPicker'
import { Icon } from '../../components/Icon'
import { IconButton } from '../../components/IconButton'
import { PageHeader, SectionHeader } from '../../components/PageHeader'
import {
  useDeleteExerciseLog,
  useExerciseLogsToday,
  useLogExercise,
} from '../../hooks/useExerciseLogs'
import { useUnitSystem } from '../../hooks/useUserProfile'
import { formatWeight, weightToKg } from '../../lib/units'
import type { BodyPart, ExerciseCategory } from '../../types/db'

type WeightInputUnit = 'kg' | 'lb'

const CATEGORY_OPTIONS: { value: ExerciseCategory; label: string }[] = [
  { value: 'cardio', label: 'Cardio' },
  { value: 'strength', label: 'Strength' },
  { value: 'flexibility', label: 'Flex' },
  { value: 'sports', label: 'Sports' },
  { value: 'other', label: 'Other' },
]

const BODY_PARTS: BodyPart[] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'core',
  'full_body',
]

export function ExerciseScreen() {
  const unitSystem = useUnitSystem()
  const logs = useExerciseLogsToday()
  const logExercise = useLogExercise()
  const deleteLog = useDeleteExerciseLog()

  const [name, setName] = useState('')
  const [category, setCategory] = useState<ExerciseCategory>('cardio')
  const [duration, setDuration] = useState('')
  const [caloriesBurned, setCaloriesBurned] = useState('')
  const [sets, setSets] = useState('')
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [selectedWeightUnit, setSelectedWeightUnit] =
    useState<WeightInputUnit | null>(null)
  const [bodyPart, setBodyPart] = useState<BodyPart | ''>('')
  const [error, setError] = useState<string | null>(null)

  const weightUnit =
    selectedWeightUnit ?? (unitSystem === 'imperial' ? 'lb' : 'kg')

  const durationNum = Number(duration)
  const caloriesNum = Number(caloriesBurned)
  const hasSets = sets.trim().length > 0
  const hasReps = reps.trim().length > 0
  const hasWeight = weight.trim().length > 0
  const setsNum = Number(sets)
  const repsNum = Number(reps)
  const weightNum = Number(weight)
  const strengthFieldsValid =
    category !== 'strength' ||
    ((!hasSets || (Number.isFinite(setsNum) && setsNum > 0)) &&
      (!hasReps || (Number.isFinite(repsNum) && repsNum > 0)) &&
      (!hasWeight || (Number.isFinite(weightNum) && weightNum >= 0)))
  const canSubmit =
    name.trim().length > 0 &&
    Number.isFinite(durationNum) &&
    durationNum > 0 &&
    Number.isFinite(caloriesNum) &&
    caloriesNum >= 0 &&
    strengthFieldsValid

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    try {
      await logExercise.mutateAsync({
        exercise_name: name.trim(),
        category,
        duration_minutes: Math.round(durationNum),
        calories_burned: Math.round(caloriesNum),
        sets: category === 'strength' && hasSets ? Math.round(setsNum) : null,
        reps_per_set:
          category === 'strength' && hasReps ? Math.round(repsNum) : null,
        weight_kg:
          category === 'strength' && hasWeight
            ? weightToKg(
                weightNum,
                weightUnit === 'lb' ? 'imperial' : 'metric',
              )
            : null,
        body_part: category === 'strength' && bodyPart ? bodyPart : null,
      })
      setName('')
      setDuration('')
      setCaloriesBurned('')
      setSets('')
      setReps('')
      setWeight('')
      setBodyPart('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log exercise.')
    }
  }

  const todayRows = logs.data ?? []
  const todayMinutes = todayRows.reduce((acc, r) => acc + r.duration_minutes, 0)
  const todayKcal = todayRows.reduce((acc, r) => acc + r.calories_burned, 0)

  return (
    <div className="screen-stack">
      <PageHeader
        title="Exercise"
        back="/log"
        backLabel="Log"
        subtitle={
          logs.isLoading
            ? 'Loading today…'
            : todayRows.length === 0
              ? 'Nothing logged today yet'
              : `Today: ${todayMinutes} min · ${todayKcal.toLocaleString()} kcal burned`
        }
      />

      <Card padding="lg">
        <form
          onSubmit={onSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
        >
          <Field
            label="Exercise"
            value={name}
            onChange={setName}
            placeholder="Morning run"
            autoCapitalize="sentences"
          />
          <div>
            <div style={{ marginBottom: 6 }}>
              <CapsLabel>Category</CapsLabel>
            </div>
            <SegmentedPicker
              options={CATEGORY_OPTIONS}
              value={category}
              onChange={setCategory}
              ariaLabel="Category"
            />
          </div>
          <div style={twoColumns}>
            <Field
              label="Minutes"
              value={duration}
              onChange={setDuration}
              type="number"
              inputMode="numeric"
              placeholder="min"
            />
            <Field
              label="Calories"
              value={caloriesBurned}
              onChange={setCaloriesBurned}
              type="number"
              inputMode="numeric"
              placeholder="kcal"
            />
          </div>

          {category === 'strength' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-ms)',
                padding: 'var(--space-ms)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--surface-inset)',
              }}
            >
              <p className="eyebrow">Strength details · optional</p>
              <div style={threeColumns}>
                <Field
                  label="Sets"
                  value={sets}
                  onChange={setSets}
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                />
                <Field
                  label="Reps / set"
                  value={reps}
                  onChange={setReps}
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                />
                <label htmlFor="exercise-weight" style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <CapsLabel>Weight</CapsLabel>
                  <span style={{ display: 'flex', minWidth: 0 }}>
                    <input
                      id="exercise-weight"
                      className="field-input"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      type="number"
                      inputMode="decimal"
                      placeholder="—"
                      min="0"
                      step="0.5"
                      style={{ flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                    />
                    <select
                      className="field-input"
                      value={weightUnit}
                      onChange={(e) =>
                        setSelectedWeightUnit(e.target.value as WeightInputUnit)
                      }
                      aria-label="Weight unit"
                      style={{
                        flex: 'none',
                        width: 'auto',
                        marginLeft: -1,
                        padding: '0 6px',
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <option value="lb">lbs</option>
                      <option value="kg">kg</option>
                    </select>
                  </span>
                </label>
              </div>
              <div>
                <CapsLabel>Body part</CapsLabel>
                <div className="chip-row" style={{ marginTop: 'var(--space-sm)' }}>
                  {BODY_PARTS.map((part) => {
                    const selected = bodyPart === part
                    return (
                      <button
                        key={part}
                        type="button"
                        className="chip chip-toggle"
                        aria-pressed={selected}
                        onClick={() => setBodyPart(selected ? '' : part)}
                      >
                        {labelForBodyPart(part)}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {error && <Banner tone="error">{error}</Banner>}
          <PrimaryButton
            type="submit"
            loading={logExercise.isPending}
            disabled={!canSubmit}
          >
            Log exercise
          </PrimaryButton>
        </form>
      </Card>

      <Card padding="lg">
        <SectionHeader
          title="Today"
          meta={
            todayRows.length
              ? `${todayRows.length} ${todayRows.length === 1 ? 'entry' : 'entries'}`
              : undefined
          }
        />
        {logs.isLoading && <p className="empty-note">Loading…</p>}
        {!logs.isLoading && todayRows.length === 0 && (
          <p className="empty-note">No exercise logged yet today.</p>
        )}
        <ul className="row-list">
          {todayRows.map((row) => {
            const meta = [
              labelForCategory(row.category),
              formatTime(row.logged_at),
              `${row.calories_burned} kcal`,
              row.sets && row.reps_per_set ? `${row.sets}×${row.reps_per_set}` : null,
              row.weight_kg !== null ? formatWeight(row.weight_kg, unitSystem) : null,
              row.body_part ? labelForBodyPart(row.body_part) : null,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={row.id}>
                <span
                  className="tile-icon"
                  style={{ ['--tone' as string]: 'var(--ember)', width: 36, height: 36, borderRadius: 11 }}
                >
                  <Icon name={row.category === 'strength' ? 'dumbbell' : 'run'} size={18} />
                </span>
                <div className="row-main">
                  <div className="row-title">{row.exercise_name}</div>
                  <div className="row-meta">{meta}</div>
                </div>
                <span className="row-value">{row.duration_minutes} min</span>
                <IconButton
                  icon="trash"
                  tone="danger"
                  label={`Delete ${row.exercise_name}, ${formatTime(row.logged_at)}`}
                  onClick={() => deleteLog.mutate(row.id)}
                  style={{ marginRight: -8 }}
                />
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}

const twoColumns: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 'var(--space-sm)',
}

const threeColumns: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr)',
  gap: 'var(--space-sm)',
}

function labelForCategory(category: ExerciseCategory): string {
  return category[0].toUpperCase() + category.slice(1)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function labelForBodyPart(part: BodyPart): string {
  return part === 'full_body' ? 'Full body' : part[0].toUpperCase() + part.slice(1)
}
