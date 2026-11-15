import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../../components/Icon'

/** Matches MAX_MESSAGE_CHARS in server/src/routes/ai.ts. */
export const MAX_MESSAGE_CHARS = 4000
const MAX_ROWS_PX = 140

export interface ComposerHandle {
  focus(): void
}

interface ComposerProps {
  disabled?: boolean
  /** Text to start with, e.g. a draft passed in from another screen. */
  initialValue?: string
  onSend: (message: string) => void
}

/**
 * Message box pinned to the bottom of the chat. Enter sends and Shift+Enter
 * adds a line on a hardware keyboard; on a phone the send button is the way.
 */
export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { disabled, initialValue = '', onSend },
  ref,
) {
  const [value, setValue] = useState(initialValue.slice(0, MAX_MESSAGE_CHARS))
  const textarea = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => ({ focus: () => textarea.current?.focus() }), [])

  // Grow with the text up to a few lines, then scroll inside the box.
  useLayoutEffect(() => {
    const el = textarea.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_ROWS_PX)}px`
  }, [value])

  const trimmed = value.trim()
  const canSend = !disabled && trimmed.length > 0 && value.length <= MAX_MESSAGE_CHARS
  const remaining = MAX_MESSAGE_CHARS - value.length

  function submit() {
    if (!canSend) return
    onSend(trimmed)
    setValue('')
  }

  return (
    <form
      className="coach-composer"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <label htmlFor="coach-input" className="sr-only">
        Message your coach
      </label>
      <textarea
        id="coach-input"
        ref={textarea}
        className="coach-input"
        rows={1}
        value={value}
        maxLength={MAX_MESSAGE_CHARS}
        placeholder="Ask your coach…"
        enterKeyHint="send"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // Don't send while an IME is composing (e.g. Japanese input).
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            submit()
          }
        }}
      />
      {remaining < 200 && (
        <span className="coach-count" aria-live="polite">
          {remaining}
        </span>
      )}
      <button type="submit" className="coach-send" disabled={!canSend} aria-label="Send message">
        <Icon name="send" size={20} strokeWidth={2.4} />
      </button>
    </form>
  )
})
