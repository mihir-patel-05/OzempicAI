import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { Hono } from 'hono'
import type { Context, MiddlewareHandler } from 'hono'
import { pool, withTransaction } from './db.js'
import type { Db } from './db.js'
import { sendPasswordResetEmail } from './email.js'
import { HttpError, readJson } from './http.js'

export interface AuthUser {
  id: string
  email: string
  name: string
}

export type AppEnv = { Variables: { user: AuthUser; token: string } }

const SESSION_DAYS = 30
const RESET_TOKEN_MINUTES = 60
const MIN_PASSWORD_LENGTH = 8
const BCRYPT_ROUNDS = 10
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function newToken(): string {
  return randomBytes(32).toString('base64url')
}

function toClientUser(user: AuthUser) {
  return { id: user.id, email: user.email, user_metadata: { name: user.name } }
}

async function createSession(db: Db | typeof pool, user: AuthUser) {
  const token = newToken()
  await db.query(
    `insert into auth.sessions (token_hash, user_id, expires_at)
     values ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token), user.id, SESSION_DAYS],
  )
  return { access_token: token, user: toClientUser(user) }
}

function readEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email address.')
  return email
}

function readPassword(value: unknown): string {
  const password = typeof value === 'string' ? value : ''
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Password should be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  if (password.length > 72) {
    // bcrypt only uses the first 72 bytes.
    throw new HttpError(400, 'Password should be at most 72 characters.')
  }
  return password
}

// ─── Rate limiting ──────────────────────────────────────────────────────────
// In-memory fixed windows. One API replica, so this is enough to slow down
// password guessing and reset-email spam without another moving part.
const buckets = new Map<string, { count: number; resetAt: number }>()

function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }
  bucket.count += 1
  if (bucket.count > limit) {
    throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.')
  }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key)
}, 60_000).unref()

function clientIp(c: Context): string {
  return (
    c.req.header('x-real-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  )
}

function limitByIp(c: Context, action: string) {
  rateLimit(`${action}:ip:${clientIp(c)}`, 20, 15 * 60_000)
}

// ─── Middleware ─────────────────────────────────────────────────────────────

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) throw new HttpError(401, 'Not signed in')

  const tokenHash = hashToken(token)
  const { rows } = await pool.query<AuthUser & { refresh: boolean }>(
    `select u.id, u.email, coalesce(u.raw_user_meta_data ->> 'name', '') as name,
            s.last_used_at < now() - interval '1 day' as refresh
       from auth.sessions s
       join auth.users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [tokenHash],
  )
  const row = rows[0]
  if (!row) throw new HttpError(401, 'Your session has expired. Please sign in again.')

  if (row.refresh) {
    // Sliding expiry: an app used at least monthly stays signed in.
    await pool.query(
      `update auth.sessions
          set last_used_at = now(), expires_at = now() + make_interval(days => $2)
        where token_hash = $1`,
      [tokenHash, SESSION_DAYS],
    )
  }

  c.set('user', { id: row.id, email: row.email, name: row.name })
  c.set('token', token)
  await next()
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export const authRoutes = new Hono<AppEnv>()

authRoutes.post('/signup', async (c) => {
  limitByIp(c, 'signup')
  const body = await readJson(c)
  const email = readEmail(body.email)
  const password = readPassword(body.password)
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : ''

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  const session = await withTransaction(async (db) => {
    const existing = await db.query('select 1 from auth.users where lower(email) = $1', [email])
    if (existing.rowCount) throw new HttpError(409, 'An account with this email already exists.')
    // The on_auth_user_created trigger creates the matching public.users row.
    const { rows } = await db.query<{ id: string }>(
      `insert into auth.users (email, encrypted_password, raw_user_meta_data)
       values ($1, $2, jsonb_build_object('name', $3::text))
       returning id`,
      [email, hash, name],
    )
    return createSession(db, { id: rows[0]!.id, email, name })
  })
  return c.json(session, 201)
})

authRoutes.post('/login', async (c) => {
  limitByIp(c, 'login')
  const body = await readJson(c)
  const email = readEmail(body.email)
  rateLimit(`login:email:${email}`, 10, 15 * 60_000)
  const password = typeof body.password === 'string' ? body.password : ''

  const { rows } = await pool.query<AuthUser & { encrypted_password: string }>(
    `select id, email, encrypted_password, coalesce(raw_user_meta_data ->> 'name', '') as name
       from auth.users where lower(email) = $1`,
    [email],
  )
  const user = rows[0]
  // An unusable hash (e.g. '!' on an imported account with no password) makes
  // bcryptjs reject rather than return false.
  const ok = user
    ? await bcrypt.compare(password, user.encrypted_password).catch(() => false)
    : false
  if (!user || !ok) throw new HttpError(400, 'Invalid login credentials')

  return c.json(await createSession(pool, { id: user.id, email: user.email, name: user.name }))
})

authRoutes.get('/user', requireUser, (c) => c.json({ user: toClientUser(c.get('user')) }))

authRoutes.post('/logout', requireUser, async (c) => {
  await pool.query('delete from auth.sessions where token_hash = $1', [hashToken(c.get('token'))])
  return c.body(null, 204)
})

/** Change the password while signed in. Other devices are signed out. */
authRoutes.post('/password', requireUser, async (c) => {
  const body = await readJson(c)
  const password = readPassword(body.password)
  const user = c.get('user')
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  await withTransaction(async (db) => {
    await db.query(
      'update auth.users set encrypted_password = $2, updated_at = now() where id = $1',
      [user.id, hash],
    )
    await db.query('delete from auth.sessions where user_id = $1 and token_hash <> $2', [
      user.id,
      hashToken(c.get('token')),
    ])
  })
  return c.body(null, 204)
})

/** Email a reset link. Always 204 so the response never reveals who has an account. */
authRoutes.post('/recover', async (c) => {
  limitByIp(c, 'recover')
  const body = await readJson(c)
  const email = readEmail(body.email)
  rateLimit(`recover:email:${email}`, 3, 60 * 60_000)

  const { rows } = await pool.query<{ id: string; email: string }>(
    'select id, email from auth.users where lower(email) = $1',
    [email],
  )
  const user = rows[0]
  if (user) {
    const token = newToken()
    await pool.query(
      `insert into auth.password_reset_tokens (token_hash, user_id, expires_at)
       values ($1, $2, now() + make_interval(mins => $3))`,
      [hashToken(token), user.id, RESET_TOKEN_MINUTES],
    )
    await sendPasswordResetEmail(user.email, token)
  }
  return c.body(null, 204)
})

/** Redeem a reset link: set the new password, sign out everywhere, sign in here. */
authRoutes.post('/reset', async (c) => {
  limitByIp(c, 'reset')
  const body = await readJson(c)
  const token = typeof body.token === 'string' ? body.token : ''
  const password = readPassword(body.password)
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  const session = await withTransaction(async (db) => {
    const { rows } = await db.query<AuthUser>(
      `update auth.password_reset_tokens t
          set used_at = now()
         from auth.users u
        where t.token_hash = $1
          and t.user_id = u.id
          and t.used_at is null
          and t.expires_at > now()
        returning u.id, u.email, coalesce(u.raw_user_meta_data ->> 'name', '') as name`,
      [hashToken(token)],
    )
    const user = rows[0]
    if (!user) throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.')
    await db.query(
      'update auth.users set encrypted_password = $2, updated_at = now() where id = $1',
      [user.id, hash],
    )
    await db.query('delete from auth.sessions where user_id = $1', [user.id])
    await db.query(
      'delete from auth.password_reset_tokens where user_id = $1 and used_at is null',
      [user.id],
    )
    return createSession(db, user)
  })
  return c.json(session)
})

/** Housekeeping for expired rows; called on an interval from index.ts. */
export async function purgeExpiredAuthRows() {
  await pool.query('delete from auth.sessions where expires_at < now()')
  await pool.query(
    `delete from auth.password_reset_tokens
      where expires_at < now() - interval '1 day' or used_at < now() - interval '1 day'`,
  )
}
