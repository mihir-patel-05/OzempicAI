/**
 * Incremental parser for server-sent events read from a fetch() body.
 * EventSource can't send POST bodies or an Authorization header, so the
 * coach reads the stream itself and feeds the text through here.
 */
export interface SseMessage {
  event: string
  data: string
}

export interface SseParser {
  /** Feed the next decoded chunk; complete events are emitted synchronously. */
  push(chunk: string): void
  /** Flush a final event that wasn't followed by a blank line. */
  end(): void
}

export function createSseParser(onMessage: (message: SseMessage) => void): SseParser {
  let buffer = ''

  const dispatch = (block: string) => {
    let event = 'message'
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue // blank or comment
      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      // A single space after the colon is not part of the value.
      let value = colon === -1 ? '' : line.slice(colon + 1)
      if (value.startsWith(' ')) value = value.slice(1)
      if (field === 'event') event = value
      else if (field === 'data') data.push(value)
    }
    if (data.length > 0) onMessage({ event, data: data.join('\n') })
  }

  return {
    push(chunk) {
      buffer += chunk.replace(/\r\n?/g, '\n')
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        dispatch(buffer.slice(0, boundary))
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')
      }
    },
    end() {
      if (buffer.trim()) dispatch(buffer)
      buffer = ''
    },
  }
}
