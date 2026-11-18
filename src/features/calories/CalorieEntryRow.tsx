import { useRef, useState } from 'react'
import { IconButton } from '../../components/IconButton'
import { useUpdateCalorieLog } from '../../hooks/useCalorieLogs'
import type { CalorieLog } from '../../types/db'
import { parseCalories } from './calories'

interface CalorieEntryRowProps {
  row: CalorieLog
  tone: string
  time: string
  /** Whether this row shows its calories field. The screen keeps one row open at a time. */
  editing: boolean
  onEdit: () => void
  onDone: () => void
  onDelete: () => void
}

/** One logged food. Its calories can be changed in place; food, meal and time stay as logged. */
export function CalorieEntryRow({ row, tone, time, editing, onEdit, onDone, onDelete }: CalorieEntryRowProps) {
  const update = useUpdateCalorieLog()
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const editButton = useRef<HTMLButtonElement>(null)

  function start() {
    setDraft(String(row.calories))
    setError(null)
    onEdit()
  }

  function finish() {
    setError(null)
    onDone()
    // Put focus back where it was before the field opened.
    requestAnimationFrame(() => editButton.current?.focus())
  }

  async function save() {
    if (update.isPending) return
    const calories = parseCalories(draft)
    if (calories === null) {
      setError('Enter calories from 1 to 100,000.')
      return
    }
    if (calories === row.calories) {
      finish()
      return
    }
    try {
      await update.mutateAsync({ id: row.id, calories })
      finish()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save.')
    }
  }

  return (
    <li>
      <span className="row-dot" style={{ background: tone }} aria-hidden="true" />
      <div className="row-main">
        <div className="row-title">{row.food_name}</div>
        {editing && error ? (
          <div className="row-meta" role="alert" style={{ color: 'var(--danger)' }}>
            {error}
          </div>
        ) : (
          <div className="row-meta">{time}</div>
        )}
      </div>
      {editing ? (
        <>
          <label className="row-edit-field">
            <input
              className="field-input"
              type="number"
              inputMode="numeric"
              min={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void save()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  finish()
                }
              }}
              aria-label={`Calories for ${row.food_name} at ${time}`}
              aria-invalid={error ? true : undefined}
              disabled={update.isPending}
              autoFocus
            />
            <span aria-hidden="true">kcal</span>
          </label>
          <IconButton
            icon="check"
            label={`Save calories for ${row.food_name}`}
            onClick={() => void save()}
            disabled={update.isPending}
          />
          <IconButton
            icon="close"
            label="Cancel editing"
            onClick={finish}
            disabled={update.isPending}
            style={{ marginRight: -10 }}
          />
        </>
      ) : (
        <>
          <span className="row-value">{row.calories} kcal</span>
          <IconButton
            ref={editButton}
            icon="pencil"
            label={`Edit calories for ${row.food_name} at ${time}`}
            onClick={start}
          />
          <IconButton
            icon="trash"
            tone="danger"
            label={`Delete ${row.food_name} at ${time}`}
            onClick={onDelete}
            style={{ marginRight: -10 }}
          />
        </>
      )}
    </li>
  )
}
