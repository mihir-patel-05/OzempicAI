import { Hono } from 'hono'
import type { AppEnv } from '../auth.js'
import { withUser } from '../db.js'
import type { Db } from '../db.js'
import {
  HttpError,
  MAX_NOTES_CHARS,
  int,
  limitParam,
  optionalTimestamp,
  readFields,
  readJson,
  readOptionalJson,
  requireUuid,
  text,
} from '../http.js'
import type { FieldRules } from '../http.js'

/**
 * Intermittent fasts (docs/fasting-plan.md). A fast is running while ended_at
 * is null. The database refuses overlapping fasts, which also means at most one
 * runs at a time; the checks here come first so the message says why.
 */

/** A goal of 1 to 72 hours. Matches the check on public.fasts. */
export const MIN_TARGET_MINUTES = 60
export const MAX_TARGET_MINUTES = 72 * 60

/** Slack for a phone clock that runs a little ahead of the server's. */
const CLOCK_SLACK_MS = 60_000

/** What the API returns; the notifier's bookkeeping columns stay out. */
const COLUMNS = 'id, started_at, target_minutes, ended_at, notes, created_at'

const FIELDS: FieldRules = {
  started_at: { kind: 'timestamp' },
  target_minutes: int(MIN_TARGET_MINUTES, MAX_TARGET_MINUTES),
  ended_at: { kind: 'timestamp', nullable: true },
  notes: text(MAX_NOTES_CHARS, true),
}

interface FastRow {
  id: string
  started_at: Date
  target_minutes: number
  ended_at: Date | null
  notes: string | null
  goal_notified_at: Date | null
  reminder_notified_at: Date | null
}

/** A client timestamp as a Date, refused if it is in the future. */
function pastTime(value: unknown, name: string): Date {
  const time = new Date(value as string)
  if (time.getTime() > Date.now() + CLOCK_SLACK_MS) {
    throw new HttpError(400, `${name} can't be in the future`)
  }
  return time
}

/** Blank notes are stored as no notes. */
function cleanNotes(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function requireEndAfterStart(start: Date, end: Date | null) {
  if (end && end.getTime() <= start.getTime()) {
    throw new HttpError(400, 'A fast has to end after it starts')
  }
}

/** Refuse a second running fast, then any overlap with another fast. */
async function assertFits(db: Db, userId: string, start: Date, end: Date | null, exceptId: string | null) {
  if (!end) {
    const running = await db.query(
      `select 1 from public.fasts
        where user_id = $1 and ended_at is null and ($2::uuid is null or id <> $2)`,
      [userId, exceptId],
    )
    if (running.rowCount) throw new HttpError(409, 'A fast is already running. End it before starting another.')
  }
  const overlap = await db.query(
    `select 1 from public.fasts
      where user_id = $1
        and ($2::uuid is null or id <> $2)
        and tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz), '[)')
            && tstzrange($3::timestamptz, $4::timestamptz, '[)')`,
    [userId, exceptId, start, end],
  )
  if (overlap.rowCount) throw new HttpError(409, 'That overlaps another fast.')
}

async function lockFast(db: Db, userId: string, id: string): Promise<FastRow> {
  const { rows } = await db.query<FastRow>(
    `select * from public.fasts where id = $1 and user_id = $2 for update`,
    [id, userId],
  )
  if (!rows[0]) throw new HttpError(404, 'Not found')
  return rows[0]
}

export const fastingRoutes = new Hono<AppEnv>()

/** The running fast, or null. */
fastingRoutes.get('/fasts/active', async (c) => {
  const userId = c.get('user').id
  const row = await withUser(userId, async (db) => {
    const { rows } = await db.query(
      `select ${COLUMNS} from public.fasts where user_id = $1 and ended_at is null limit 1`,
      [userId],
    )
    return rows[0] ?? null
  })
  return c.json(row)
})

/** Fasts that overlap ?from=&to= (either may be left out), newest first. */
fastingRoutes.get('/fasts', async (c) => {
  const userId = c.get('user').id
  const from = optionalTimestamp(c.req.query('from'), 'from')
  const to = optionalTimestamp(c.req.query('to'), 'to')
  const limit = limitParam(c.req.query('limit'), 100, 1000)

  const rows = await withUser(userId, async (db) => {
    const result = await db.query(
      `select ${COLUMNS} from public.fasts
        where user_id = $1
          and ($2::timestamptz is null or coalesce(ended_at, 'infinity'::timestamptz) >= $2::timestamptz)
          and ($3::timestamptz is null or started_at <= $3::timestamptz)
        order by started_at desc
        limit $4`,
      [userId, from ?? null, to ?? null, limit],
    )
    return result.rows
  })
  return c.json(rows)
})

/**
 * Start a fast now, or at a backdated started_at. With ended_at it records a
 * fast that has already finished instead.
 */
fastingRoutes.post('/fasts', async (c) => {
  const userId = c.get('user').id
  const body = readFields(await readJson(c), FIELDS)
  if (body.target_minutes === undefined) throw new HttpError(400, 'target_minutes is required')
  const start = body.started_at === undefined ? new Date() : pastTime(body.started_at, 'started_at')
  const end = body.ended_at == null ? null : pastTime(body.ended_at, 'ended_at')
  requireEndAfterStart(start, end)

  const row = await withUser(userId, async (db) => {
    await assertFits(db, userId, start, end, null)
    const { rows } = await db.query(
      `insert into public.fasts (user_id, started_at, target_minutes, ended_at, notes)
       values ($1, $2, $3, $4, $5)
       returning ${COLUMNS}`,
      [userId, start, body.target_minutes, end, cleanNotes(body.notes)],
    )
    return rows[0]
  })
  return c.json(row, 201)
})

/** End a running fast now, or at ended_at. */
fastingRoutes.post('/fasts/:id/end', async (c) => {
  const userId = c.get('user').id
  const id = requireUuid(c.req.param('id'))
  const body = readFields(await readOptionalJson(c), { ended_at: { kind: 'timestamp' } })
  const end = body.ended_at === undefined ? new Date() : pastTime(body.ended_at, 'ended_at')

  const row = await withUser(userId, async (db) => {
    const fast = await lockFast(db, userId, id)
    if (fast.ended_at) throw new HttpError(409, 'This fast has already ended.')
    requireEndAfterStart(fast.started_at, end)
    // A running fast is the user's latest, so ending it can't create an overlap.
    const { rows } = await db.query(
      `update public.fasts set ended_at = $3 where id = $1 and user_id = $2 returning ${COLUMNS}`,
      [id, userId, end],
    )
    return rows[0]
  })
  return c.json(row)
})

/**
 * Correct a fast: its start, goal, end (null reopens it) or notes. When the
 * change puts a running fast's goal back in the future, its notifications are
 * re-armed so they go out at the new time.
 */
fastingRoutes.patch('/fasts/:id', async (c) => {
  const userId = c.get('user').id
  const id = requireUuid(c.req.param('id'))
  const body = readFields(await readJson(c), FIELDS)
  if (Object.keys(body).length === 0) throw new HttpError(400, 'Nothing to update')
  const newStart = body.started_at === undefined ? undefined : pastTime(body.started_at, 'started_at')
  const newEnd =
    body.ended_at === undefined ? undefined : body.ended_at === null ? null : pastTime(body.ended_at, 'ended_at')

  const row = await withUser(userId, async (db) => {
    const fast = await lockFast(db, userId, id)
    const start = newStart ?? fast.started_at
    const end = newEnd === undefined ? fast.ended_at : newEnd
    const target = (body.target_minutes as number | undefined) ?? fast.target_minutes
    const notes = body.notes === undefined ? fast.notes : cleanNotes(body.notes)
    requireEndAfterStart(start, end)
    await assertFits(db, userId, start, end, id)

    const goalAt = start.getTime() + target * 60_000
    const now = Date.now()
    const running = end === null
    const goalNotified = running && goalAt > now ? null : fast.goal_notified_at
    const reminderNotified = running && goalAt - 60 * 60_000 > now ? null : fast.reminder_notified_at

    const { rows } = await db.query(
      `update public.fasts
          set started_at = $3, target_minutes = $4, ended_at = $5, notes = $6,
              goal_notified_at = $7, reminder_notified_at = $8
        where id = $1 and user_id = $2
        returning ${COLUMNS}`,
      [id, userId, start, target, end, notes, goalNotified, reminderNotified],
    )
    return rows[0]
  })
  return c.json(row)
})

fastingRoutes.delete('/fasts/:id', async (c) => {
  const userId = c.get('user').id
  const id = requireUuid(c.req.param('id'))
  await withUser(userId, (db) =>
    db.query('delete from public.fasts where id = $1 and user_id = $2', [id, userId]),
  )
  return c.body(null, 204)
})
