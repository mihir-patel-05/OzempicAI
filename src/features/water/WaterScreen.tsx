import { useState } from 'react'
import { Card } from '../../components/Card'
import { CapsLabel } from '../../components/Field'
import { IconButton } from '../../components/IconButton'
import { SectionHeader } from '../../components/PageHeader'
import { PrimaryButton } from '../../components/PrimaryButton'
import { Banner } from '../../components/Banner'
import { ScreenHeader } from '../../components/ScreenHeader'
import {
  useDeleteWaterLog,
  useLogWater,
  useWaterLogsToday,
} from '../../hooks/useWaterLogs'
import { useUserProfile } from '../../hooks/useUserProfile'

const QUICK_AMOUNTS = [250, 500, 750]

export function WaterScreen() {
  const profile = useUserProfile()
  const logs = useWaterLogsToday()
  const logWater = useLogWater()
  const deleteLog = useDeleteWaterLog()

  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | null>(null)

  const total = (logs.data ?? []).reduce((acc, r) => acc + r.amount_ml, 0)
  const goal = profile.data?.daily_water_goal_ml ?? 2500
  const remaining = Math.max(goal - total, 0)
  const customNum = Number(custom)
  const canSubmitCustom = Number.isFinite(customNum) && customNum > 0

  async function addAmount(ml: number) {
    setError(null)
    try {
      await logWater.mutateAsync(ml)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log water.')
      return false
    }
  }

  async function onSubmitCustom(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmitCustom) return
    const didAdd = await addAmount(Math.round(customNum))
    if (didAdd) setCustom('')
  }

  const progress = goal > 0 ? Math.min(100, Math.max(0, Math.round((total / goal) * 100))) : 0
  const entries = logs.data ?? []

  return (
    <div className="screen-stack">
      <ScreenHeader
        title="Water"
        subtitle={remaining > 0 ? `${remaining.toLocaleString()} ml to go today` : 'Daily goal reached'}
      />

      <div className="tracker-grid">
        <div className="screen-stack">
          <Card padding="lg" radius="hero">
            <p className="eyebrow">Today</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)', marginTop: 6, flexWrap: 'wrap' }}>
              <strong
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--text-stat)',
                  fontWeight: 500,
                  lineHeight: 1,
                  letterSpacing: 'var(--tracking-title)',
                }}
              >
                {logs.isLoading ? '—' : total.toLocaleString()}
              </strong>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                / {goal.toLocaleString()} ml
              </span>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Water"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              style={{ marginTop: 'var(--space-md)' }}
            >
              <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--water-fill)' }} />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 'var(--space-sm)',
                marginTop: 'var(--space-sm)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-tertiary)',
              }}
            >
              <span>{progress}% of goal</span>
              <span>{remaining > 0 ? `${remaining.toLocaleString()} ml left` : 'Goal reached'}</span>
            </div>
          </Card>

          <Card padding="lg">
            <SectionHeader title="Add water" as="h2" />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${QUICK_AMOUNTS.length}, minmax(0, 1fr))`,
                gap: 'var(--space-sm)',
              }}
            >
              {QUICK_AMOUNTS.map((ml) => (
                <button
                  key={ml}
                  type="button"
                  className="btn"
                  onClick={() => addAmount(ml)}
                  disabled={logWater.isPending}
                  aria-label={`Add ${ml} millilitres of water`}
                  style={{
                    minHeight: 72,
                    flexDirection: 'column',
                    gap: 2,
                    padding: '10px 6px',
                    background: 'var(--accent-tint)',
                    color: 'var(--accent)',
                    opacity: logWater.isPending ? 0.6 : 1,
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 600, lineHeight: 1.1 }}>
                    +{ml}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>ml</span>
                </button>
              ))}
            </div>
            <form onSubmit={onSubmitCustom} style={{ marginTop: 'var(--space-ml)' }}>
              <label htmlFor="water-custom" style={{ display: 'block', marginBottom: 6 }}>
                <CapsLabel>Custom amount</CapsLabel>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 'var(--space-sm)' }}>
                <input
                  id="water-custom"
                  className="field-input"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  type="number"
                  inputMode="numeric"
                  placeholder="ml"
                />
                <PrimaryButton
                  type="submit"
                  loading={logWater.isPending}
                  disabled={!canSubmitCustom}
                  style={{ minHeight: 'var(--tap)', paddingInline: 22 }}
                >
                  Add
                </PrimaryButton>
              </div>
            </form>
            {error && (
              <div style={{ marginTop: 'var(--space-sm)' }}>
                <Banner tone="error">{error}</Banner>
              </div>
            )}
          </Card>
        </div>

        <Card padding="lg">
          <SectionHeader
            title="History"
            meta={entries.length ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} today` : undefined}
          />
          {logs.isLoading && <p className="empty-note">Loading…</p>}
          {!logs.isLoading && entries.length === 0 && (
            <p className="empty-note">No water logged yet.</p>
          )}
          <ul className="row-list">
            {entries.map((row) => {
              const time = formatTime(row.logged_at)
              return (
                <li key={row.id}>
                  <span className="row-dot" style={{ background: 'var(--water-fill)' }} aria-hidden="true" />
                  <div className="row-main">
                    <div className="row-title">{row.amount_ml.toLocaleString()} ml</div>
                    <div className="row-meta">{time}</div>
                  </div>
                  <IconButton
                    icon="trash"
                    tone="danger"
                    label={`Delete ${row.amount_ml} ml at ${time}`}
                    onClick={() => deleteLog.mutate(row.id)}
                    style={{ marginRight: -10 }}
                  />
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}
