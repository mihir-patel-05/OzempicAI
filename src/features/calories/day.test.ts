import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { toLocalDateKey } from '../../lib/date'
import { atTimeOn, dayLabel, dayPhrase, resolveDayParam } from './day'

const TODAY = '2026-11-18'

describe('resolveDayParam', () => {
  it('uses a valid past day', () => {
    assert.equal(resolveDayParam('2026-11-10', TODAY), '2026-11-10')
    assert.equal(resolveDayParam(TODAY, TODAY), TODAY)
  })

  it('falls back to today for missing, bad or future days', () => {
    assert.equal(resolveDayParam(null, TODAY), TODAY)
    assert.equal(resolveDayParam('', TODAY), TODAY)
    assert.equal(resolveDayParam('nope', TODAY), TODAY)
    assert.equal(resolveDayParam('2026-02-30', TODAY), TODAY)
    assert.equal(resolveDayParam('2026-11-19', TODAY), TODAY)
  })
})

describe('dayLabel and dayPhrase', () => {
  it('names today and yesterday', () => {
    assert.equal(dayLabel(TODAY, TODAY), 'Today')
    assert.equal(dayLabel('2026-11-17', TODAY), 'Yesterday')
    assert.equal(dayPhrase(TODAY, TODAY), 'today')
    assert.equal(dayPhrase('2026-11-17', TODAY), 'yesterday')
  })

  it('names older days by date, with the year only when it differs', () => {
    const thisYear = dayLabel('2026-11-10', TODAY)
    assert.match(thisYear, /10/)
    assert.doesNotMatch(thisYear, /2026/)
    assert.match(dayLabel('2025-12-31', TODAY), /2025/)
    assert.equal(dayPhrase('2026-11-10', TODAY), `on ${thisYear}`)
  })
})

describe('atTimeOn', () => {
  it('puts a time on the chosen local day', () => {
    const d = atTimeOn('2026-11-10', '19:45')
    assert.ok(d)
    assert.equal(toLocalDateKey(d), '2026-11-10')
    assert.equal(d.getHours(), 19)
    assert.equal(d.getMinutes(), 45)
  })

  it('rejects a bad time or day', () => {
    assert.equal(atTimeOn('2026-11-10', ''), null)
    assert.equal(atTimeOn('2026-11-10', '7:45'), null)
    assert.equal(atTimeOn('bad', '07:45'), null)
  })
})
