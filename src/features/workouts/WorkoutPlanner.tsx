import { useMemo, useState } from 'react'
import { Banner } from '../../components/Banner'
import { Card } from '../../components/Card'
import { CapsLabel, Field } from '../../components/Field'
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
      <Card padding="lg" radius="hero" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h2 style={sectionTitleStyle}>Plan a workout</h2>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1.25fr .75fr', gap: 10 }}>
            <Field
              label="Workout name"
              value={name}
              onChange={setName}
              placeholder={`${workoutTypeLabel(workoutType)} day`}
              autoCapitalize="sentences"
            />
            <Field label="Date" value={date} onChange={setDate} type="date" min={today} />
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
            placeholder="Warm up on the bike first"
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

      <Card padding="lg" radius="hero" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
          <h2 style={sectionTitleStyle}>Upcoming</h2>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
            {plans.data?.length ?? 0} workouts
          </span>
        </div>
        {plans.isLoading && <MutedText>Loading your plan…</MutedText>}
        {plans.isError && <Banner tone="error">Could not load your workout plan.</Banner>}
        {!plans.isLoading && !plans.isError && !plans.data?.length && (
          <MutedText>Nothing planned yet. Sketch out your next session.</MutedText>
        )}
        {Object.entries(grouped).map(([plannedDate, entries]) => (
          <div key={plannedDate} style={{ marginTop: 18 }}>
            <p style={{ ...eyebrowStyle, marginBottom: 6 }}>{formatPlanDate(plannedDate)}</p>
            {entries.map((plan) => (
              <div
                key={plan.id}
                style={{ padding: '11px 0', borderBottom: '1px solid var(--divider)' }}
              >
                <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                  <button
                    type="button"
                    aria-label={
                      plan.completed_at
                        ? `Mark ${plan.name} as not done`
                        : `Mark ${plan.name} as done`
                    }
                    onClick={() =>
                      setCompleted.mutate({
                        id: plan.id,
                        completed: !plan.completed_at,
                      })
                    }
                    style={{
                      display: 'grid',
                      flex: '0 0 auto',
                      width: 24,
                      height: 24,
                      placeItems: 'center',
                      borderRadius: 8,
                      border: `1px solid ${plan.completed_at ? 'var(--sage-deep)' : 'var(--dust)'}`,
                      background: plan.completed_at ? 'var(--sage-deep)' : 'transparent',
                      color: 'white',
                    }}
                  >
                    {plan.completed_at ? '✓' : ''}
                  </button>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        textDecoration: plan.completed_at ? 'line-through' : 'none',
                        color: plan.completed_at
                          ? 'var(--text-tertiary)'
                          : 'var(--text-primary)',
                      }}
                    >
                      {plan.name}
                    </div>
                    <div style={{ marginTop: 2, color: 'var(--text-tertiary)', fontSize: 10 }}>
                      {workoutTypeLabel(plan.workout_type)} ·{' '}
                      {plan.exercises.length}{' '}
                      {plan.exercises.length === 1 ? 'exercise' : 'exercises'}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Delete ${plan.name}`}
                    onClick={() => deletePlan.mutate(plan.id)}
                    style={{ padding: 8, color: 'var(--text-tertiary)', fontSize: 17 }}
                  >
                    ×
                  </button>
                </div>
                {plan.exercises.length > 0 && (
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: '6px 0 0 35px',
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    {plan.exercises.map((exercise) => {
                      const meta = describePlanExercise(exercise, unitSystem)
                      return (
                        <li key={exercise.id} style={{ fontSize: 12 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {exercise.exercise_name}
                          </span>
                          {meta && (
                            <span style={{ color: 'var(--text-tertiary)' }}> — {meta}</span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
                {plan.notes && (
                  <p
                    style={{
                      margin: '6px 0 0 35px',
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                    }}
                  >
                    {plan.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
      </Card>
    </div>
  )
}

function MutedText({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: '16px 0 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
      {children}
    </p>
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

const eyebrowStyle: React.CSSProperties = {
  margin: '0 0 3px',
  color: 'var(--text-tertiary)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.1,
  textTransform: 'uppercase',
}
const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 16px',
  fontFamily: 'var(--font-display)',
  fontSize: 20,
  fontWeight: 600,
}
