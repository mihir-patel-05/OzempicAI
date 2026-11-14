import { useMemo, useState } from 'react'
import { Banner } from '../../components/Banner'
import { Card } from '../../components/Card'
import { CapsLabel, Field } from '../../components/Field'
import { PrimaryButton } from '../../components/PrimaryButton'
import { Icon } from '../../components/Icon'
import { IconButton } from '../../components/IconButton'
import { PageHeader, SectionHeader } from '../../components/PageHeader'
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

  const sessionCount = sessions.data?.length ?? 0

  return (
    <div className="screen-stack">
      <PageHeader
        title="Workouts"
        back="/log"
        backLabel="Log"
        subtitle={
          sessions.isLoading
            ? 'Loading your sessions…'
            : sessionCount === 0
              ? 'No sessions logged yet'
              : `${sessionCount} recent ${sessionCount === 1 ? 'session' : 'sessions'} · last ${formatShortDate(sessions.data![0].performed_at)}`
        }
      />

      <Card padding="lg">
        <SectionHeader title="Log a workout" />
        <form
          onSubmit={onSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
        >
          {openPlans.length > 0 && (
            <div>
              <CapsLabel>Start from a plan</CapsLabel>
              <div className="chip-row" style={{ marginTop: 'var(--space-sm)' }}>
                {openPlans.map((plan) => {
                  const selected = planId === plan.id
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      className="chip"
                      aria-pressed={selected}
                      onClick={() => prefillFromPlan(plan)}
                    >
                      {selected && <Icon name="check" size={14} strokeWidth={2.4} />}
                      {plan.name} · {workoutTypeLabel(plan.workout_type)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

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

          <Field
            label="Workout name"
            value={name}
            onChange={setName}
            placeholder={`${workoutTypeLabel(workoutType)} day`}
            autoCapitalize="sentences"
          />

          <ExerciseRowsEditor
            rows={rows}
            onChange={setRows}
            workoutType={workoutType}
            unitSystem={unitSystem}
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2.4fr)',
              gap: 'var(--space-sm)',
            }}
          >
            <Field
              label="Minutes"
              value={duration}
              onChange={setDuration}
              type="number"
              inputMode="numeric"
              placeholder="—"
              min="1"
            />
            <Field
              label="Notes"
              value={notes}
              onChange={setNotes}
              placeholder="Optional"
              autoCapitalize="sentences"
            />
          </div>

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

      <Card padding="lg">
        <SectionHeader
          title="Recent sessions"
          meta={sessionCount ? `${sessionCount} logged` : undefined}
        />
        {sessions.isLoading && <p className="empty-note">Loading your workouts…</p>}
        {sessions.isError && (
          <Banner tone="error">Could not load your workouts.</Banner>
        )}
        {!sessions.isLoading && !sessions.isError && !sessions.data?.length && (
          <p className="empty-note">
            Nothing logged yet. Your first session will show up here.
          </p>
        )}
        <ul className="row-list">
          {(sessions.data ?? []).map((workout) => {
            const volume = sessionVolumeKg(workout.exercises)
            const summary = [
              workoutTypeLabel(workout.workout_type),
              formatDateTime(workout.performed_at),
              workout.duration_minutes ? `${workout.duration_minutes} min` : null,
              !isCardio(workout.workout_type) && volume > 0
                ? `${formatWeight(volume, unitSystem, 0)} volume`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <li key={workout.id} style={{ alignItems: 'flex-start', paddingTop: 10 }}>
                <span
                  className="tile-icon"
                  style={{ ['--tone' as string]: 'var(--ember)', width: 36, height: 36, borderRadius: 11 }}
                >
                  <Icon name={isCardio(workout.workout_type) ? 'run' : 'dumbbell'} size={18} />
                </span>
                <div className="row-main">
                  <div className="row-title">{workout.name}</div>
                  <div className="row-meta">{summary}</div>
                  {workout.exercises.length > 0 && (
                    <ul
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: '6px 0 0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      {workout.exercises.map((exercise) => {
                        const meta = describeSessionExercise(exercise, unitSystem)
                        return (
                          <li key={exercise.id} style={{ fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{exercise.exercise_name}</span>
                            {meta && <span style={{ color: 'var(--text-tertiary)' }}> — {meta}</span>}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {workout.notes && (
                    <p
                      style={{
                        margin: '6px 0 0',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-secondary)',
                        fontStyle: 'italic',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {workout.notes}
                    </p>
                  )}
                </div>
                <IconButton
                  icon="trash"
                  tone="danger"
                  label={`Delete ${workout.name}, ${formatShortDate(workout.performed_at)}`}
                  onClick={() => deleteSession.mutate(workout.id)}
                  style={{ marginTop: -4, marginRight: -8 }}
                />
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}
