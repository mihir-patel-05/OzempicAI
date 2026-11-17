import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Fast } from '../../types/db'
import { dailyFasting, dayKeys, streaks, summarize } from './stats'

// Local times, so these hold in any timezone the tests run in.
const at = (month: number, day: number, hour: number, minute = 0) => new Date(2026, month - 1, day, hour, minute).getTime()
const HOUR = 3_600_000
let nextId = 0

/** A fast ending at `end` that lasted `hours`, against a goal of `goalHours`. */
function fast(end: number, hours: number, goalHours = 16): Fast {
  return {
    id: String(nextId++),
    started_at: new Date(end - hours * HOUR).toISOString(),
    ended_at: new Date(end).toISOString(),
    target_minutes: goalHours * 60,
    notes: null,
    created_at: '',
  }
}

const NOW = at(11, 17, 15) // Tue Nov 17, 3 PM

describe('dayKeys', () => {
  it('lists the last n local days ending today', () => {
    assert.deepEqual(dayKeys(NOW, 3), ['2026-11-15', '2026-11-16', '2026-11-17'])
  })

  it('keeps whole days across a daylight-saving change', () => {
    // US clocks go back on Nov 1, 2026; elsewhere this is an ordinary week.
    const keys = dayKeys(at(11, 4, 12), 7)
    assert.deepEqual(keys, ['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'])
  })
})

describe('streaks', () => {
  it('counts consecutive days with a goal met, up to today', () => {
    const fasts = [fast(at(11, 17, 12), 16), fast(at(11, 16, 12), 17), fast(at(11, 15, 12), 16)]
    assert.deepEqual(streaks(fasts, NOW), { current: 3, best: 3 })
  })

  it('does not break the streak just because today has no fast yet', () => {
    const fasts = [fast(at(11, 16, 12), 16), fast(at(11, 15, 12), 16)]
    assert.equal(streaks(fasts, NOW).current, 2)
  })

  it('ends at a missed day or a fast that fell short, and remembers the best run', () => {
    const fasts = [
      fast(at(11, 17, 12), 16),
      fast(at(11, 16, 12), 10), // short of 16 h
      fast(at(11, 12, 12), 16),
      fast(at(11, 11, 12), 16),
      fast(at(11, 10, 12), 16),
      fast(at(11, 9, 12), 16),
    ]
    assert.deepEqual(streaks(fasts, NOW), { current: 1, best: 4 })
  })

  it('counts a fast toward the day it ended, not the day it started', () => {
    // 8 PM Sunday to noon Monday, and 8 PM Monday to noon Tuesday: Monday and Tuesday.
    const fasts = [fast(at(11, 16, 12), 16), fast(at(11, 17, 12), 16)]
    assert.equal(streaks(fasts, NOW).current, 2)
  })

  it('is zero with nothing met, and ignores the running fast', () => {
    const running: Fast = { ...fast(NOW, 20), ended_at: null }
    assert.deepEqual(streaks([running, fast(at(11, 16, 12), 3)], NOW), { current: 0, best: 0 })
  })
})

describe('summarize', () => {
  const fasts = [
    fast(at(11, 17, 12), 16),
    fast(at(11, 15, 12), 20, 18),
    fast(at(11, 12, 9), 12), // short
    fast(at(10, 20, 12), 18), // 28 days back: in 30 and 90
    fast(at(9, 1, 12), 16), // only in 90
  ]

  it('covers fasts that ended in the range', () => {
    const week = summarize(fasts, NOW, 7)
    assert.equal(week.count, 3)
    assert.equal(week.goalsMet, 2)
    assert.equal(week.goalRate, 2 / 3)
    assert.equal(week.averageMs, 16 * HOUR)
    assert.equal(week.longestMs, 20 * HOUR)
    assert.equal(week.totalMs, 48 * HOUR)

    assert.equal(summarize(fasts, NOW, 30).count, 4)
    assert.equal(summarize(fasts, NOW, 90).count, 5)
  })

  it('has no averages with no fasts', () => {
    const empty = summarize([], NOW, 7)
    assert.deepEqual(empty, { count: 0, goalsMet: 0, goalRate: null, averageMs: null, longestMs: null, totalMs: 0 })
  })
})

describe('dailyFasting', () => {
  it('has a row per day with gaps for days without a fast', () => {
    const rows = dailyFasting([fast(at(11, 17, 12), 16.5), fast(at(11, 15, 12), 12, 18)], NOW, 3)
    assert.deepEqual(rows, [
      { day: '2026-11-15', hours: 12, goalHours: 18, met: false, fasts: 1 },
      { day: '2026-11-16', hours: null, goalHours: null, met: null, fasts: 0 },
      { day: '2026-11-17', hours: 16.5, goalHours: 16, met: true, fasts: 1 },
    ])
  })

  it('adds up two fasts that ended the same day', () => {
    const rows = dailyFasting([fast(at(11, 17, 6), 13, 13), fast(at(11, 17, 14), 4, 1)], NOW, 1)
    assert.deepEqual(rows, [{ day: '2026-11-17', hours: 17, goalHours: 13, met: true, fasts: 2 }])
  })
})
