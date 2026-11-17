import { useState } from 'react'
import { Card } from '../../components/Card'
import { IconButton } from '../../components/IconButton'
import { SectionHeader } from '../../components/PageHeader'
import { ShowAllButton } from '../../components/Sparkline'
import type { Fast } from '../../types/db'
import { FastForm } from './FastForm'
import { goalLabel } from './presets'
import { dayLabel, fastProgress, formatDuration, formatTime } from './progress'

const PREVIEW = 6

interface FastHistoryProps {
  /** Ended fasts, newest first. */
  fasts: Fast[]
  isLoading: boolean
  now: number
  /** The goal a newly added past fast starts with. */
  initialTarget: number
}

export function FastHistory({ fasts, isLoading, now, initialTarget }: FastHistoryProps) {
  const [showAll, setShowAll] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const visible = showAll ? fasts : fasts.slice(0, PREVIEW)

  return (
    <Card padding="lg">
      <SectionHeader
        title="History"
        action={
          adding ? undefined : (
            <button type="button" className="text-button" onClick={() => setAdding(true)}>
              Add a past fast
            </button>
          )
        }
      />
      {adding && (
        <Card variant="inset" padding="md" style={{ marginBottom: 'var(--space-md)' }}>
          <FastForm mode="add" initialTarget={initialTarget} onDone={() => setAdding(false)} />
        </Card>
      )}
      {isLoading && <p className="empty-note">Loading…</p>}
      {!isLoading && fasts.length === 0 && !adding && <p className="empty-note">Finished fasts show up here.</p>}
      <ul className="row-list">
        {visible.map((fast) =>
          editingId === fast.id ? (
            <li key={fast.id} style={{ display: 'block', padding: 'var(--space-ms) 0' }}>
              <FastForm mode="edit" fast={fast} onDone={() => setEditingId(null)} />
            </li>
          ) : (
            <FastRow key={fast.id} fast={fast} now={now} onEdit={() => setEditingId(fast.id)} />
          ),
        )}
      </ul>
      {fasts.length > PREVIEW && (
        <ShowAllButton expanded={showAll} total={fasts.length} onToggle={() => setShowAll((v) => !v)} />
      )}
    </Card>
  )
}

function FastRow({ fast, now, onEdit }: { fast: Fast; now: number; onEdit: () => void }) {
  const p = fastProgress(fast, now)
  const endMs = Date.parse(fast.ended_at!)
  const day = dayLabel(endMs, now)
  const length = formatDuration(p.elapsedMs)
  return (
    <li>
      <span
        className="row-dot"
        style={{ background: p.reached ? 'var(--success)' : 'var(--text-tertiary)' }}
        aria-hidden="true"
      />
      <div className="row-main">
        <div className="row-title">
          {length}
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
      <IconButton icon="pencil" label={`Edit the ${length} fast ending ${day}`} onClick={onEdit} style={{ marginRight: -10 }} />
    </li>
  )
}
