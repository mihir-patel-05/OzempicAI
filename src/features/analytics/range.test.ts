import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getAnalyticsDateRange } from './range'

describe('getAnalyticsDateRange', () => {
  it('includes today in a 30-day local range', () => {
    const result = getAnalyticsDateRange('30d', new Date(2026, 8, 20, 2, 30))

    assert.deepEqual(result, {
      start: '2026-08-22',
      end: '2026-09-20',
      days: 30,
    })
  })

  it('keeps the one-year request within the database 366-day limit', () => {
    const result = getAnalyticsDateRange('1y', new Date(2026, 8, 20, 12))
    const difference =
      (Date.parse(`${result.end}T00:00:00Z`) -
        Date.parse(`${result.start}T00:00:00Z`)) /
      86_400_000

    assert.equal(result.days, 366)
    assert.equal(difference, 365)
  })
})

