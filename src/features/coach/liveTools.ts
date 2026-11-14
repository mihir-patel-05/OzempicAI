import { useSyncExternalStore } from 'react'
import type { CoachToolCall } from './types'

/**
 * What was seen live in this session, keyed by the saved assistant message it
 * belongs to. The server's history doesn't keep inserted ids or stream errors,
 * so this is what lets an action card offer Undo after the reply is saved (and
 * after visiting Plans and coming back), and keeps an error note on the reply
 * it interrupted. It lasts until the page reloads.
 */
interface LiveToolsState {
  byMessage: ReadonlyMap<string, CoachToolCall[]>
  errors: ReadonlyMap<string, string>
  undone: ReadonlySet<string>
}

let state: LiveToolsState = { byMessage: new Map(), errors: new Map(), undone: new Set() }
const listeners = new Set<() => void>()

function update(next: LiveToolsState) {
  state = next
  for (const listener of listeners) listener()
}

export function rememberLiveTurn(messageId: string, turn: { tools: CoachToolCall[]; error?: string }) {
  const byMessage = new Map(state.byMessage)
  const errors = new Map(state.errors)
  if (turn.tools.length > 0) byMessage.set(messageId, turn.tools)
  if (turn.error) errors.set(messageId, turn.error)
  update({ ...state, byMessage, errors })
}

export function markUndone(toolId: string) {
  const undone = new Set(state.undone)
  undone.add(toolId)
  update({ ...state, undone })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLiveTools(): LiveToolsState {
  return useSyncExternalStore(subscribe, () => state)
}
