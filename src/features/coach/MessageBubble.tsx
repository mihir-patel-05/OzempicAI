import { MessageText } from './MessageText'
import { ToolCard } from './ToolCard'
import { toolActivity } from './toolText'
import type { CoachMessage, CoachToolCall } from './types'

interface MessageBubbleProps {
  message: CoachMessage
  /** Tool calls to show; live ones (with ids) replace the saved ones. */
  tools?: CoachToolCall[]
  error?: string
  /** The reply is still streaming in. */
  streaming?: boolean
  activeTool?: string | null
}

export function MessageBubble({ message, tools, error, streaming = false, activeTool = null }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="coach-row is-user">
        <div className="coach-bubble is-user">{message.text}</div>
      </div>
    )
  }

  const calls = tools ?? message.tools
  const waiting = streaming && !message.text && !activeTool
  const working = streaming && (activeTool || waiting)

  return (
    <div className="coach-row is-assistant">
      <div className="coach-bubble is-assistant" aria-busy={streaming || undefined}>
        {message.text && <MessageText text={message.text} />}
        {calls.length > 0 && (
          <div className="coach-tool-list">
            {calls.map((call, i) => (
              <ToolCard key={call.id ?? `${call.name}-${i}`} call={call} />
            ))}
          </div>
        )}
        {working && (
          <p className="coach-activity" role="status">
            <span className="coach-typing" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            {waiting ? <span className="sr-only">Your coach is typing</span> : toolActivity(activeTool)}
          </p>
        )}
        {error && !streaming && (
          <p className="coach-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
