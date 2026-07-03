import { useState } from 'react'
import { Card } from '../../components/Card'
import { Field } from '../../components/Field'
import { PrimaryButton } from '../../components/PrimaryButton'
import { Banner } from '../../components/Banner'
import { ScreenHeader } from '../../components/ScreenHeader'
import {
  useDeleteWeightLog,
  useLogWeight,
  useRecentWeightLogs,
} from '../../hooks/useWeightLogs'

export function WeightScreen() {
  const logs = useRecentWeightLogs()
  const logWeight = useLogWeight()
  const deleteLog = useDeleteWeightLog()

  const [weight, setWeight] = useState('')
  const [error, setError] = useState<string | null>(null)

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
      await logWeight.mutateAsync(round2(weightNum))
      setWeight('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log weight.')
    }
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
    >
      <ScreenHeader title="Weight" subtitle="Recent entries" />

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
              color: 'var(--text-primary)',
            }}
          >
            {latest ? round2(latest.weight_kg) : '—'}
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>kg</span>
          {delta !== null && (
            <DeltaPill delta={delta} />
          )}
        </div>
        {latest && (
          <div
            style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}
          >
            Logged {formatDate(latest.logged_at)}
          </div>
        )}
      </Card>

      <Card padding="md">
        <form
          onSubmit={onSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
        >
          <Field
            label="New entry"
            value={weight}
            onChange={setWeight}
            type="number"
            inputMode="decimal"
            placeholder="kg"
          />
          {error && <Banner tone="error">{error}</Banner>}
          <PrimaryButton
            type="submit"
            loading={logWeight.isPending}
            disabled={!canSubmit}
          >
            Log weight
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
            No weight logged yet.
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
                  {round2(row.weight_kg)} kg
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {formatDate(row.logged_at)}
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

function DeltaPill({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.05) return null
  const up = delta > 0
  const color = up ? 'var(--ember)' : 'var(--sage-deep)'
  const sign = up ? '+' : ''
  return (
    <span
      style={{
        marginLeft: 4,
        fontSize: 13,
        fontWeight: 600,
        color,
      }}
    >
      {sign}
      {round2(delta)} kg
    </span>
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
