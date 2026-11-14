import { useState } from 'react'
import { Card } from '../../components/Card'
import { SPARK_POINTS, ShowAllButton, Sparkline } from '../../components/Sparkline'
import { CapsLabel } from '../../components/Field'
import { IconButton } from '../../components/IconButton'
import { SectionHeader } from '../../components/PageHeader'
import { PrimaryButton } from '../../components/PrimaryButton'
import { Banner } from '../../components/Banner'
import { ScreenHeader } from '../../components/ScreenHeader'
import {
  useDeleteHeartRateLog,
  useLogHeartRate,
  useRecentHeartRateLogs,
} from '../../hooks/useHeartRateLogs'

const HISTORY_PREVIEW = 5

export function HeartRateScreen() {
  const logs = useRecentHeartRateLogs()
  const logHeartRate = useLogHeartRate()
  const deleteLog = useDeleteHeartRateLog()

  const [bpm, setBpm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const sorted = logs.data ?? []
  const latest = sorted[0]
  const bpmNum = Number(bpm)
  const canSubmit = Number.isFinite(bpmNum) && bpmNum > 30 && bpmNum < 240

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    try {
      await logHeartRate.mutateAsync(Math.round(bpmNum))
      setBpm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log reading.')
    }
  }

  const previous = sorted[1]
  const delta = latest && previous ? latest.bpm - previous.bpm : null
  const visible = showAll ? sorted : sorted.slice(0, HISTORY_PREVIEW)
  const trend = sorted.slice(0, SPARK_POINTS).map((row) => row.bpm).reverse()

  return (
    <div className="screen-stack">
      <ScreenHeader title="Heart rate" subtitle="Resting beats per minute" />

      <div className="tracker-grid">
        <div className="screen-stack">
          <Card padding="lg" radius="hero">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 'var(--space-md)' }}>
              <div style={{ minWidth: 0 }}>
                <p className="eyebrow">Latest</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                  <strong
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-stat)',
                      fontWeight: 500,
                      lineHeight: 1,
                      letterSpacing: 'var(--tracking-title)',
                      color: 'var(--heart-pulse)',
                    }}
                  >
                    {latest ? latest.bpm : '—'}
                  </strong>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>bpm</span>
                </div>
                <DeltaLine delta={delta} hasLatest={!!latest} />
                {latest && (
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                    {formatRelative(latest.recorded_at)} · {latest.source}
                  </p>
                )}
              </div>
              <Sparkline
                values={trend}
                color="var(--plum)"
                label={`Heart rate trend over the last ${trend.length} readings`}
              />
            </div>
          </Card>

          <Card padding="lg">
            <form onSubmit={onSubmit}>
              <label htmlFor="heart-rate-entry" style={{ display: 'block', marginBottom: 6 }}>
                <CapsLabel>New reading</CapsLabel>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 'var(--space-sm)' }}>
                <input
                  id="heart-rate-entry"
                  className="field-input"
                  value={bpm}
                  onChange={(e) => setBpm(e.target.value)}
                  type="number"
                  inputMode="numeric"
                  placeholder="bpm"
                  aria-describedby="heart-rate-hint"
                />
                <PrimaryButton
                  type="submit"
                  loading={logHeartRate.isPending}
                  disabled={!canSubmit}
                  aria-label="Log heart rate"
                  style={{ minHeight: 'var(--tap)', paddingInline: 22 }}
                >
                  Log
                </PrimaryButton>
              </div>
              <p id="heart-rate-hint" style={{ margin: '6px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                Between 30 and 240
              </p>
              {error && (
                <div style={{ marginTop: 'var(--space-sm)' }}>
                  <Banner tone="error">{error}</Banner>
                </div>
              )}
            </form>
          </Card>
        </div>

        <Card padding="lg">
          <SectionHeader
            title="History"
            meta={sorted.length ? `${sorted.length} ${sorted.length === 1 ? 'reading' : 'readings'}` : undefined}
          />
          {logs.isLoading && <p className="empty-note">Loading…</p>}
          {!logs.isLoading && sorted.length === 0 && (
            <p className="empty-note">No readings yet.</p>
          )}
          <ul className="row-list">
            {visible.map((row) => {
              const when = formatRelative(row.recorded_at)
              return (
                <li key={row.id}>
                  <span className="row-dot" style={{ background: 'var(--plum)' }} aria-hidden="true" />
                  <div className="row-main">
                    <div className="row-title">{row.bpm} bpm</div>
                    <div className="row-meta">
                      {when} · {row.source}
                    </div>
                  </div>
                  <IconButton
                    icon="trash"
                    tone="danger"
                    label={`Delete ${row.bpm} bpm, ${when}`}
                    onClick={() => deleteLog.mutate(row.id)}
                    style={{ marginRight: -10 }}
                  />
                </li>
              )
            })}
          </ul>
          {sorted.length > HISTORY_PREVIEW && (
            <ShowAllButton expanded={showAll} total={sorted.length} onToggle={() => setShowAll((v) => !v)} />
          )}
        </Card>
      </div>
    </div>
  )
}

function DeltaLine({ delta, hasLatest }: { delta: number | null; hasLatest: boolean }) {
  const flat = delta === null || delta === 0
  const text =
    delta === null
      ? hasLatest
        ? 'First reading'
        : 'No readings yet'
      : flat
        ? 'Same as last reading'
        : `${delta < 0 ? '↓' : '↑'} ${Math.abs(delta)} bpm since last reading`
  return (
    <p
      className={flat ? undefined : delta! < 0 ? 'delta-down' : 'delta-up'}
      style={{
        margin: '8px 0 0',
        fontSize: 'var(--text-sm)',
        fontWeight: flat ? 400 : 600,
        color: flat ? 'var(--text-tertiary)' : undefined,
      }}
    >
      {text}
    </p>
  )
}

/** Tiny trend line of recent entries, oldest → newest. */

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
