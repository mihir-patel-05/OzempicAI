import { useState } from 'react'
import { Card } from '../../components/Card'
import { Field } from '../../components/Field'
import { PrimaryButton } from '../../components/PrimaryButton'
import { Banner } from '../../components/Banner'
import { ScreenHeader } from '../../components/ScreenHeader'
import {
  useDeleteHeartRateLog,
  useLogHeartRate,
  useRecentHeartRateLogs,
} from '../../hooks/useHeartRateLogs'

export function HeartRateScreen() {
  const logs = useRecentHeartRateLogs()
  const logHeartRate = useLogHeartRate()
  const deleteLog = useDeleteHeartRateLog()

  const [bpm, setBpm] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
    >
      <ScreenHeader
        title="Heart rate"
        subtitle="Manual entry · the iOS app pulls from HealthKit"
      />

      <Card padding="lg">
        <div
          style={{
            fontSize: 11,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            fontWeight: 600,
          }}
        >
          Latest
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginTop: 4,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 44,
              fontWeight: 500,
              color: 'var(--heart-pulse)',
            }}
          >
            {latest ? latest.bpm : '—'}
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>bpm</span>
        </div>
        {latest && (
          <div
            style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}
          >
            {formatRelative(latest.recorded_at)} · {latest.source}
          </div>
        )}
      </Card>

      <Card padding="md">
        <form
          onSubmit={onSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
        >
          <Field
            label="New reading"
            value={bpm}
            onChange={setBpm}
            type="number"
            inputMode="numeric"
            placeholder="bpm"
            hint="Between 30 and 240"
          />
          {error && <Banner tone="error">{error}</Banner>}
          <PrimaryButton
            type="submit"
            loading={logHeartRate.isPending}
            disabled={!canSubmit}
          >
            Log heart rate
          </PrimaryButton>
        </form>
      </Card>

      <Card padding="md">
        {logs.isLoading && (
          <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 13 }}>
            Loading…
          </p>
        )}
        {!logs.isLoading && sorted.length === 0 && (
          <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: 13 }}>
            No readings yet.
          </p>
        )}
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {sorted.map((row) => (
            <li
              key={row.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid var(--divider)',
              }}
            >
              <div>
                <div style={{ fontSize: 15, color: 'var(--text-primary)' }}>
                  {row.bpm} bpm
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {formatRelative(row.recorded_at)} · {row.source}
                </div>
              </div>
              <button
                type="button"
                onClick={() => deleteLog.mutate(row.id)}
                aria-label="Delete entry"
                style={{ color: 'var(--text-tertiary)', padding: 8 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

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
