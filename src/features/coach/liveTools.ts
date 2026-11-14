import { useSyncExternalStore } from 'react'
import type { CoachToolCall } from './types'

/**
 * Tool calls seen live in this session, keyed by the saved assistant message
 * they belong to. The server's history doesn't keep inserted ids, so this is
 * what lets an action card offer Undo after the reply is saved, and after
 * visiting Plans and coming back. It lasts until the page reloads.
 */
interface LiveToolsState {
  byMessage: ReadonlyMap<string, CoachToolCall[]>
  undone: ReadonlySet<string>
}

let state: LiveToolsState = { byMessage: new Map(), undone: new Set() }
const listeners = new Set<() => void>()

function update(next: LiveToolsState) {
  state = next
  for (const listener of listeners) listener()
}

export function rememberLiveTools(messageId: string, tools: CoachToolCall[]) {
  if (tools.length === 0) return
  const byMessage = new Map(state.byMessage)
  byMessage.set(messageId, tools)
  update({ ...state, byMessage })
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
