import { useMemo, useState } from 'react'
import { Banner } from '../../components/Banner'
import { Card } from '../../components/Card'
import { CapsLabel, Field } from '../../components/Field'
import { PrimaryButton } from '../../components/PrimaryButton'
import { ScreenHeader } from '../../components/ScreenHeader'
import { SegmentedPicker } from '../../components/SegmentedPicker'
import { useUnitSystem } from '../../hooks/useUserProfile'
import { useUpcomingWorkoutPlans } from '../../hooks/useWorkoutPlans'
import {
  useDeleteWorkoutSession,
  useLogWorkoutSession,
  useRecentWorkoutSessions,
} from '../../hooks/useWorkoutSessions'
import type { WorkoutPlanWithExercises, WorkoutType } from '../../types/db'
import { formatWeight, roundForDisplay, weightFromKg, distanceFromKm } from '../../lib/units'
import {
  ExerciseRowsEditor,
  emptyExerciseRow,
  exerciseRowsToDrafts,
  hasContent,
  type ExerciseRow,
} from './ExerciseRowsEditor'
import { WORKOUT_TYPE_OPTIONS, isCardio, workoutTypeLabel } from './constants'
import { describeSessionExercise, sessionVolumeKg } from './format'

export function WorkoutTrackerScreen() {
  const unitSystem = useUnitSystem()
  const sessions = useRecentWorkoutSessions()
  const plans = useUpcomingWorkoutPlans()
  const logSession = useLogWorkoutSession()
  const deleteSession = useDeleteWorkoutSession()

  const [workoutType, setWorkoutType] = useState<WorkoutType>('push')
  const [name, setName] = useState('')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [planId, setPlanId] = useState<string>('')
  const [rows, setRows] = useState<ExerciseRow[]>([emptyExerciseRow()])
  const [error, setError] = useState<string | null>(null)

  const filledRows = rows.filter(hasContent)
  const canSubmit = name.trim().length > 0 && filledRows.length > 0

  // Only plans that haven't been ticked off yet are worth prefilling from.
  const openPlans = useMemo(
    () => (plans.data ?? []).filter((plan) => !plan.completed_at),
    [plans.data],
  )

  function prefillFromPlan(plan: WorkoutPlanWithExercises) {
    setPlanId(plan.id)
    setWorkoutType(plan.workout_type)
    setName(plan.name)
    setRows(
      plan.exercises.length > 0
        ? plan.exercises.map((exercise) => ({
            ...emptyExerciseRow(),
            exercise_name: exercise.exercise_name,
            machine: exercise.machine ?? '',
            sets: exercise.target_sets?.toString() ?? '',
            reps: exercise.target_reps?.toString() ?? '',
            weight:
              exercise.target_weight_kg === null
                ? ''
                : roundForDisplay(
                    weightFromKg(exercise.target_weight_kg, unitSystem),
                  ).toString(),
            duration: exercise.target_duration_minutes?.toString() ?? '',
            distance:
              exercise.target_distance_km === null
                ? ''
                : roundForDisplay(
                    distanceFromKm(exercise.target_distance_km, unitSystem),
                    2,
                  ).toString(),
          }))
        : [emptyExerciseRow()],
    )
  }

  function resetForm() {
    setName('')
    setDuration('')
    setNotes('')
    setPlanId('')
    setRows([emptyExerciseRow()])
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    const durationNum = Math.round(Number(duration))
    try {
      await logSession.mutateAsync({
        name: name.trim(),
        workout_type: workoutType,
        performed_at: new Date().toISOString(),
        duration_minutes:
          duration.trim() && Number.isFinite(durationNum) && durationNum > 0
            ? durationNum
            : null,
        notes: notes.trim() || null,
        plan_id: planId || null,
        exercises: exerciseRowsToDrafts(rows, workoutType, unitSystem),
      })
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the workout.')
    }
  }

  return (
    <div className="screen-stack">
      <ScreenHeader
        title="Workouts"
        subtitle={`${sessions.data?.length ?? 0} recent sessions`}
      />

      {openPlans.length > 0 && (
        <Card padding="md">
          <CapsLabel>Start from a plan</CapsLabel>
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}
          >
            {openPlans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => prefillFromPlan(plan)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  background:
                    planId === plan.id ? 'var(--accent)' : 'var(--cream-dim)',
                  color: planId === plan.id ? 'white' : 'var(--text-secondary)',
                }}
              >
                {plan.name} · {workoutTypeLabel(plan.workout_type)}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card padding="lg" radius="hero" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h2 style={sectionTitle}>Log a workout</h2>
        <form
          onSubmit={onSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 15 }}
        >
          <div>
            <div style={{ marginBottom: 6 }}>
              <CapsLabel>Split</CapsLabel>
            </div>
            <SegmentedPicker
              options={WORKOUT_TYPE_OPTIONS}
              value={workoutType}
              onChange={setWorkoutType}
              ariaLabel="Workout split"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr .6fr', gap: 10 }}>
            <Field
              label="Workout name"
              value={name}
              onChange={setName}
              placeholder={`${workoutTypeLabel(workoutType)} day`}
              autoCapitalize="sentences"
            />
            <Field
              label="Minutes"
              value={duration}
              onChange={setDuration}
              type="number"
              inputMode="numeric"
              placeholder="Optional"
              min="1"
            />
          </div>

          <ExerciseRowsEditor
            rows={rows}
            onChange={setRows}
            workoutType={workoutType}
            unitSystem={unitSystem}
          />

          <Field
            label="Notes"
            value={notes}
            onChange={setNotes}
            placeholder="Felt strong, add 5 next time"
            autoCapitalize="sentences"
          />

          {error && <Banner tone="error">{error}</Banner>}
          <PrimaryButton
            type="submit"
            loading={logSession.isPending}
            disabled={!canSubmit}
          >
            Save workout
          </PrimaryButton>
        </form>
      </Card>

      <Card padding="lg" radius="hero" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h2 style={sectionTitle}>Recent workouts</h2>
        {sessions.isLoading && <p style={muted}>Loading your workouts…</p>}
        {sessions.isError && (
          <Banner tone="error">Could not load your workouts.</Banner>
        )}
        {!sessions.isLoading && !sessions.isError && !sessions.data?.length && (
          <p style={muted}>
            Nothing logged yet. Your first session will show up here.
          </p>
        )}
        {(sessions.data ?? []).map((workout) => {
          const volume = sessionVolumeKg(workout.exercises)
          return (
            <article
              key={workout.id}
              style={{
                padding: '14px 0',
                borderBottom: '1px solid var(--divider)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 17,
                      fontWeight: 600,
                    }}
                  >
                    {workout.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {workoutTypeLabel(workout.workout_type)} ·{' '}
                    {formatDateTime(workout.performed_at)}
                    {workout.duration_minutes
                      ? ` · ${workout.duration_minutes} min`
                      : ''}
                    {!isCardio(workout.workout_type) && volume > 0
                      ? ` · ${formatWeight(volume, unitSystem, 0)} volume`
                      : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteSession.mutate(workout.id)}
                  aria-label={`Delete ${workout.name}`}
                  style={{ color: 'var(--text-tertiary)', padding: 4, fontSize: 12, fontWeight: 600 }}
                >
                  Delete
                </button>
              </div>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '8px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                {workout.exercises.map((exercise) => (
                  <li key={exercise.id} style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--text-primary)' }}>
                      {exercise.exercise_name}
                    </span>
                    <span style={{ color: 'var(--text-tertiary)' }}>
                      {describeSessionExercise(exercise, unitSystem)
                        ? ` — ${describeSessionExercise(exercise, unitSystem)}`
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
              {workout.notes && (
                <p
                  style={{
                    margin: '8px 0 0',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic',
                  }}
                >
                  {workout.notes}
                </p>
              )}
            </article>
          )
        })}
      </Card>
    </div>
  )
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

const sectionTitle: React.CSSProperties = {
  margin: '0 0 16px',
  fontFamily: 'var(--font-display)',
  fontSize: 20,
  fontWeight: 600,
}
const muted: React.CSSProperties = {
  color: 'var(--text-tertiary)',
  fontSize: 13,
  lineHeight: 1.6,
}
