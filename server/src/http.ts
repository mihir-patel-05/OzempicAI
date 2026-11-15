import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string,
  ) {
    super(message)
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

export function requireUuid(value: string | undefined, name = 'id'): string {
  if (!value || !UUID.test(value)) throw new HttpError(400, `Invalid ${name}`)
  return value
}

export function optionalDate(value: string | undefined, name: string): string | undefined {
  if (value === undefined || value === '') return undefined
  if (!DATE.test(value)) throw new HttpError(400, `Invalid ${name}: expected YYYY-MM-DD`)
  return value
}

export function optionalTimestamp(value: string | undefined, name: string): string | undefined {
  if (value === undefined || value === '') return undefined
  if (Number.isNaN(Date.parse(value))) throw new HttpError(400, `Invalid ${name}`)
  return value
}

export function limitParam(value: string | undefined, fallback: number, max: number): number {
  if (value === undefined || value === '') return fallback
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, 'Invalid limit')
  return Math.min(n, max)
}

export async function readJson(c: Context): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new HttpError(400, 'Request body must be JSON')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object')
  }
  return body as Record<string, unknown>
}

/** Copy only the listed keys that are present in `body`. */
export function pick(body: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    if (body[key] !== undefined) out[key] = body[key]
  }
  return out
}

// ─── Field validation ───────────────────────────────────────────────────────
// Every value a client can store is checked here before it reaches SQL: its
// type, and a ceiling on its size. Without the ceilings one account could
// store megabyte-long names and then ask for thousands of them back at once.

export type FieldRule =
  | { kind: 'text'; max: number; nullable?: boolean }
  | { kind: 'number'; min: number; max: number; integer?: boolean; nullable?: boolean }
  | { kind: 'boolean' }
  | { kind: 'timestamp'; nullable?: boolean }
  | { kind: 'date' }
  | { kind: 'uuid'; nullable?: boolean }
  | { kind: 'enum'; values: readonly string[]; nullable?: boolean }

export type FieldRules = Record<string, FieldRule>

export const text = (max: number, nullable = false): FieldRule => ({ kind: 'text', max, nullable })
export const int = (min: number, max: number, nullable = false): FieldRule => ({ kind: 'number', min, max, integer: true, nullable })
export const num = (min: number, max: number, nullable = false): FieldRule => ({ kind: 'number', min, max, nullable })
export const oneOf = (values: readonly string[], nullable = false): FieldRule => ({ kind: 'enum', values, nullable })

/** Longest name-like field (food, exercise, plan, grocery item) and longest note. */
export const MAX_NAME_CHARS = 200
export const MAX_NOTES_CHARS = 2000

function fieldProblem(value: unknown, rule: FieldRule): string | null {
  if (value === null) return 'nullable' in rule && rule.nullable ? null : 'is required'
  switch (rule.kind) {
    case 'text':
      if (typeof value !== 'string') return 'must be text'
      return value.length > rule.max ? `must be at most ${rule.max} characters` : null
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'must be a number'
      if (rule.integer && !Number.isInteger(value)) return 'must be a whole number'
      return value < rule.min || value > rule.max ? `must be between ${rule.min} and ${rule.max}` : null
    case 'boolean':
      return typeof value === 'boolean' ? null : 'must be true or false'
    case 'timestamp':
      return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value)) ? null : 'must be a date and time'
    case 'date':
      return typeof value === 'string' && DATE.test(value) && !Number.isNaN(Date.parse(value)) ? null : 'must be a date (YYYY-MM-DD)'
    case 'uuid':
      return typeof value === 'string' && UUID.test(value) ? null : 'must be an id'
    case 'enum':
      return typeof value === 'string' && rule.values.includes(value) ? null : `must be one of ${rule.values.join(', ')}`
  }
}

/**
 * Copy the fields named in `rules` out of `body`, checking each one. Fields
 * the client didn't send are left out; anything not in `rules` is ignored.
 */
export function readFields(body: Record<string, unknown>, rules: FieldRules): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, rule] of Object.entries(rules)) {
    const value = body[name]
    if (value === undefined) continue
    const problem = fieldProblem(value, rule)
    if (problem) throw new HttpError(400, `${name} ${problem}`)
    out[name] = value
  }
  return out
}

/**
 * Postgres errors that are the caller's fault, as an HTTP status and a fixed
 * message. The driver's own text is never sent: it names tables, columns and
 * constraints and can echo back the value that was rejected.
 */
const PG_CLIENT_ERRORS: Record<string, { status: ContentfulStatusCode; message: string }> = {
  '22001': { status: 400, message: 'One of the values is too long.' },
  '22003': { status: 400, message: 'One of the numbers is out of range.' },
  '22007': { status: 400, message: 'One of the dates or times is not valid.' },
  '22008': { status: 400, message: 'One of the dates or times is out of range.' },
  '22023': { status: 400, message: 'One of the values is not valid.' },
  '22P02': { status: 400, message: 'One of the values has the wrong format.' },
  '23502': { status: 400, message: 'A required value is missing.' },
  '23503': { status: 400, message: 'A linked record was not found.' },
  '23505': { status: 409, message: 'That already exists.' },
  '23514': { status: 400, message: 'One of the values is outside the allowed range.' },
  '42501': { status: 403, message: 'You are not allowed to do that.' },
}
/** `raise exception` in our own SQL functions and triggers: the text is ours and safe to show. */
const PG_RAISED = 'P0001'

export function toHttpError(err: unknown): HttpError | null {
  if (err instanceof HttpError) return err
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    if (err.code === PG_RAISED) {
      const message = 'message' in err && typeof err.message === 'string' ? err.message : 'Invalid request'
      return new HttpError(400, message.slice(0, 300))
    }
    const known = PG_CLIENT_ERRORS[err.code]
    if (known) {
      // Enough to debug with, without the rejected value or row.
      const where = ['table', 'column', 'constraint']
        .map((key) => (key in err && typeof (err as Record<string, unknown>)[key] === 'string' ? `${key}=${String((err as Record<string, unknown>)[key])}` : ''))
        .filter(Boolean)
        .join(' ')
      console.warn(`Rejected by the database: code=${err.code}${where ? ` ${where}` : ''}`)
      return new HttpError(known.status, known.message)
    }
  }
  return null
}
