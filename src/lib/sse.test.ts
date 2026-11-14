import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSseParser, type SseMessage } from './sse'

function collect() {
  const messages: SseMessage[] = []
  const parser = createSseParser((m) => messages.push(m))
  return { messages, parser }
}

test('parses events split across arbitrary chunks', () => {
  const { messages, parser } = collect()
  const stream = 'event: text\ndata: {"text":"Hel"}\n\nevent: text\ndata: {"text":"lo"}\n\nevent: done\ndata: {}\n\n'
  for (let i = 0; i < stream.length; i += 3) parser.push(stream.slice(i, i + 3))
  assert.deepEqual(messages, [
    { event: 'text', data: '{"text":"Hel"}' },
    { event: 'text', data: '{"text":"lo"}' },
    { event: 'done', data: '{}' },
  ])
})

test('handles CRLF, comments, multi-line data and a missing event name', () => {
  const { messages, parser } = collect()
  parser.push(': keep-alive\r\n\r\ndata: one\r\ndata: two\r\n\r\nevent:tight\ndata:x\n\n')
  assert.deepEqual(messages, [
    { event: 'message', data: 'one\ntwo' },
    { event: 'tight', data: 'x' },
  ])
})

test('end() flushes a trailing event without a blank line', () => {
  const { messages, parser } = collect()
  parser.push('event: done\ndata: {"ok":true}')
  assert.equal(messages.length, 0)
  parser.end()
  assert.deepEqual(messages, [{ event: 'done', data: '{"ok":true}' }])
})
