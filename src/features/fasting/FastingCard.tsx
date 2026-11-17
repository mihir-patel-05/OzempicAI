import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Icon } from '../../components/Icon'
import { PrimaryButton } from '../../components/PrimaryButton'
import { Ring } from '../../components/Ring'
import { useActiveFast, useFastHistory, useStartFast } from '../../hooks/useFasts'
import { useNow } from '../../hooks/useNow'
import type { Fast } from '../../types/db'
import { EndFastActions } from './EndFastActions'
import { DEFAULT_TARGET_MINUTES, goalLabel } from './presets'
import { dayLabel, fastProgress, formatClock, formatDuration, formatTime, formatWhen } from './progress'

/**
 * Fasting on Today: the running fast's countdown with End, or a one-tap start
 * with the last goal used. Its header links to the Fasting screen, which is
 * how phones get there (the phone tab bar has no Fasting tab).
 *
 * The card keeps its own clock, so only it re-renders every second.
 */
export function FastingCard({ style }: { style?: React.CSSProperties }) {
  const active = useActiveFast()
  const history = useFastHistory()
  const running = active.data ?? null
  const now = useNow(running ? 1000 : 60_000)

  return (
    <Card padding="lg" style={style}>
      {active.isLoading || history.isLoading ? (
        <>
          <CardHead title="Fasting" />
          <p className="empty-note" role="status">Loading…</p>
        </>
      ) : active.error ? (
        <>
          <CardHead title="Fasting" />
          <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>
            Couldn't load your fast: {active.error.message}
          </p>
        </>
      ) : running ? (
        <RunningFast fast={running} now={now} />
      ) : (
        <Idle history={history.data ?? []} now={now} />
      )}
    </Card>
  )
}

function CardHead({ title, detail }: { title: string; detail?: string }) {
  return (
    <Link to="/fasting" className="fasting-card-head">
      <span className="tile-icon" style={{ ['--tone' as string]: 'var(--fasting-ring)', width: 32, height: 32, borderRadius: 10 }}>
        <Icon name="timer" size={17} />
      </span>
      <span className="fasting-card-title">
        <strong>{title}</strong>
        {detail && <span>{detail}</span>}
      </span>
      <Icon name="chevron" size={18} />
    </Link>
  )
}

function RunningFast({ fast, now }: { fast: Fast; now: number }) {
  const p = fastProgress(fast, now)
  const goal = goalLabel(fast.target_minutes)

  return (
    <div className="screen-stack" style={{ gap: 'var(--space-ms)' }}>
      <CardHead title="Fasting" detail={`${goal} goal`} />
      <div className="fasting-card-body">
        <Ring
          value={p.fraction}
          goal={1}
          color={p.reached ? 'var(--success)' : 'var(--fasting-ring)'}
          size={84}
          stroke={8}
          label={
            p.reached
              ? `Goal reached. ${formatDuration(p.overtimeMs)} past your ${goal} goal.`
              : `${Math.floor(p.fraction * 100)}% of your ${goal} goal, ${formatDuration(p.remainingMs)} left.`
          }
        >
          {p.reached ? (
            <span style={{ color: 'var(--success)' }}>
              <Icon name="check" size={26} strokeWidth={2.4} />
            </span>
          ) : (
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600 }}>
              {Math.floor(p.fraction * 100)}%
            </span>
          )}
        </Ring>
        <div style={{ minWidth: 0 }}>
          <p className="eyebrow">{p.reached ? 'Past your goal' : 'Remaining'}</p>
          <strong className="fasting-card-clock">
            {p.reached ? `+${formatClock(p.overtimeMs)}` : formatClock(p.remainingMs)}
          </strong>
          <p className="fasting-card-sub">
            {p.reached ? `Reached ${formatWhen(p.goalMs, now)}` : `Goal ${formatWhen(p.goalMs, now)}`}
          </p>
        </div>
      </div>
      <EndFastActions
        fast={fast}
        now={now}
        secondary={
          <Link to="/fasting" className="btn btn-outline">
            Details
          </Link>
        }
      />
    </div>
  )
}

function Idle({ history, now }: { history: Fast[]; now: number }) {
  const startFast = useStartFast()
  const [error, setError] = useState<string | null>(null)
  const last = history.find((fast) => fast.ended_at !== null)
  const target = history[0]?.target_minutes ?? DEFAULT_TARGET_MINUTES

  async function start() {
    setError(null)
    try {
      await startFast.mutateAsync({ target_minutes: target })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start your fast.')
    }
  }

  const lastLine = last
    ? `Last fast ${formatDuration(fastProgress(last, now).elapsedMs)}, ended ${dayLabel(Date.parse(last.ended_at!), now)} at ${formatTime(Date.parse(last.ended_at!))}`
    : 'Time an intermittent fast'

  return (
    <div className="screen-stack" style={{ gap: 'var(--space-ms)' }}>
      <CardHead title="Fasting" detail={lastLine} />
      {error && (
        <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>
          {error}
        </p>
      )}
      <div className="fasting-two-up">
        <Link to="/fasting" className="btn btn-outline">
          Other goal
        </Link>
        <PrimaryButton type="button" loading={startFast.isPending} onClick={start}>
          Start {goalLabel(target)}
        </PrimaryButton>
      </div>
    </div>
  )
}
