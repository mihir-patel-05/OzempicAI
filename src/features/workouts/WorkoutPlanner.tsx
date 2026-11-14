import { useMemo, useState } from 'react'
import { Banner } from '../../components/Banner'
import { Card } from '../../components/Card'
import { CapsLabel, Field } from '../../components/Field'
import { Icon } from '../../components/Icon'
import { IconButton } from '../../components/IconButton'
import { SectionHeader } from '../../components/PageHeader'
import { PrimaryButton } from '../../components/PrimaryButton'
import { SegmentedPicker } from '../../components/SegmentedPicker'
import { useUnitSystem } from '../../hooks/useUserProfile'
import {
  useCreateWorkoutPlan,
  useDeleteWorkoutPlan,
  useSetWorkoutPlanCompleted,
  useUpcomingWorkoutPlans,
} from '../../hooks/useWorkoutPlans'
import { toLocalDateKey } from '../../lib/date'
import type { WorkoutPlanWithExercises, WorkoutType } from '../../types/db'
import {
  ExerciseRowsEditor,
  emptyExerciseRow,
  exerciseRowsToDrafts,
  hasContent,
  type ExerciseRow,
} from './ExerciseRowsEditor'
import { WORKOUT_TYPE_OPTIONS, workoutTypeLabel } from './constants'
import { describePlanExercise } from './format'

export function WorkoutPlanner() {
  const unitSystem = useUnitSystem()
  const plans = useUpcomingWorkoutPlans()
  const createPlan = useCreateWorkoutPlan()
  const deletePlan = useDeleteWorkoutPlan()
  const setCompleted = useSetWorkoutPlanCompleted()

  const today = toLocalDateKey()
  const [workoutType, setWorkoutType] = useState<WorkoutType>('push')
  const [name, setName] = useState('')
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<ExerciseRow[]>([emptyExerciseRow()])
  const [error, setError] = useState<string | null>(null)

  const canSubmit = name.trim().length > 0 && date.length === 10
  const grouped = useMemo(() => groupByDate(plans.data ?? []), [plans.data])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    try {
      await createPlan.mutateAsync({
        name: name.trim(),
        workout_type: workoutType,
        planned_date: date,
        notes: notes.trim() || null,
        exercises: exerciseRowsToDrafts(rows, workoutType, unitSystem),
      })
      setName('')
      setNotes('')
      setRows([emptyExerciseRow()])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the plan.')
    }
  }

  return (
    <div className="tracker-grid">
      <Card padding="lg">
        <SectionHeader title="Plan a workout" />
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--space-sm)',
            }}
          >
            <Field
              label="Workout name"
              value={name}
              onChange={setName}
              placeholder={`${workoutTypeLabel(workoutType)} day`}
              autoCapitalize="sentences"
            />
            <Field
              label="Date"
              value={date}
              onChange={setDate}
              type="date"
              min={today}
              style={{ paddingInline: 10 }}
            />
          </div>

          <ExerciseRowsEditor
            rows={rows}
            onChange={setRows}
            workoutType={workoutType}
            unitSystem={unitSystem}
            planning
          />

          <Field
            label="Notes"
            value={notes}
            onChange={setNotes}
            placeholder="Optional"
            autoCapitalize="sentences"
          />

          {error && <Banner tone="error">{error}</Banner>}
          <PrimaryButton
            type="submit"
            loading={createPlan.isPending}
            disabled={!canSubmit}
          >
            {rows.some(hasContent) ? 'Save plan' : 'Save plan (no exercises yet)'}
          </PrimaryButton>
        </form>
      </Card>

      <Card padding="lg">
        <SectionHeader
          title="Upcoming"
          meta={`${plans.data?.length ?? 0} ${(plans.data?.length ?? 0) === 1 ? 'workout' : 'workouts'}`}
        />
        {plans.isLoading && <p className="empty-note">Loading your plan…</p>}
        {plans.isError && <Banner tone="error">Could not load your workout plan.</Banner>}
        {!plans.isLoading && !plans.isError && !plans.data?.length && (
          <p className="empty-note">Nothing planned yet. Sketch out your next session.</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {Object.entries(grouped).map(([plannedDate, entries]) => (
            <section key={plannedDate}>
              <p className="eyebrow" style={{ marginBottom: 2 }}>
                {formatPlanDate(plannedDate)}
              </p>
              <ul className="row-list">
                {entries.map((plan) => {
                  const done = !!plan.completed_at
                  return (
                    <li key={plan.id} style={{ alignItems: 'flex-start', paddingTop: 6 }}>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={done ? `Mark ${plan.name} as not done` : `Mark ${plan.name} as done`}
                        aria-pressed={done}
                        onClick={() =>
                          setCompleted.mutate({
                            id: plan.id,
                            completed: !plan.completed_at,
                          })
                        }
                        style={{ marginLeft: -10, marginRight: -6 }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            display: 'grid',
                            width: 24,
                            height: 24,
                            placeItems: 'center',
                            borderRadius: 8,
                            border: `1.5px solid ${done ? 'var(--success)' : 'var(--field-border)'}`,
                            background: done ? 'var(--success)' : 'transparent',
                            color: 'var(--on-accent)',
                          }}
                        >
                          {done && <Icon name="check" size={15} strokeWidth={2.6} />}
                        </span>
                      </button>
                      <div className="row-main" style={{ paddingTop: 4 }}>
                        <div
                          className="row-title"
                          style={done ? { textDecoration: 'line-through', color: 'var(--text-tertiary)' } : undefined}
                        >
                          {plan.name}
                        </div>
                        <div className="row-meta">
                          {workoutTypeLabel(plan.workout_type)} · {plan.exercises.length}{' '}
                          {plan.exercises.length === 1 ? 'exercise' : 'exercises'}
                        </div>
                        {plan.exercises.length > 0 && (
                          <ul
                            style={{
                              listStyle: 'none',
                              margin: '6px 0 0',
                              padding: 0,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                            }}
                          >
                            {plan.exercises.map((exercise) => {
                              const meta = describePlanExercise(exercise, unitSystem)
                              return (
                                <li key={exercise.id} style={{ fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>
                                  <span style={{ color: 'var(--text-secondary)' }}>{exercise.exercise_name}</span>
                                  {meta && <span style={{ color: 'var(--text-tertiary)' }}> — {meta}</span>}
                                </li>
                              )
                            })}
                          </ul>
                        )}
                        {plan.notes && (
                          <p
                            style={{
                              margin: '6px 0 0',
                              fontSize: 'var(--text-xs)',
                              color: 'var(--text-secondary)',
                              fontStyle: 'italic',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {plan.notes}
                          </p>
                        )}
                      </div>
                      <IconButton
                        icon="trash"
                        tone="danger"
                        label={`Delete ${plan.name}, ${formatPlanDate(plannedDate)}`}
                        onClick={() => deletePlan.mutate(plan.id)}
                        style={{ marginRight: -8 }}
                      />
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </Card>
    </div>
  )
}

function groupByDate(
  plans: WorkoutPlanWithExercises[],
): Record<string, WorkoutPlanWithExercises[]> {
  return plans.reduce<Record<string, WorkoutPlanWithExercises[]>>((groups, plan) => {
    ;(groups[plan.planned_date] ??= []).push(plan)
    return groups
  }, {})
}

function formatPlanDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
