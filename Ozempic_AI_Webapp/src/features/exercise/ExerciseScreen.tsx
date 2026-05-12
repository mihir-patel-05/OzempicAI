import { useState } from 'react'
import { Card } from '../../components/Card'
import { Field, CapsLabel } from '../../components/Field'
import { PrimaryButton } from '../../components/PrimaryButton'
import { Banner } from '../../components/Banner'
import { SegmentedPicker } from '../../components/SegmentedPicker'
import { ScreenHeader } from '../../components/ScreenHeader'
import {
  useDeleteExerciseLog,
  useExerciseLogsToday,
  useLogExercise,
} from '../../hooks/useExerciseLogs'
import type { BodyPart, ExerciseCategory } from '../../types/db'

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
  const logs = useExerciseLogsToday()
  const logExercise = useLogExercise()
  const deleteLog = useDeleteExerciseLog()

  const [name, setName] = useState('')
  const [category, setCategory] = useState<ExerciseCategory>('cardio')
  const [duration, setDuration] = useState('')
  const [caloriesBurned, setCaloriesBurned] = useState('')
  const [sets, setSets] = useState('')
  const [reps, setReps] = useState('')
  const [bodyPart, setBodyPart] = useState<BodyPart | ''>('')
  const [error, setError] = useState<string | null>(null)

  const durationNum = Number(duration)
  const caloriesNum = Number(caloriesBurned)
  const canSubmit =
    name.trim().length > 0 &&
    Number.isFinite(durationNum) &&
    durationNum > 0 &&
    Number.isFinite(caloriesNum) &&
    caloriesNum >= 0

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
        sets: category === 'strength' && sets ? Math.round(Number(sets)) : null,
        reps_per_set:
          category === 'strength' && reps ? Math.round(Number(reps)) : null,
        body_part: category === 'strength' && bodyPart ? bodyPart : null,
      })
      setName('')
      setDuration('')
      setCaloriesBurned('')
      setSets('')
      setReps('')
      setBodyPart('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log exercise.')
    }
  }

  const todayMinutes = (logs.data ?? []).reduce(
    (acc, r) => acc + r.duration_minutes,
    0,
  )

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
    >
      <ScreenHeader
        title="Exercise"
        subtitle={`${todayMinutes} minutes today`}
      />

      <Card padding="md">
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
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-sm)',
            }}
          >
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
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-sm)',
                }}
              >
                <Field
                  label="Sets"
                  value={sets}
                  onChange={setSets}
                  type="number"
                  inputMode="numeric"
                  placeholder="optional"
                />
                <Field
                  label="Reps / set"
                  value={reps}
                  onChange={setReps}
                  type="number"
                  inputMode="numeric"
                  placeholder="optional"
                />
              </div>
              <div>
                <div style={{ marginBottom: 6 }}>
                  <CapsLabel>Body part (optional)</CapsLabel>
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}
                >
                  {BODY_PARTS.map((part) => {
                    const selected = bodyPart === part
                    return (
                      <button
                        key={part}
                        type="button"
                        onClick={() => setBodyPart(selected ? '' : part)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          background: selected ? 'var(--accent)' : 'var(--cream-dim)',
                          color: selected ? 'white' : 'var(--text-secondary)',
                        }}
                      >
                        {labelForBodyPart(part)}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
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

      <Card padding="md">
        {logs.isLoading && (
          <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 13 }}>
            Loading…
          </p>
        )}
        {!logs.isLoading && (logs.data?.length ?? 0) === 0 && (
          <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 13 }}>
            No exercise logged yet today.
          </p>
        )}
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {(logs.data ?? []).map((row) => (
            <li
              key={row.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid var(--divider)',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, color: 'var(--text-primary)' }}>
                  {row.exercise_name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {row.category} · {row.duration_minutes} min · {row.calories_burned} kcal
                  {row.sets && row.reps_per_set
                    ? ` · ${row.sets}×${row.reps_per_set}`
                    : ''}
                  {row.body_part ? ` · ${labelForBodyPart(row.body_part)}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteLog.mutate(row.id)}
                aria-label="Delete entry"
                style={{ color: 'var(--text-tertiary)', padding: 8 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function labelForBodyPart(part: BodyPart): string {
  return part === 'full_body' ? 'Full body' : part[0].toUpperCase() + part.slice(1)
}
