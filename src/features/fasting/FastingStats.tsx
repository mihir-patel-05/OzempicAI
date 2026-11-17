import { lazy, Suspense, useState } from 'react'
import { Card } from '../../components/Card'
import { SectionHeader } from '../../components/PageHeader'
import { SegmentedPicker } from '../../components/SegmentedPicker'
import type { Fast } from '../../types/db'
import { formatDuration } from './progress'
import { RANGE_DAYS, dailyFasting, streaks, summarize } from './stats'

// Recharts is big; only this card needs it, so it loads when the card does.
const FastingChart = lazy(() => import('./FastingChart').then((module) => ({ default: module.FastingChart })))

type RangeValue = `${(typeof RANGE_DAYS)[number]}`

const RANGE_OPTIONS = RANGE_DAYS.map((days) => ({ value: String(days) as RangeValue, label: `${days} days` }))

interface FastingStatsProps {
  /** The history, running fast included (it is left out of every number). */
  fasts: Fast[]
  now: number
}

export function FastingStats({ fasts, now }: FastingStatsProps) {
  const [range, setRange] = useState<RangeValue>('30')
  const days = Number(range)
  const anyEnded = fasts.some((fast) => fast.ended_at !== null)
  const summary = summarize(fasts, now, days)
  const streak = streaks(fasts, now)

  return (
    <Card padding="lg">
      <SectionHeader title="Your fasting" />
      {!anyEnded ? (
        <p className="empty-note">Finish a fast to see your streaks and averages here.</p>
      ) : (
        <div className="screen-stack" style={{ gap: 'var(--space-ms)' }}>
          <SegmentedPicker options={RANGE_OPTIONS} value={range} onChange={setRange} ariaLabel="Fasting stats range" />
          <dl className="fasting-stats-grid">
            <Stat
              label="Streak"
              value={`${streak.current} ${streak.current === 1 ? 'day' : 'days'}`}
              detail={`Best ${streak.best} ${streak.best === 1 ? 'day' : 'days'}`}
            />
            <Stat
              label="Goal met"
              value={summary.goalRate === null ? '—' : `${Math.round(summary.goalRate * 100)}%`}
              detail={`${summary.goalsMet} of ${summary.count} ${summary.count === 1 ? 'fast' : 'fasts'}`}
            />
            <Stat
              label="Average"
              value={summary.averageMs === null ? '—' : formatDuration(summary.averageMs)}
              detail={summary.longestMs === null ? 'No fasts' : `Longest ${formatDuration(summary.longestMs)}`}
            />
            <Stat
              label="Total"
              value={`${Math.floor(summary.totalMs / 3_600_000).toLocaleString()} h`}
              detail={`In the last ${days} days`}
            />
          </dl>
          <Suspense fallback={<div className="analytics-chart" role="status" aria-label="Loading chart" />}>
            <FastingChart rows={dailyFasting(fasts, now, days)} />
          </Suspense>
        </div>
      )}
    </Card>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="stat-tile">
      <dt className="eyebrow">{label}</dt>
      <dd className="value">{value}</dd>
      <dd className="detail">{detail}</dd>
    </div>
  )
}
