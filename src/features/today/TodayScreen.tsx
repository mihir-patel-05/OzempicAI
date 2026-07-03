import { Card } from '../../components/Card'
import { Ring } from '../../components/Ring'
import { useUserProfile } from '../../hooks/useUserProfile'
import {
  useDailyCalorieTotal,
  useDailyExerciseTotal,
  useDailyWaterTotal,
} from '../../hooks/useDailyTotals'
import { useAuth } from '../../auth/AuthProvider'

const EXERCISE_GOAL_MINUTES = 30

export function TodayScreen() {
  const { session } = useAuth()
  const profile = useUserProfile()
  const calories = useDailyCalorieTotal()
  const water = useDailyWaterTotal()
  const exercise = useDailyExerciseTotal()

  const firstError =
    profile.error ?? calories.error ?? water.error ?? exercise.error

  const calorieGoal = profile.data?.daily_calorie_goal ?? 2000
  const waterGoal = profile.data?.daily_water_goal_ml ?? 2500
  const name = profile.data?.name?.trim() || firstName(session?.user.email)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
      }}
    >
      <header>
        <p
          style={{
            margin: 0,
            color: 'var(--text-tertiary)',
            fontSize: 12,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {greeting()}
        </p>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 34,
            margin: 0,
            color: 'var(--text-primary)',
          }}
        >
          Hi{name ? `, ${name}` : ''}
        </h1>
      </header>

      <Card padding="lg" radius="hero">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--space-md)',
            placeItems: 'center',
          }}
        >
          <RingStat
            label="Calories"
            value={calories.data ?? 0}
            goal={calorieGoal}
            unit="kcal"
            color="var(--calorie-ring)"
            loading={calories.isLoading}
          />
          <RingStat
            label="Water"
            value={water.data ?? 0}
            goal={waterGoal}
            unit="ml"
            color="var(--water-fill)"
            loading={water.isLoading}
          />
          <RingStat
            label="Exercise"
            value={exercise.data ?? 0}
            goal={EXERCISE_GOAL_MINUTES}
            unit="min"
            color="var(--exercise-ring)"
            loading={exercise.isLoading}
          />
        </div>
      </Card>

      {firstError && (
        <Card padding="md">
          <p style={{ margin: 0, color: 'var(--ember)', fontSize: 14 }}>
            Couldn't load today's totals: {firstError.message}
          </p>
        </Card>
      )}
    </div>
  )
}

function RingStat({
  label,
  value,
  goal,
  unit,
  color,
  loading,
}: {
  label: string
  value: number
  goal: number
  unit: string
  color: string
  loading: boolean
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <Ring
        value={value}
        goal={goal}
        color={color}
        size={92}
        stroke={10}
        label={`${label}: ${value} of ${goal} ${unit}`}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 18,
              color: 'var(--text-primary)',
              lineHeight: 1,
              opacity: loading ? 0.4 : 1,
              transition: 'opacity 200ms ease-out',
            }}
          >
            {loading ? '—' : value}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{unit}</div>
        </div>
      </Ring>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 11,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: '2px 0 0',
          fontSize: 10,
          color: 'var(--text-tertiary)',
        }}
      >
        of {goal}
      </p>
    </div>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function firstName(email: string | undefined): string {
  if (!email) return ''
  const local = email.split('@')[0]
  return local.charAt(0).toUpperCase() + local.slice(1)
}
