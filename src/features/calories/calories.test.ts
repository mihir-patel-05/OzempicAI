import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MAX_CALORIES, parseCalories } from './calories'

describe('parseCalories', () => {
  it('reads whole and fractional amounts', () => {
    assert.equal(parseCalories('250'), 250)
    assert.equal(parseCalories(' 250 '), 250)
    assert.equal(parseCalories('99.6'), 100)
    assert.equal(parseCalories('0.2'), 1)
  })

  it('refuses empty, zero, negative and non-numbers', () => {
    for (const value of ['', '  ', '0', '-5', 'abc', 'Infinity']) {
      assert.equal(parseCalories(value), null, value)
    }
  })

  it('refuses more than the API allows', () => {
    assert.equal(parseCalories(String(MAX_CALORIES)), MAX_CALORIES)
    assert.equal(parseCalories(String(MAX_CALORIES + 1)), null)
  })
})
