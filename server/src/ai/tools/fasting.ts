import { addDays } from '../dates.js'
import { goalLabel } from '../../push/fastingMessages.js'
import { PAST_PRESETS, rangeFromInput, rangeProperties, rangeSchema } from './range.js'
import { defineTool } from './types.js'

/**
 * Fasting history for the coach and AI apps (docs/fasting-plan.md, phase 6).
 * Read-only: fasts are started, ended and edited on the Fasting screen. Like
 * the app's stats, only ended fasts count, each toward the local day it ended.
 */

/** Fasts listed one by one; the totals still cover the whole range. */
export const MAX_LISTED_FASTS = 60
const MAX_NOTE_CHARS = 200

/** A fast met its goal once it lasted at least target_minutes. */
const MET = `ended_at - started_at >= make_interval(mins => target_minutes)`
const HOURS = (end: string) => `extract(epoch from (${end} - started_at))::float8 / 3600`
const LOCAL = (column: string) => `to_char((${column}) at time zone $2, 'YYYY-MM-DD HH24:MI')`
/** Ended fasts whose end falls on a local day in $3..$4. */
const ENDED_IN_RANGE = `user_id = $1 and ended_at is not null and (ended_at at time zone $2)::date between $3::date and $4::date`

interface Totals {
  fasts: number
  goals_met: number
  avg_hours: number | null
  longest_hours: number | null
  total_hours: number | null
}

interface EndedRow {
  day: string
  started: string
  ended: string
  hours: number
  target_minutes: number
  met: boolean
  notes: string | null
}

interface RunningRow {
  started: string
  goal_at: string
  hours: number
  target_minutes: number
}

export interface Streaks {
  /** Days in a row, up to today, with a fast that met its goal. Today not having one yet doesn't break it. */
  current: number
  best: number
}

/** Streaks from the local days (YYYY-MM-DD) on which a fast met its goal. */
export function fastingStreaks(metDays: readonly string[], today: string): Streaks {
  const days = new Set(metDays)
  let day = days.has(today) ? today : addDays(today, -1)
  let current = 0
  while (days.has(day)) {
    current += 1
    day = addDays(day, -1)
  }
  let best = 0
  for (const start of days) {
    if (days.has(addDays(start, -1))) continue // count each run from its first day
    let length = 1
    while (days.has(addDays(start, length))) length += 1
    best = Math.max(best, length)
  }
  return { current, best }
}

function round1(n: number | null): number | null {
  return n == null ? null : Math.round(n * 10) / 10
}

export const getFastingHistory = defineTool({
  title: 'Get fasting history',
  scope: 'read',
  definition: {
    name: 'get_fasting_history',
    description:
      "Get the user's intermittent fasting: the fast running now, if any (when it started, hours so far, its goal and when it reaches it), and the fasts that ended in a date range, each counted toward the day it ended. Returns how many met their goal, average, longest and total hours, the goal-met streak in days, and up to 60 fasts newest first. Times are local in the user's timezone. Use range=custom for more than 30 days.",
    strict: true,
    input_schema: {
      type: 'object' as const,
      properties: rangeProperties(PAST_PRESETS),
      required: ['range', 'start_date', 'end_date'],
      additionalProperties: false,
    },
  },
  schema: rangeSchema(PAST_PRESETS),
  async run(input, { db, userId, tz, today }) {
    const range = rangeFromInput(input, tz)
    const window = [userId, tz, range.start, range.end]
    const [totals, ended, running, metDays] = await Promise.all([
      db.query<Totals>(
        `select count(*)::int as fasts,
                count(*) filter (where ${MET})::int as goals_met,
                avg(${HOURS('ended_at')}) as avg_hours,
                max(${HOURS('ended_at')}) as longest_hours,
                sum(${HOURS('ended_at')}) as total_hours
           from public.fasts
          where ${ENDED_IN_RANGE}`,
        window,
      ),
      db.query<EndedRow>(
        `select (ended_at at time zone $2)::date::text as day,
                ${LOCAL('started_at')} as started,
                ${LOCAL('ended_at')} as ended,
                ${HOURS('ended_at')} as hours,
                target_minutes,
                ${MET} as met,
                notes
           from public.fasts
          where ${ENDED_IN_RANGE}
          order by ended_at desc
          limit ${MAX_LISTED_FASTS}`,
        window,
      ),
      db.query<RunningRow>(
        `select ${LOCAL('started_at')} as started,
                ${LOCAL('started_at + make_interval(mins => target_minutes)')} as goal_at,
                ${HOURS('now()')} as hours,
                target_minutes
           from public.fasts
          where user_id = $1 and ended_at is null
          limit 1`,
        [userId, tz],
      ),
      // Streaks look back past the range: a streak doesn't stop at its start.
      db.query<{ day: string }>(
        `select distinct (ended_at at time zone $2)::date::text as day
           from public.fasts
          where user_id = $1 and ended_at is not null and ${MET}
          order by day desc
          limit 1000`,
        [userId, tz],
      ),
    ])

    const t = totals.rows[0] ?? { fasts: 0, goals_met: 0, avg_hours: null, longest_hours: null, total_hours: null }
    const now = running.rows[0]
    return {
      result: {
        start: range.start,
        end: range.end,
        running: now
          ? {
              started: now.started,
              goal: goalLabel(now.target_minutes),
              goal_hours: round1(now.target_minutes / 60),
              hours_so_far: round1(now.hours),
              goal_at: now.goal_at,
              reached: now.hours * 60 >= now.target_minutes,
            }
          : null,
        ended_fasts: t.fasts,
        goals_met: t.goals_met,
        goal_met_pct: t.fasts ? Math.round((t.goals_met / t.fasts) * 100) : null,
        avg_hours: round1(t.avg_hours),
        longest_hours: round1(t.longest_hours),
        total_hours: round1(t.total_hours) ?? 0,
        streak_days: fastingStreaks(
          metDays.rows.map((r) => r.day),
          today,
        ),
        fasts: ended.rows.map((r) => ({
          day: r.day,
          started: r.started,
          ended: r.ended,
          hours: round1(r.hours),
          goal: goalLabel(r.target_minutes),
          met: r.met,
          ...(r.notes ? { notes: r.notes.slice(0, MAX_NOTE_CHARS) } : {}),
        })),
        ...(t.fasts > ended.rows.length ? { fasts_not_listed: t.fasts - ended.rows.length } : {}),
      },
    }
  },
})
