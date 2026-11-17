import { formatDuration } from './progress'

/** A goal of 1 to 72 hours. Matches the API and the check on public.fasts. */
export const MIN_TARGET_MINUTES = 60
export const MAX_TARGET_MINUTES = 72 * 60
export const DEFAULT_TARGET_MINUTES = 16 * 60

export interface FastPreset {
  id: string
  label: string
  minutes: number
  hint: string
}

const HOUR = 60

function eatingWindow(hours: number): FastPreset {
  return {
    id: `${hours}:${24 - hours}`,
    label: `${hours}:${24 - hours}`,
    minutes: hours * HOUR,
    hint: `${hours} h fast, ${24 - hours} h to eat`,
  }
}

export const FAST_PRESETS: readonly FastPreset[] = [
  eatingWindow(13),
  eatingWindow(16),
  eatingWindow(18),
  eatingWindow(20),
  { id: 'omad', label: 'OMAD', minutes: 23 * HOUR, hint: 'One meal a day' },
  { id: '36h', label: '36 h', minutes: 36 * HOUR, hint: 'A full day off eating' },
]

export function presetFor(minutes: number): FastPreset | null {
  return FAST_PRESETS.find((preset) => preset.minutes === minutes) ?? null
}

/** "16:8" for a preset goal, otherwise its length ("17h 30m"). */
export function goalLabel(minutes: number): string {
  return presetFor(minutes)?.label ?? formatDuration(minutes * 60_000)
}

export function isValidTarget(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= MIN_TARGET_MINUTES && minutes <= MAX_TARGET_MINUTES
}
