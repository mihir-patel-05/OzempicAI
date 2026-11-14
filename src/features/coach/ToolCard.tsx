import { Link } from 'react-router-dom'
import { Icon } from '../../components/Icon'
import { useUndoToolCall } from '../../hooks/useCoach'
import { useLiveTools } from './liveTools'
import { WRITE_TOOLS } from './toolText'
import type { CoachToolCall } from './types'

/**
 * Inline card for a change the coach made: "Added 9 items to Groceries ·
 * View · Undo". Undo is offered only for calls seen live in this session,
 * because only those carry the ids of the rows that were inserted.
 */
export function ToolCard({ call }: { call: CoachToolCall }) {
  const { undone } = useLiveTools()
  const undo = useUndoToolCall()
  const meta = WRITE_TOOLS[call.name]
  if (!meta) return null

  const view = (
    <Link to={`/plans?tab=${meta.tab}`} className="text-button">
      View
    </Link>
  )

  if (call.status === 'error') {
    return (
      <div className="coach-tool-card is-error">
        <span className="coach-tool-icon" aria-hidden="true">
          <Icon name="close" size={15} strokeWidth={2.4} />
        </span>
        <span className="coach-tool-main">Couldn&rsquo;t update your {meta.label}</span>
      </div>
    )
  }

  const isUndone = !!call.id && undone.has(call.id)
  const canUndo = !!call.id && (call.created_ids?.length ?? 0) > 0 && !isUndone

  return (
    <div className={`coach-tool-card${isUndone ? ' is-undone' : ''}`}>
      <span className="coach-tool-icon" aria-hidden="true">
        <Icon name={isUndone ? 'undo' : 'check'} size={15} strokeWidth={2.4} />
      </span>
      <span className="coach-tool-main">
        <span>{isUndone ? `Undone: ${call.summary ?? 'change removed'}` : call.summary}</span>
        {undo.isError && <span className="coach-tool-note">Undo failed. Try again, or delete it in Plans.</span>}
      </span>
      {view}
      {canUndo && (
        <button
          type="button"
          className="text-button"
          onClick={() => undo.mutate(call)}
          disabled={undo.isPending}
          aria-label={`Undo: ${call.summary ?? 'this change'}`}
        >
          {undo.isPending ? 'Undoing…' : 'Undo'}
        </button>
      )}
    </div>
  )
}
