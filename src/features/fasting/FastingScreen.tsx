import { useState } from 'react'
import { Banner } from '../../components/Banner'
import { Card } from '../../components/Card'
import { PageHeader } from '../../components/PageHeader'
import { useActiveFast, useFastHistory } from '../../hooks/useFasts'
import { useNow } from '../../hooks/useNow'
import type { Fast } from '../../types/db'
import { FastHistory } from './FastHistory'
import { FastingStats } from './FastingStats'
import { NotificationsCard } from './NotificationsCard'
import { RunningFastCard } from './RunningFastCard'
import { StartFastCard } from './StartFastCard'
import { DEFAULT_TARGET_MINUTES, goalLabel } from './presets'
import { fastProgress, formatDuration, formatWhen } from './progress'

export function FastingScreen() {
  const active = useActiveFast()
  const history = useFastHistory()
  const running = active.data ?? null
  // Every second while a fast runs; every minute is plenty otherwise.
  const now = useNow(running ? 1000 : 60_000)
  const [justEnded, setJustEnded] = useState<Fast | null>(null)

  const ended = (history.data ?? []).filter((fast) => fast.ended_at !== null)
  // Start from the goal used last time.
  const initialTarget = history.data?.[0]?.target_minutes ?? DEFAULT_TARGET_MINUTES
  const loading = active.isLoading || history.isLoading
  const error = active.error ?? history.error

  return (
    <div className="screen-stack">
      <PageHeader eyebrow="Intermittent fasting" title="Fasting" subtitle={subtitle(running, now)} />

      {error && <Banner tone="error">{error.message}</Banner>}

      <div className="tracker-grid">
        <div className="screen-stack">
          {loading ? (
            <Card padding="lg" radius="hero">
              <p className="empty-note" role="status">Loading…</p>
            </Card>
          ) : running ? (
            <RunningFastCard
              fast={running}
              now={now}
              onEnded={(fast) => setJustEnded(fast)}
            />
          ) : (
            <>
              {justEnded && (
                <Banner tone="info">
                  Fast saved: {formatDuration(fastProgress(justEnded, now).elapsedMs)}.
                </Banner>
              )}
              <StartFastCard initialTarget={initialTarget} />
            </>
          )}
          {history.data && <FastingStats fasts={history.data} now={now} />}
          <NotificationsCard />
        </div>

        <FastHistory fasts={ended} isLoading={history.isLoading} now={now} initialTarget={initialTarget} />
      </div>
    </div>
  )
}

function subtitle(running: Fast | null, now: number): string {
  if (!running) return 'Pick a goal, then start when you finish eating.'
  const p = fastProgress(running, now)
  if (p.reached) return 'Goal reached. End your fast whenever you’re ready.'
  return `${goalLabel(running.target_minutes)} fast · goal ${formatWhen(p.goalMs, now)}`
}
