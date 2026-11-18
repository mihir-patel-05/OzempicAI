import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dayRangeISO, parseDateKey, shiftDateKey, toLocalDateKey } from './date'

describe('parseDateKey', () => {
  it('reads a day key as local midnight', () => {
    const d = parseDateKey('2026-11-17')
    assert.ok(d)
    assert.equal(d.getFullYear(), 2026)
    assert.equal(d.getMonth(), 10)
    assert.equal(d.getDate(), 17)
    assert.equal(d.getHours(), 0)
  })

  it('rejects malformed and impossible dates', () => {
    assert.equal(parseDateKey(''), null)
    assert.equal(parseDateKey('2026-11-7'), null)
    assert.equal(parseDateKey('2026-02-30'), null)
    assert.equal(parseDateKey('2026-13-01'), null)
    assert.equal(parseDateKey('yesterday'), null)
  })
})

describe('dayRangeISO', () => {
  it('covers the whole local day', () => {
    const { startISO, endISO } = dayRangeISO('2026-11-17')
    const start = new Date(startISO)
    const end = new Date(endISO)
    assert.equal(toLocalDateKey(start), '2026-11-17')
    assert.equal(toLocalDateKey(end), '2026-11-17')
    assert.equal(start.getHours(), 0)
    assert.equal(end.getHours(), 23)
    assert.equal(end.getMinutes(), 59)
  })
})

describe('shiftDateKey', () => {
  it('moves by calendar days across month and year ends', () => {
    assert.equal(shiftDateKey('2026-11-17', -1), '2026-11-16')
    assert.equal(shiftDateKey('2026-12-31', 1), '2027-01-01')
    assert.equal(shiftDateKey('2026-03-01', -1), '2026-02-28')
    assert.equal(shiftDateKey('2024-03-01', -1), '2024-02-29')
  })
})
