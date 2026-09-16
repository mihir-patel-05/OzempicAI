import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Ring } from '../../components/Ring'
import { useUserProfile } from '../../hooks/useUserProfile'
import {
  useDailyCalorieTotal,
  useDailyExerciseTotal,
  useDailyWaterTotal,
} from '../../hooks/useDailyTotals'
import { useAuth } from '../../auth/AuthProvider'
import { useRecentWeightLogs } from '../../hooks/useWeightLogs'
import { useRecentHeartRateLogs } from '../../hooks/useHeartRateLogs'

const EXERCISE_GOAL_MINUTES = 30

export function TodayScreen() {
  const { session } = useAuth()
  const profile = useUserProfile()
  const calories = useDailyCalorieTotal()
  const water = useDailyWaterTotal()
  const exercise = useDailyExerciseTotal()
  const weights = useRecentWeightLogs()
  const heartRates = useRecentHeartRateLogs()

  const firstError =
    profile.error ?? calories.error ?? water.error ?? exercise.error

  const calorieGoal = profile.data?.daily_calorie_goal ?? 2000
  const waterGoal = profile.data?.daily_water_goal_ml ?? 2500
  const name = profile.data?.name?.trim() || firstName(session?.user.email)
  const calorieRemaining = Math.max(calorieGoal - (calories.data ?? 0), 0)
  const waterPercent = percent(water.data ?? 0, waterGoal)
  const exercisePercent = percent(exercise.data ?? 0, EXERCISE_GOAL_MINUTES)

  return (
    <div className="screen-stack">
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-end' }}>
        <div>
          <p style={{ margin: '0 0 3px', color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 700, letterSpacing: 1.3, textTransform: 'uppercase' }}>
            {greeting()}
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(32px, 5vw, 42px)', letterSpacing: -1, margin: 0, color: 'var(--text-primary)' }}>
            Hi{name ? `, ${name}` : ''}
          </h1>
        </div>
        <p style={{ margin: '0 0 5px', color: 'var(--text-tertiary)', fontSize: 12, textAlign: 'right' }}>
          {formatToday()}
        </p>
      </header>

      <div className="dashboard-grid">
        <Card padding="lg" radius="hero" style={{ background: 'linear-gradient(145deg, var(--paper-bright), var(--paper))', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                Daily calories
              </p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 8 }}>
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(38px, 7vw, 58px)', fontWeight: 500, lineHeight: 1 }}>
                  {calories.isLoading ? '—' : calories.data ?? 0}
                </strong>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>/ {calorieGoal} kcal</span>
              </div>
              <p style={{ margin: '10px 0 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                {calorieRemaining > 0 ? `${calorieRemaining.toLocaleString()} kcal remaining` : 'Daily goal reached'}
              </p>
            </div>
            <Ring value={calories.data ?? 0} goal={calorieGoal} color="var(--calorie-ring)" size={116} stroke={11} label={`${calories.data ?? 0} of ${calorieGoal} calories`}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600 }}>
                {percent(calories.data ?? 0, calorieGoal)}%
              </span>
            </Ring>
          </div>
          <Link to="/log/calories" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 22, color: 'var(--accent)', fontSize: 13, fontWeight: 700 }}>
            Log a meal <span aria-hidden="true">→</span>
          </Link>
        </Card>

        <Card padding="lg" radius="hero" style={{ boxShadow: 'var(--shadow-card)' }}>
          <p style={{ margin: '0 0 18px', fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600 }}>Today’s rhythm</p>
          <MiniProgress label="Hydration" value={`${(water.data ?? 0).toLocaleString()} ml`} percent={waterPercent} color="var(--water-fill)" />
          <MiniProgress label="Movement" value={`${exercise.data ?? 0} min`} percent={exercisePercent} color="var(--exercise-ring)" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
            <SmallMetric label="Weight" value={weights.data?.[0] ? `${round1(weights.data[0].weight_kg)} kg` : '—'} />
            <SmallMetric label="Heart" value={heartRates.data?.[0] ? `${heartRates.data[0].bpm} bpm` : '—'} />
          </div>
        </Card>
      </div>

      <section aria-labelledby="quick-log-heading">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '8px 2px 11px' }}>
          <h2 id="quick-log-heading" style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600 }}>Quick log</h2>
          <Link to="/log" style={{ fontSize: 12, fontWeight: 600 }}>View all</Link>
        </div>
        <div className="quick-log-grid">
          <QuickLog to="/log/calories" icon="fork" title="Meal" hint="Calories & food" />
          <QuickLog to="/log/water" icon="drop" title="Water" hint="Stay hydrated" />
          <QuickLog to="/log/exercise" icon="move" title="Exercise" hint="Minutes & effort" />
          <QuickLog to="/log/weight" icon="scale" title="Weight" hint="Track the trend" />
        </div>
      </section>

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

function MiniProgress({ label, value, percent: progress, color }: { label: string; value: string; percent: number; color: string }) {
  return (
    <div style={{ marginBottom: 15 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 7, fontSize: 12 }}>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>{value}</span>
      </div>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%`, background: color }} /></div>
    </div>
  )
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '12px 13px', borderRadius: 15, background: 'var(--paper-muted)' }}>
      <div style={{ color: 'var(--text-tertiary)', fontSize: 10, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: 4, fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function QuickLog({ to, icon, title, hint }: { to: string; icon: 'fork' | 'drop' | 'move' | 'scale'; title: string; hint: string }) {
  return (
    <Link to={to} className="quick-log-card">
      <span className="quick-log-icon" aria-hidden="true"><QuickIcon name={icon} /></span>
      <span>
        <strong style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600 }}>{title}</strong>
        <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{hint}</span>
      </span>
    </Link>
  )
}

function QuickIcon({ name }: { name: 'fork' | 'drop' | 'move' | 'scale' }) {
  if (name === 'drop') return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2S5.5 9.2 5.5 14a6.5 6.5 0 0 0 13 0C18.5 9.2 12 2 12 2Z" /></svg>
  if (name === 'move') return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m7 8 3-3 3 3M10 5v14M17 16l-3 3-3-3" /></svg>
  if (name === 'scale') return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="3" width="16" height="18" rx="4"/><path d="M9 8a3 3 0 0 1 6 0M12 8l2-2"/></svg>
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 2 4 5 4 8h-4" /></svg>
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

function percent(value: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((value / goal) * 100)))
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function formatToday(): string {
  return new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}
