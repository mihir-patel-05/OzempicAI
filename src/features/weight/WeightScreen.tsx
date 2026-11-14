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
  useDeleteWeightLog,
  useLogWeight,
  useRecentWeightLogs,
} from '../../hooks/useWeightLogs'
import { useUnitSystem } from '../../hooks/useUserProfile'
import type { UnitSystem } from '../../types/db'
import {
  roundForDisplay,
  weightFromKg,
  weightToKg,
  weightUnit,
} from '../../lib/units'

const HISTORY_PREVIEW = 5

export function WeightScreen() {
  const logs = useRecentWeightLogs()
  const logWeight = useLogWeight()
  const deleteLog = useDeleteWeightLog()
  const unitSystem = useUnitSystem()
  const unit = weightUnit(unitSystem)

  const [weight, setWeight] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const sorted = logs.data ?? []
  const latest = sorted[0]
  const previous = sorted[1]
  const delta = latest && previous ? latest.weight_kg - previous.weight_kg : null

  const weightNum = Number(weight)
  const canSubmit = Number.isFinite(weightNum) && weightNum > 0

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    try {
      await logWeight.mutateAsync(round2(weightToKg(weightNum, unitSystem)))
      setWeight('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log weight.')
    }
  }

  const visible = showAll ? sorted : sorted.slice(0, HISTORY_PREVIEW)
  const trend = sorted.slice(0, SPARK_POINTS).map((row) => row.weight_kg).reverse()
  const deltaDisplay = delta === null ? null : weightFromKg(delta, unitSystem)

  return (
    <div className="screen-stack">
      <ScreenHeader
        title="Weight"
        subtitle={latest ? `Last logged ${formatDate(latest.logged_at)}` : `Track your weight in ${unit}`}
      />

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
                    }}
                  >
                    {latest ? displayWeight(latest.weight_kg, unitSystem) : '—'}
                  </strong>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>{unit}</span>
                </div>
                <DeltaLine delta={deltaDisplay} hasLatest={!!latest} unit={unit} />
              </div>
              <Sparkline
                values={trend}
                color="var(--sage-deep)"
                label={`Weight trend over the last ${trend.length} entries`}
              />
            </div>
          </Card>

          <Card padding="lg">
            <form onSubmit={onSubmit}>
              <label htmlFor="weight-entry" style={{ display: 'block', marginBottom: 6 }}>
                <CapsLabel>New entry</CapsLabel>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 'var(--space-sm)' }}>
                <input
                  id="weight-entry"
                  className="field-input"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  placeholder={unit}
                />
                <PrimaryButton
                  type="submit"
                  loading={logWeight.isPending}
                  disabled={!canSubmit}
                  aria-label="Log weight"
                  style={{ minHeight: 'var(--tap)', paddingInline: 22 }}
                >
                  Log
                </PrimaryButton>
              </div>
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
            meta={sorted.length ? `${sorted.length} ${sorted.length === 1 ? 'entry' : 'entries'}` : undefined}
          />
          {logs.isLoading && <p className="empty-note">Loading…</p>}
          {!logs.isLoading && sorted.length === 0 && (
            <p className="empty-note">No weight logged yet.</p>
          )}
          <ul className="row-list">
            {visible.map((row) => {
              const value = `${displayWeight(row.weight_kg, unitSystem)} ${unit}`
              const date = formatDate(row.logged_at)
              return (
                <li key={row.id}>
                  <span className="row-dot" style={{ background: 'var(--sage-deep)' }} aria-hidden="true" />
                  <div className="row-main">
                    <div className="row-title">{value}</div>
                    <div className="row-meta">{date}</div>
                  </div>
                  <IconButton
                    icon="trash"
                    tone="danger"
                    label={`Delete ${value}, ${date}`}
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

function DeltaLine({ delta, hasLatest, unit }: { delta: number | null; hasLatest: boolean; unit: string }) {
  const flat = delta === null || Math.abs(delta) < 0.05
  const text =
    delta === null
      ? hasLatest
        ? 'First entry'
        : 'No entries yet'
      : flat
        ? 'No change since last entry'
        : `${delta < 0 ? '↓' : '↑'} ${round2(Math.abs(delta))} ${unit} since last entry`
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

function displayWeight(kg: number, unitSystem: UnitSystem): number {
  return roundForDisplay(weightFromKg(kg, unitSystem), 2)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
