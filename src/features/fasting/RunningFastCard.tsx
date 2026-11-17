import { useState } from 'react'
import { Banner } from '../../components/Banner'
import { Card } from '../../components/Card'
import { PrimaryButton } from '../../components/PrimaryButton'
import { useEndFast } from '../../hooks/useFasts'
import type { Fast } from '../../types/db'
import { FastingTimer } from './FastingTimer'
import { goalLabel } from './presets'
import { fastProgress, formatDuration } from './progress'

interface RunningFastCardProps {
  fast: Fast
  now: number
  onEnded: (fast: Fast) => void
}

/** The live timer with End. Ending before the goal asks first. */
export function RunningFastCard({ fast, now, onEnded }: RunningFastCardProps) {
  const endFast = useEndFast()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const p = fastProgress(fast, now)

  async function end() {
    setError(null)
    try {
      const ended = await endFast.mutateAsync({ id: fast.id })
      if (ended) onEnded(ended)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not end your fast.')
      setConfirming(false)
    }
  }

  return (
    <Card padding="lg" radius="hero">
      <div className="screen-stack">
        <FastingTimer fast={fast} now={now} />

        {error && <Banner tone="error">{error}</Banner>}

        {confirming && !p.reached ? (
          <div className="screen-stack" style={{ gap: 'var(--space-sm)' }}>
            <p role="alert" style={{ margin: 0, textAlign: 'center', fontSize: 'var(--text-sm)' }}>
              End now? You're {formatDuration(p.remainingMs)} short of your {goalLabel(fast.target_minutes)} goal.
            </p>
            <div className="fasting-two-up">
              <PrimaryButton type="button" variant="outline" onClick={() => setConfirming(false)}>
                Keep going
              </PrimaryButton>
              <PrimaryButton type="button" tone="danger" loading={endFast.isPending} onClick={end}>
                End fast
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <PrimaryButton
            type="button"
            loading={endFast.isPending}
            onClick={p.reached ? end : () => setConfirming(true)}
            style={{ width: '100%' }}
          >
            End fast
          </PrimaryButton>
        )}
      </div>
    </Card>
  )
}
