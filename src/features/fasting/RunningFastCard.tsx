import { useState } from 'react'
import { Card } from '../../components/Card'
import { PrimaryButton } from '../../components/PrimaryButton'
import type { Fast } from '../../types/db'
import { EndFastActions } from './EndFastActions'
import { FastForm } from './FastForm'
import { FastingTimer } from './FastingTimer'

interface RunningFastCardProps {
  fast: Fast
  now: number
  onEnded: (fast: Fast) => void
}

/** The live timer with Edit and End. */
export function RunningFastCard({ fast, now, onEnded }: RunningFastCardProps) {
  const [editing, setEditing] = useState(false)

  return (
    <Card padding="lg" radius="hero">
      <div className="screen-stack">
        <FastingTimer fast={fast} now={now} />
        {editing ? (
          <FastForm mode="edit" fast={fast} onDone={() => setEditing(false)} />
        ) : (
          <EndFastActions
            fast={fast}
            now={now}
            onEnded={onEnded}
            secondary={
              <PrimaryButton type="button" variant="outline" onClick={() => setEditing(true)}>
                Edit
              </PrimaryButton>
            }
          />
        )}
      </div>
    </Card>
  )
}
