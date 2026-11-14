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

/** Postgres error codes that are the caller's fault, mapped to HTTP statuses. */
const PG_CLIENT_ERRORS: Record<string, ContentfulStatusCode> = {
  '22001': 400, // string_data_right_truncation
  '22003': 400, // numeric_value_out_of_range
  '22007': 400, // invalid_datetime_format
  '22008': 400, // datetime_field_overflow
  '22023': 400, // invalid_parameter_value (e.g. unknown timezone)
  '22P02': 400, // invalid_text_representation
  '23502': 400, // not_null_violation
  '23503': 400, // foreign_key_violation
  '23505': 409, // unique_violation
  '23514': 400, // check_violation
  '42501': 403, // insufficient_privilege / row level security
  P0001: 400, // raise exception in a SQL function (e.g. unknown analytics timezone)
}

export function toHttpError(err: unknown): HttpError | null {
  if (err instanceof HttpError) return err
  if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
    const status = PG_CLIENT_ERRORS[err.code]
    if (status) {
      const message = 'message' in err && typeof err.message === 'string' ? err.message : 'Invalid request'
      return new HttpError(status, message)
    }
  }
  return null
}
