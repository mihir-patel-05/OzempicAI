import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DateInputError,
  addDays,
  eachDay,
  isValidDate,
  isValidTimezone,
  isoWeekday,
  resolveRange,
  todayIn,
  weekdayName,
} from './dates.js'

test('todayIn uses the local calendar day near midnight', () => {
  // 23:30 in New York on Sunday 2026-11-15 is already Monday in UTC.
  const lateSunday = new Date('2026-11-16T04:30:00Z')
  assert.equal(todayIn('America/New_York', lateSunday), '2026-11-15')
  assert.equal(todayIn('UTC', lateSunday), '2026-11-16')
  // 01:30 Monday in Auckland is still Sunday in UTC.
  assert.equal(todayIn('Pacific/Auckland', new Date('2026-11-15T12:30:00Z')), '2026-11-16')
})

test('weeks run Monday to Sunday', () => {
  const sunday = new Date('2026-11-16T04:30:00Z') // Sunday 2026-11-15 in New York
  assert.deepEqual(resolveRange('this_week', 'America/New_York', {}, sunday), {
    start: '2026-11-09',
    end: '2026-11-15',
  })
  assert.deepEqual(resolveRange('last_week', 'America/New_York', {}, sunday), {
    start: '2026-11-02',
    end: '2026-11-08',
  })
  assert.deepEqual(resolveRange('next_week', 'America/New_York', {}, sunday), {
    start: '2026-11-16',
    end: '2026-11-22',
  })
})

test('this_week on a Monday is a single day', () => {
  const mondayInAuckland = new Date('2026-11-15T12:30:00Z')
  assert.deepEqual(resolveRange('this_week', 'Pacific/Auckland', {}, mondayInAuckland), {
    start: '2026-11-16',
    end: '2026-11-16',
  })
})

test('rolling presets are inclusive of today', () => {
  const now = new Date('2026-11-14T15:00:00Z')
  assert.deepEqual(resolveRange('today', 'UTC', {}, now), { start: '2026-11-14', end: '2026-11-14' })
  assert.deepEqual(resolveRange('last_7_days', 'UTC', {}, now), {
    start: '2026-11-08',
    end: '2026-11-14',
  })
  assert.equal(eachDay(resolveRange('last_30_days', 'UTC', {}, now)).length, 30)
  assert.deepEqual(resolveRange('next_7_days', 'UTC', {}, now), {
    start: '2026-11-15',
    end: '2026-11-21',
  })
  assert.deepEqual(resolveRange('upcoming', 'UTC', {}, now), {
    start: '2026-11-14',
    end: '2026-12-05',
  })
})

test('day arithmetic ignores DST transitions', () => {
  // US DST starts 2026-03-08 and ends 2026-11-01.
  assert.equal(addDays('2026-03-07', 1), '2026-03-08')
  assert.equal(addDays('2026-03-08', 1), '2026-03-09')
  assert.equal(addDays('2026-11-01', -1), '2026-10-31')
  assert.equal(todayIn('America/New_York', new Date('2026-11-01T05:30:00Z')), '2026-11-01')
  assert.equal(todayIn('America/New_York', new Date('2026-11-02T04:30:00Z')), '2026-11-01')
  assert.deepEqual(eachDay({ start: '2026-10-30', end: '2026-11-02' }), [
    '2026-10-30',
    '2026-10-31',
    '2026-11-01',
    '2026-11-02',
  ])
})

test('custom ranges are validated', () => {
  assert.deepEqual(
    resolveRange('custom', 'UTC', { start_date: '2026-01-01', end_date: '2026-01-31' }),
    { start: '2026-01-01', end: '2026-01-31' },
  )
  assert.throws(() => resolveRange('custom', 'UTC', {}), DateInputError)
  assert.throws(
    () => resolveRange('custom', 'UTC', { start_date: '2026-02-30', end_date: '2026-03-01' }),
    DateInputError,
  )
  assert.throws(
    () => resolveRange('custom', 'UTC', { start_date: '2026-03-02', end_date: '2026-03-01' }),
    DateInputError,
  )
  // 366 days is allowed, 367 is not.
  assert.doesNotThrow(() =>
    resolveRange('custom', 'UTC', { start_date: '2024-01-01', end_date: '2024-12-31' }),
  )
  assert.throws(
    () => resolveRange('custom', 'UTC', { start_date: '2024-01-01', end_date: '2025-01-01' }),
    DateInputError,
  )
})

test('validators and weekday helpers', () => {
  assert.ok(isValidTimezone('America/New_York'))
  assert.ok(isValidTimezone('Pacific/Auckland'))
  assert.ok(!isValidTimezone('Mars/Olympus_Mons'))
  assert.ok(!isValidTimezone(''))
  assert.ok(isValidDate('2028-02-29'))
  assert.ok(!isValidDate('2026-02-29'))
  assert.ok(!isValidDate('2026-1-01'))
  assert.equal(isoWeekday('2026-11-16'), 1)
  assert.equal(isoWeekday('2026-11-15'), 7)
  assert.equal(weekdayName('2026-11-14'), 'Saturday')
})
