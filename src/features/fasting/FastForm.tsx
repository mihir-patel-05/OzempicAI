import { useState } from 'react'
import { Banner } from '../../components/Banner'
import { Field } from '../../components/Field'
import { PrimaryButton } from '../../components/PrimaryButton'
import { useDeleteFast, useLogPastFast, useUpdateFast } from '../../hooks/useFasts'
import { fromLocalInputValue, toLocalInputValue } from '../../lib/date'
import type { Fast } from '../../types/db'
import { GoalPicker } from './GoalPicker'

/** Slack for a device clock a little ahead of the server's; matches the API. */
const CLOCK_SLACK_MS = 60_000
const MAX_NOTES = 2000

type FastFormProps =
  | { mode: 'edit'; fast: Fast; onDone: () => void }
  | { mode: 'add'; initialTarget: number; onDone: () => void }

/**
 * Edit a fast (a running one has no end), or add one that already finished.
 * Times are minute-precise inputs; an untouched time is not sent, so editing
 * notes never nudges a start time by its seconds.
 */
export function FastForm(props: FastFormProps) {
  const updateFast = useUpdateFast()
  const logPastFast = useLogPastFast()
  const deleteFast = useDeleteFast()

  const fast = props.mode === 'edit' ? props.fast : null
  const running = fast !== null && fast.ended_at === null
  const [initial] = useState(() => {
    const now = Date.now()
    return {
      target: fast?.target_minutes ?? (props.mode === 'add' ? props.initialTarget : 0),
      start: toLocalInputValue(fast ? Date.parse(fast.started_at) : now - (props.mode === 'add' ? props.initialTarget : 0) * 60_000),
      end: toLocalInputValue(fast?.ended_at ? Date.parse(fast.ended_at) : now),
    }
  })

  const [target, setTarget] = useState<number | null>(initial.target)
  const [start, setStart] = useState(initial.start)
  const [end, setEnd] = useState(initial.end)
  const [notes, setNotes] = useState(fast?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  const startMs = fromLocalInputValue(start)
  const endMs = running ? null : fromLocalInputValue(end)
  const latest = Date.now() + CLOCK_SLACK_MS
  const problem =
    target === null
      ? null // GoalPicker explains this one.
      : startMs === null
        ? 'Enter when the fast started.'
        : startMs > latest
          ? "The start can't be in the future."
          : running
            ? null
            : endMs === null
              ? 'Enter when the fast ended.'
              : endMs > latest
                ? "The end can't be in the future."
                : endMs <= startMs
                  ? 'The end has to be after the start.'
                  : null
  const saving = updateFast.isPending || logPastFast.isPending
  const canSave = target !== null && problem === null && notes.length <= MAX_NOTES

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave || target === null || startMs === null) return
    setError(null)
    const cleanNotes = notes.trim() === '' ? null : notes.trim()
    try {
      if (props.mode === 'add') {
        await logPastFast.mutateAsync({
          target_minutes: target,
          started_at: new Date(startMs).toISOString(),
          ended_at: new Date(endMs!).toISOString(),
          notes: cleanNotes,
        })
      } else {
        await updateFast.mutateAsync({
          id: props.fast.id,
          target_minutes: target,
          notes: cleanNotes,
          ...(start !== initial.start ? { started_at: new Date(startMs).toISOString() } : {}),
          ...(!running && end !== initial.end ? { ended_at: new Date(endMs!).toISOString() } : {}),
        })
      }
      props.onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this fast.')
    }
  }

  async function onDelete() {
    if (!fast) return
    if (!window.confirm(running ? 'Discard this fast? It won’t be saved.' : 'Delete this fast? This can’t be undone.')) return
    setError(null)
    try {
      await deleteFast.mutateAsync(fast.id)
      props.onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this fast.')
    }
  }

  const max = toLocalInputValue(Date.now())

  return (
    <form onSubmit={onSave} className="screen-stack" aria-label={props.mode === 'add' ? 'Add a past fast' : 'Edit fast'}>
      <GoalPicker initialMinutes={initial.target} onChange={setTarget} />
      <div className={running ? undefined : 'fasting-two-up'}>
        <Field label="Started" type="datetime-local" value={start} onChange={setStart} max={max} required />
        {!running && <Field label="Ended" type="datetime-local" value={end} onChange={setEnd} max={max} required />}
      </div>
      <Field
        label="Notes"
        value={notes}
        onChange={setNotes}
        maxLength={MAX_NOTES}
        placeholder="Optional"
        autoCapitalize="sentences"
        autoCorrect="on"
        spellCheck
      />
      {problem && <p className="fasting-hint" role="alert" style={{ margin: 0 }}>{problem}</p>}
      {error && <Banner tone="error">{error}</Banner>}
      <div className="fasting-two-up">
        <PrimaryButton type="button" variant="outline" onClick={props.onDone}>
          Cancel
        </PrimaryButton>
        <PrimaryButton type="submit" loading={saving} disabled={!canSave}>
          {props.mode === 'add' ? 'Add fast' : 'Save'}
        </PrimaryButton>
      </div>
      {fast && (
        <button
          type="button"
          className="text-button"
          onClick={onDelete}
          disabled={deleteFast.isPending}
          style={{ alignSelf: 'center', color: 'var(--danger)' }}
        >
          {running ? 'Discard this fast' : 'Delete this fast'}
        </button>
      )}
    </form>
  )
}
