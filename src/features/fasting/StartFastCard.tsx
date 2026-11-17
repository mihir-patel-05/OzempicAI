import { useState } from 'react'
import { Banner } from '../../components/Banner'
import { Card } from '../../components/Card'
import { Field } from '../../components/Field'
import { PrimaryButton } from '../../components/PrimaryButton'
import { useStartFast } from '../../hooks/useFasts'
import { useNow } from '../../hooks/useNow'
import { fromLocalInputValue, toLocalInputValue } from '../../lib/date'
import { GoalPicker } from './GoalPicker'
import { goalLabel } from './presets'
import { formatWhen } from './progress'

/** Slack for a device clock a little ahead of the server's; matches the API. */
const CLOCK_SLACK_MS = 60_000

/** Pick a goal and start now, or from earlier if eating stopped a while ago. */
export function StartFastCard({ initialTarget }: { initialTarget: number }) {
  const startFast = useStartFast()
  const now = useNow(60_000)
  const [target, setTarget] = useState<number | null>(initialTarget)
  const [backdate, setBackdate] = useState(false)
  const [startedAt, setStartedAt] = useState(() => toLocalInputValue(Date.now()))
  const [error, setError] = useState<string | null>(null)

  const startMs = backdate ? fromLocalInputValue(startedAt) : now
  const startProblem =
    startMs === null ? 'Enter when you started.' : startMs > Date.now() + CLOCK_SLACK_MS ? "The start can't be in the future." : null
  const canStart = target !== null && !startProblem

  async function onStart(e: React.FormEvent) {
    e.preventDefault()
    if (!canStart || target === null) return
    setError(null)
    try {
      await startFast.mutateAsync({
        target_minutes: target,
        ...(backdate && startMs !== null ? { started_at: new Date(startMs).toISOString() } : {}),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start your fast.')
    }
  }

  return (
    <Card padding="lg" radius="hero">
      <form onSubmit={onStart} className="screen-stack">
        <GoalPicker initialMinutes={initialTarget} onChange={setTarget} />

        {backdate ? (
          <Field
            label="Started at"
            type="datetime-local"
            value={startedAt}
            onChange={setStartedAt}
            max={toLocalInputValue(now)}
            hint={startProblem ?? undefined}
          />
        ) : (
          <button type="button" className="text-button" style={{ alignSelf: 'flex-start' }} onClick={() => setBackdate(true)}>
            Started earlier? Set the start time
          </button>
        )}

        {target !== null && startMs !== null && !startProblem && (
          <p className="fasting-hint" style={{ margin: 0 }}>
            Goal at <strong>{formatWhen(startMs + target * 60_000, now)}</strong>
          </p>
        )}

        {error && <Banner tone="error">{error}</Banner>}

        <PrimaryButton type="submit" loading={startFast.isPending} disabled={!canStart} style={{ width: '100%' }}>
          {target === null ? 'Start fast' : `Start ${goalLabel(target)} fast`}
        </PrimaryButton>
      </form>
    </Card>
  )
}
