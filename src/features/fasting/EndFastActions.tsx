import { useState, type ReactNode } from 'react'
import { PrimaryButton } from '../../components/PrimaryButton'
import { useEndFast } from '../../hooks/useFasts'
import type { Fast } from '../../types/db'
import { goalLabel } from './presets'
import { fastProgress, formatDuration } from './progress'

interface EndFastActionsProps {
  fast: Fast
  now: number
  /** The button beside End (Edit, Details, …). */
  secondary: ReactNode
  onEnded?: (fast: Fast) => void
}

/**
 * End beside one other action. Ending before the goal asks first and says how
 * far short it is; after the goal it ends at once.
 */
export function EndFastActions({ fast, now, secondary, onEnded }: EndFastActionsProps) {
  const endFast = useEndFast()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const p = fastProgress(fast, now)

  async function end() {
    setError(null)
    try {
      const ended = await endFast.mutateAsync({ id: fast.id })
      if (ended) onEnded?.(ended)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not end your fast.')
      setConfirming(false)
    }
  }

  return (
    <div className="screen-stack" style={{ gap: 'var(--space-sm)' }}>
      {error && (
        <p role="alert" style={{ margin: 0, color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>
          {error}
        </p>
      )}
      {confirming && !p.reached ? (
        <>
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
        </>
      ) : (
        <div className="fasting-two-up">
          {secondary}
          <PrimaryButton type="button" loading={endFast.isPending} onClick={p.reached ? end : () => setConfirming(true)}>
            End fast
          </PrimaryButton>
        </div>
      )}
    </div>
  )
}
