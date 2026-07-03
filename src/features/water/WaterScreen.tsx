import { useState } from 'react'
import { Card } from '../../components/Card'
import { Field } from '../../components/Field'
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

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
    >
      <ScreenHeader
        title="Water"
        subtitle={`${total} of ${goal} ml · ${remaining} ml to go`}
      />

      <Card padding="md">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${QUICK_AMOUNTS.length}, 1fr)`,
            gap: 'var(--space-sm)',
            marginBottom: 'var(--space-md)',
          }}
        >
          {QUICK_AMOUNTS.map((ml) => (
            <button
              key={ml}
              type="button"
              onClick={() => addAmount(ml)}
              disabled={logWater.isPending}
              style={{
                background: 'var(--cream-dim)',
                color: 'var(--accent)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 8px',
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 600,
                opacity: logWater.isPending ? 0.6 : 1,
              }}
            >
              +{ml}
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-ui)', marginTop: 2 }}>
                ml
              </div>
            </button>
          ))}
        </div>
        <form
          onSubmit={onSubmitCustom}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}
        >
          <Field
            label="Custom amount"
            value={custom}
            onChange={setCustom}
            type="number"
            inputMode="numeric"
            placeholder="ml"
          />
          <PrimaryButton
            type="submit"
            loading={logWater.isPending}
            disabled={!canSubmitCustom}
            variant="outline"
          >
            Add
          </PrimaryButton>
        </form>
        {error && (
          <div style={{ marginTop: 'var(--space-sm)' }}>
            <Banner tone="error">{error}</Banner>
          </div>
        )}
      </Card>

      <Card padding="md">
        <CapsRow label="Today" value={`${(logs.data ?? []).length} entries`} />
        {logs.isLoading && (
          <p style={{ margin: '8px 0 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
            Loading…
          </p>
        )}
        {!logs.isLoading && (logs.data?.length ?? 0) === 0 && (
          <p style={{ margin: '8px 0 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
            No water logged yet.
          </p>
        )}
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '8px 0 0',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {(logs.data ?? []).map((row) => (
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
                  {row.amount_ml} ml
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {formatTime(row.logged_at)}
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

function CapsRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span
        style={{
          fontSize: 11,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{value}</span>
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}
