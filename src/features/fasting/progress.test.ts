import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fromLocalInputValue, toLocalInputValue } from '../../lib/date'
import { FAST_PRESETS, goalLabel, isValidTarget, presetFor } from './presets'
import { dayOffset, fastProgress, formatClock, formatDuration, formatWhen } from './progress'

const HOUR = 3_600_000
const START = Date.parse('2026-11-16T20:00:00Z')
const iso = (ms: number) => new Date(ms).toISOString()

describe('fastProgress', () => {
  it('counts down to the goal while running', () => {
    const p = fastProgress({ started_at: iso(START), target_minutes: 16 * 60, ended_at: null }, START + 12 * HOUR)
    assert.equal(p.elapsedMs, 12 * HOUR)
    assert.equal(p.remainingMs, 4 * HOUR)
    assert.equal(p.overtimeMs, 0)
    assert.equal(p.reached, false)
    assert.equal(p.fraction, 0.75)
    assert.equal(p.goalMs, START + 16 * HOUR)
  })

  it('counts overtime past the goal and keeps the ring full', () => {
    const p = fastProgress({ started_at: iso(START), target_minutes: 16 * 60, ended_at: null }, START + 17.5 * HOUR)
    assert.equal(p.reached, true)
    assert.equal(p.remainingMs, 0)
    assert.equal(p.overtimeMs, 1.5 * HOUR)
    assert.equal(p.fraction, 1)
  })

  it('stops at the end of an ended fast, whatever the time now', () => {
    const p = fastProgress(
      { started_at: iso(START), target_minutes: 16 * 60, ended_at: iso(START + 14 * HOUR) },
      START + 100 * HOUR,
    )
    assert.equal(p.elapsedMs, 14 * HOUR)
    assert.equal(p.reached, false)
    assert.equal(p.remainingMs, 2 * HOUR)
  })

  it('never goes negative if the device clock is behind the start', () => {
    const p = fastProgress({ started_at: iso(START), target_minutes: 60, ended_at: null }, START - 30_000)
    assert.equal(p.elapsedMs, 0)
    assert.equal(p.fraction, 0)
  })
})

describe('formatting', () => {
  it('shows a stopwatch reading', () => {
    assert.equal(formatClock(0), '00:00:00')
    assert.equal(formatClock(4 * HOUR + 17 * 60_000 + 52_999), '04:17:52')
    assert.equal(formatClock(36 * HOUR), '36:00:00')
    assert.equal(formatClock(-5), '00:00:00')
  })

  it('shows a length in hours and minutes', () => {
    assert.equal(formatDuration(16 * HOUR), '16h')
    assert.equal(formatDuration(16 * HOUR + 12 * 60_000 + 59_000), '16h 12m')
    assert.equal(formatDuration(45 * 60_000), '45m')
    assert.equal(formatDuration(0), '0m')
  })

  it('names nearby days', () => {
    const now = new Date(2026, 10, 17, 9, 0).getTime()
    assert.equal(dayOffset(new Date(2026, 10, 17, 23, 59).getTime(), now), 0)
    assert.equal(dayOffset(new Date(2026, 10, 18, 0, 1).getTime(), now), 1)
    assert.equal(dayOffset(new Date(2026, 10, 16, 20, 0).getTime(), now), -1)
    assert.equal(dayOffset(new Date(2026, 11, 1, 12, 0).getTime(), now), 14)
    assert.match(formatWhen(new Date(2026, 10, 18, 12, 30).getTime(), now), /^tomorrow, /)
    assert.match(formatWhen(new Date(2026, 10, 17, 20, 30).getTime(), now), /^today, /)
    assert.doesNotMatch(formatWhen(new Date(2026, 10, 20, 12, 30).getTime(), now), /^(today|tomorrow|yesterday)/)
  })
})

describe('presets', () => {
  it('labels preset goals by name and others by length', () => {
    assert.equal(goalLabel(16 * 60), '16:8')
    assert.equal(goalLabel(23 * 60), 'OMAD')
    assert.equal(goalLabel(17 * 60 + 30), '17h 30m')
    assert.equal(presetFor(17 * 60), null)
  })

  it('only offers goals the API accepts', () => {
    for (const preset of FAST_PRESETS) assert.ok(isValidTarget(preset.minutes), preset.label)
    assert.equal(isValidTarget(59), false)
    assert.equal(isValidTarget(72 * 60), true)
    assert.equal(isValidTarget(72 * 60 + 1), false)
    assert.equal(isValidTarget(90.5), false)
  })
})

describe('datetime-local values', () => {
  it('round-trip to the minute in local time', () => {
    const ms = new Date(2026, 10, 17, 20, 30, 45).getTime()
    assert.equal(toLocalInputValue(ms), '2026-11-17T20:30')
    assert.equal(fromLocalInputValue('2026-11-17T20:30'), new Date(2026, 10, 17, 20, 30).getTime())
  })

  it('reject blank and malformed values', () => {
    assert.equal(fromLocalInputValue(''), null)
    assert.equal(fromLocalInputValue('yesterday'), null)
    assert.equal(fromLocalInputValue('2026-13-45T99:99'), null)
  })
})
