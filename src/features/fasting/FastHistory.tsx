import { useState } from 'react'
import { Card } from '../../components/Card'
import { SectionHeader } from '../../components/PageHeader'
import { ShowAllButton } from '../../components/Sparkline'
import type { Fast } from '../../types/db'
import { goalLabel } from './presets'
import { dayLabel, fastProgress, formatDuration, formatTime } from './progress'

const PREVIEW = 6

interface FastHistoryProps {
  /** Ended fasts, newest first. */
  fasts: Fast[]
  isLoading: boolean
  now: number
}

export function FastHistory({ fasts, isLoading, now }: FastHistoryProps) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? fasts : fasts.slice(0, PREVIEW)

  return (
    <Card padding="lg">
      <SectionHeader
        title="History"
        meta={fasts.length ? `${fasts.length} ${fasts.length === 1 ? 'fast' : 'fasts'}` : undefined}
      />
      {isLoading && <p className="empty-note">Loading…</p>}
      {!isLoading && fasts.length === 0 && <p className="empty-note">Finished fasts show up here.</p>}
      <ul className="row-list">
        {visible.map((fast) => (
          <FastRow key={fast.id} fast={fast} now={now} />
        ))}
      </ul>
      {fasts.length > PREVIEW && (
        <ShowAllButton expanded={showAll} total={fasts.length} onToggle={() => setShowAll((v) => !v)} />
      )}
    </Card>
  )
}

function FastRow({ fast, now }: { fast: Fast; now: number }) {
  const p = fastProgress(fast, now)
  const endMs = Date.parse(fast.ended_at!)
  const day = dayLabel(endMs, now)
  return (
    <li>
      <span
        className="row-dot"
        style={{ background: p.reached ? 'var(--success)' : 'var(--text-tertiary)' }}
        aria-hidden="true"
      />
      <div className="row-main">
        <div className="row-title">
          {formatDuration(p.elapsedMs)}
          <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}> · {goalLabel(fast.target_minutes)} goal</span>
        </div>
        <div className="row-meta">
          {day.charAt(0).toUpperCase() + day.slice(1)} · {formatTime(p.startMs)} – {formatTime(endMs)}
          {fast.notes ? ` · ${fast.notes}` : ''}
        </div>
      </div>
      <span className="row-value" style={{ color: p.reached ? 'var(--success)' : 'var(--text-tertiary)' }}>
        {p.reached ? 'Goal met' : `${formatDuration(p.remainingMs)} short`}
      </span>
    </li>
  )
}
