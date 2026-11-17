import { Ring } from '../../components/Ring'
import type { Fast } from '../../types/db'
import { goalLabel } from './presets'
import { dayLabel, fastProgress, formatClock, formatDuration, formatTime } from './progress'

interface FastingTimerProps {
  fast: Fast
  /** From useNow(): the timer only re-renders when its parent ticks. */
  now: number
  size?: number
}

/**
 * The running fast as a ring and a countdown, switching to time past the goal
 * once it is reached, with when it started, when the goal lands and how long
 * it has been.
 */
export function FastingTimer({ fast, now, size = 232 }: FastingTimerProps) {
  const p = fastProgress(fast, now)
  const goal = goalLabel(fast.target_minutes)

  return (
    <div className="fasting-timer">
      <Ring
        value={p.fraction}
        goal={1}
        color={p.reached ? 'var(--success)' : 'var(--fasting-ring)'}
        size={size}
        stroke={Math.round(size / 15)}
        // Whole minutes only, so a screen reader isn't handed a new label every second.
        label={
          p.reached
            ? `Goal reached. ${formatDuration(p.elapsedMs)} fasted, ${formatDuration(p.overtimeMs)} past your ${goal} goal.`
            : `${formatDuration(p.elapsedMs)} fasted, ${formatDuration(p.remainingMs)} left of your ${goal} goal.`
        }
      >
        <span className="fasting-timer-readout">
          <span className="eyebrow">{p.reached ? 'Past your goal' : 'Remaining'}</span>
          <strong className="fasting-timer-clock">
            {p.reached ? `+${formatClock(p.overtimeMs)}` : formatClock(p.remainingMs)}
          </strong>
          <span className="fasting-timer-sub">
            {p.reached ? `${goal} goal reached` : `${Math.floor(p.fraction * 100)}% of ${goal}`}
          </span>
        </span>
      </Ring>

      <dl className="fasting-timer-facts">
        <div className="stat-tile">
          <dt className="eyebrow">Started</dt>
          <dd className="value">{formatTime(p.startMs)}</dd>
          <dd className="detail">{dayLabel(p.startMs, now)}</dd>
        </div>
        <div className="stat-tile">
          <dt className="eyebrow">{p.reached ? 'Reached' : 'Goal at'}</dt>
          <dd className="value">{formatTime(p.goalMs)}</dd>
          <dd className="detail">{dayLabel(p.goalMs, now)}</dd>
        </div>
        <div className="stat-tile">
          <dt className="eyebrow">Fasted</dt>
          <dd className="value">{formatDuration(p.elapsedMs)}</dd>
          <dd className="detail">of {formatDuration(p.targetMs)}</dd>
        </div>
      </dl>
    </div>
  )
}
