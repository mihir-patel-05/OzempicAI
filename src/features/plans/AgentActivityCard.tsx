import { useState } from 'react'
import { Banner } from '../../components/Banner'
import { Card } from '../../components/Card'
import { SectionHeader } from '../../components/PageHeader'
import { PrimaryButton } from '../../components/PrimaryButton'
import { useAgentActivity, useUndoActivity } from '../../hooks/useAgentActivity'
import type { AgentActivity } from '../../hooks/useAgentActivity'
import { ApiError } from '../../lib/api'

const COLLAPSED = 5

/**
 * Plans → AI activity: changes connected AI apps (e.g. Claude on the phone)
 * made to meals, workouts and groceries, each with Undo. Hidden until there
 * is something to show.
 */
export function AgentActivityCard() {
  const activity = useAgentActivity()
  const undo = useUndoActivity()
  const [expanded, setExpanded] = useState(false)
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(null)

  const entries = activity.data ?? []
  if (entries.length === 0) return null
  const shown = expanded ? entries : entries.slice(0, COLLAPSED)

  function runUndo(entry: AgentActivity) {
    setFailed(null)
    undo.mutate(entry, {
      onError: (err) =>
        setFailed({
          id: entry.id,
          message: err instanceof ApiError && err.status === 409 ? err.message : 'Couldn’t undo this. Please try again.',
        }),
    })
  }

  return (
    <Card padding="lg">
      <SectionHeader title="AI activity" meta="Changes from connected AI apps" />
      <ul className="row-list">
        {shown.map((entry) => {
          const pending = undo.isPending && undo.variables?.id === entry.id
          return (
            <li key={entry.id} style={{ flexWrap: 'wrap' }}>
              <div className="row-main">
                <div
                  className="row-title"
                  style={entry.undone_at ? { textDecoration: 'line-through', color: 'var(--text-tertiary)' } : undefined}
                >
                  {entry.summary ?? describeTool(entry.tool_name)}
                </div>
                <div className="row-meta">
                  {entry.client_name} · {relative(entry.created_at)}
                  {entry.undone_at ? ' · Undone' : ''}
                </div>
              </div>
              {entry.can_undo && (
                <PrimaryButton
                  type="button"
                  variant="outline"
                  loading={pending}
                  disabled={undo.isPending}
                  onClick={() => runUndo(entry)}
                  style={smallButton}
                  aria-label={`Undo: ${entry.summary ?? describeTool(entry.tool_name)}`}
                >
                  Undo
                </PrimaryButton>
              )}
              {failed?.id === entry.id && (
                <div style={{ flexBasis: '100%' }}>
                  <Banner tone="error">{failed.message}</Banner>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {entries.length > COLLAPSED && (
        <button type="button" className="chip" onClick={() => setExpanded((v) => !v)} style={{ marginTop: 'var(--space-sm)' }}>
          {expanded ? 'Show less' : `Show all ${entries.length}`}
        </button>
      )}
    </Card>
  )
}

/** "update_grocery_items" → "Update grocery items" */
function describeTool(name: string): string {
  const words = name.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function relative(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const smallButton: React.CSSProperties = {
  minHeight: 36,
  padding: '0 12px',
  fontSize: 'var(--text-sm)',
  width: 'auto',
  flexShrink: 0,
}
