import { createHash, randomBytes } from 'node:crypto'
import { isIP } from 'node:net'
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
/** However often it is used, a session ends this long after sign-in. */
const SESSION_MAX_DAYS = 90
const RESET_TOKEN_MINUTES = 60
const MIN_PASSWORD_LENGTH = 8
const BCRYPT_ROUNDS = 10
/** RFC 5321's limit on a deliverable address. */
const MAX_EMAIL_LENGTH = 254

/**
 * something@domain.tld, with no spaces. Checked by hand in a single pass:
 * the regex this replaces backtracked quadratically on long input and could
 * stall the event loop for seconds.
 */
export function isEmail(email: string): boolean {
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return false
  for (let i = 0; i < email.length; i++) {
    const code = email.charCodeAt(i)
    // Whitespace and control characters never belong in an address.
    if (code <= 32 || code === 127 || code === 0xa0 || code === 0x2028 || code === 0x2029 || code === 0xfeff) return false
  }
  const at = email.indexOf('@')
  if (at < 1 || at !== email.lastIndexOf('@')) return false
  const domain = email.slice(at + 1)
  const dot = domain.lastIndexOf('.')
  return dot > 0 && dot < domain.length - 1
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function newToken(): string {
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
  // Length is checked before anything else touches the string.
  if (typeof value !== 'string' || value.length > MAX_EMAIL_LENGTH + 64) {
    throw new HttpError(400, 'Enter a valid email address.')
  }
  const email = value.trim().toLowerCase()
  if (!isEmail(email)) throw new HttpError(400, 'Enter a valid email address.')
  return email
}

function readPassword(value: unknown): string {
  const password = typeof value === 'string' ? value : ''
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Password should be at least ${MIN_PASSWORD_LENGTH} characters.`)
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    // bcrypt only uses the first 72 bytes, and accented letters and emoji
    // take more than one, so the limit is on bytes rather than characters.
    throw new HttpError(400, 'That password is too long. Use at most 72 characters (fewer with accents or emoji).')
  }
  return password
}

// ─── Password hashing ───────────────────────────────────────────────────────
// bcryptjs runs on the request thread, so hashing is the most expensive thing
// an anonymous caller can ask for. At most a few run at once and only a short
// line may wait; beyond that the request is refused instead of piling up.
const MAX_CONCURRENT_HASHES = 2
const MAX_WAITING_HASHES = 30
let hashing = 0
const hashWaiters: (() => void)[] = []

async function withHashSlot<T>(work: () => Promise<T>): Promise<T> {
  if (hashing >= MAX_CONCURRENT_HASHES) {
    if (hashWaiters.length >= MAX_WAITING_HASHES) {
      throw new HttpError(503, 'The service is busy. Please try again in a moment.')
    }
    await new Promise<void>((resolve) => hashWaiters.push(resolve))
  } else {
    hashing += 1
  }
  try {
    return await work()
  } finally {
    const next = hashWaiters.shift()
    // Hand the slot straight to the next waiter, or free it.
    if (next) next()
    else hashing -= 1
  }
}

function hashPassword(password: string): Promise<string> {
  return withHashSlot(() => bcrypt.hash(password, BCRYPT_ROUNDS))
}

function checkPassword(password: string, hash: string): Promise<boolean> {
  // An unusable hash (e.g. '!' on an imported account with no password) makes
  // bcryptjs reject rather than return false.
  return withHashSlot(() => bcrypt.compare(password, hash).catch(() => false))
}

// ─── Rate limiting ──────────────────────────────────────────────────────────
// In-memory fixed windows. One API replica, so this is enough to slow down
// password guessing and reset-email spam without another moving part.
const buckets = new Map<string, { count: number; resetAt: number }>()

/** Keys longer than this are stored as a hash, so request input can't bloat the map. */
const MAX_KEY_LENGTH = 160
/**
 * Ceiling on live keys per limiter (the part of the key before the first
 * colon: "login", "signup", "mcp", …). Each limiter has its own budget, so a
 * flood of one kind of key can neither grow memory without bound nor push out
 * or lock another limiter. A limiter that is full refuses new keys until its
 * old ones expire; keys already being counted keep working.
 */
const MAX_KEYS_PER_LIMITER = 50_000
const keysPerLimiter = new Map<string, number>()

function limiterOf(key: string): string {
  const colon = key.indexOf(':')
  return colon < 0 ? key : key.slice(0, colon)
}

function sweepBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt > now) continue
    buckets.delete(key)
    const limiter = limiterOf(key)
    const left = (keysPerLimiter.get(limiter) ?? 1) - 1
    if (left > 0) keysPerLimiter.set(limiter, left)
    else keysPerLimiter.delete(limiter)
  }
}

/** Count one event against `key` and return how many its window now holds. */
export function countHit(key: string, windowMs: number): number {
  const limiter = limiterOf(key)
  if (key.length > MAX_KEY_LENGTH) key = `${limiter}:sha256:${hashToken(key)}`
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    if (!bucket) {
      if ((keysPerLimiter.get(limiter) ?? 0) >= MAX_KEYS_PER_LIMITER) sweepBuckets(now)
      const live = keysPerLimiter.get(limiter) ?? 0
      if (live >= MAX_KEYS_PER_LIMITER) throw new HttpError(429, 'The service is busy. Please try again in a few minutes.')
      keysPerLimiter.set(limiter, live + 1)
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return 1
  }
  bucket.count += 1
  return bucket.count
}

/** How many events `key`'s current window holds, without counting one. */
export function hitCount(key: string): number {
  if (key.length > MAX_KEY_LENGTH) key = `${limiterOf(key)}:sha256:${hashToken(key)}`
  const bucket = buckets.get(key)
  return bucket && bucket.resetAt > Date.now() ? bucket.count : 0
}

/** Take back one hit counted by countHit (e.g. a login that turned out to be valid). */
export function forgiveHit(key: string) {
  if (key.length > MAX_KEY_LENGTH) key = `${limiterOf(key)}:sha256:${hashToken(key)}`
  const bucket = buckets.get(key)
  if (bucket && bucket.count > 0) bucket.count -= 1
}

const TOO_MANY = 'Too many attempts. Please wait a few minutes and try again.'

/** Count this request and refuse it once `key` has had more than `limit` in the window. */
export function rateLimit(key: string, limit: number, windowMs: number, message = TOO_MANY) {
  if (countHit(key, windowMs) > limit) throw new HttpError(429, message)
}

setInterval(() => sweepBuckets(Date.now()), 60_000).unref()

/** Number of live rate-limit keys (for tests and metrics). */
export function rateLimitKeyCount(): number {
  return buckets.size
}

/**
 * The address to rate-limit by, from the X-Real-IP header's value.
 *
 * Railway's edge overwrites X-Real-IP with the real client address (checked
 * against production: a forged value is ignored), and the API is reachable
 * only through that edge and the web service. X-Forwarded-For is not used:
 * its first entry is whatever the client sent. Anything that isn't an IP is
 * treated as unknown, and IPv6 is grouped by /64 because one subscriber
 * controls a whole /64.
 */
export function clientIpFromHeader(value: string | undefined): string {
  const ip = value?.trim() ?? ''
  if (ip.length > 45) return 'unknown'
  const version = isIP(ip)
  if (version === 4) return ip
  if (version !== 6) return 'unknown'
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)
  if (mapped) return mapped[1]!
  const [head = '', tail = ''] = ip.toLowerCase().split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const groups = ip.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/64`
}

export function clientIp(c: Context): string {
  return clientIpFromHeader(c.req.header('x-real-ip'))
}

function limitByIp(c: Context, action: string) {
  // Its own limiter ("ip-login", …), so address keys and email keys never share a budget.
  rateLimit(`ip-${action}:${clientIp(c)}`, 20, 15 * 60_000)
}

const LOGIN_WINDOW_MS = 15 * 60_000
const LOGIN_PAIR_FAILURES = 10
// Account-wide: high enough that one or two addresses can't lock the owner
// out, low enough to keep online guessing slow (40 per 15 minutes).
const LOGIN_ACCOUNT_FAILURES = 40

let dummy: Promise<string> | null = null
/** A real bcrypt hash that no password matches, compared against for unknown emails. */
function dummyHash(): Promise<string> {
  dummy ??= bcrypt.hash(randomBytes(24).toString('base64url'), BCRYPT_ROUNDS)
  return dummy
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
      where s.token_hash = $1 and s.expires_at > now()
        and s.created_at > now() - make_interval(days => $2)`,
    [tokenHash, SESSION_MAX_DAYS],
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

/**
 * Cut off every AI app connected to the account: unused authorization codes,
 * connections, and the tokens issued under them. Runs inside the transaction
 * that changes the password, so whoever held the old password (or a stolen
 * session) keeps no way back in. The order matters: a code exchange or token
 * refresh racing with this either commits first and is caught by the later
 * statements, or waits on our row locks and then finds nothing left to use.
 */
async function revokeConnectedApps(db: Db, userId: string) {
  await db.query('delete from auth.oauth_codes where user_id = $1', [userId])
  await db.query('update auth.oauth_grants set revoked_at = now() where user_id = $1 and revoked_at is null', [userId])
  await db.query(
    `update auth.oauth_tokens set revoked_at = now()
      where revoked_at is null
        and grant_id in (select id from auth.oauth_grants where user_id = $1)`,
    [userId],
  )
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export const authRoutes = new Hono<AppEnv>()

/**
 * Whether new accounts can be created. SIGNUP_MODE=open or closed; when unset
 * it is closed in production and open elsewhere. Sign-up doesn't verify the
 * email address yet, so an open deployment lets anyone create accounts (and
 * claim an address they don't own); keep it closed until that exists.
 */
export function signupsOpen(): boolean {
  const mode = process.env.SIGNUP_MODE?.trim().toLowerCase()
  if (mode === 'open') return true
  if (mode === 'closed') return false
  return process.env.NODE_ENV !== 'production'
}

authRoutes.post('/signup', async (c) => {
  limitByIp(c, 'signup')
  if (!signupsOpen()) throw new HttpError(403, 'New sign-ups are closed right now.')
  const body = await readJson(c)
  const email = readEmail(body.email)
  const password = readPassword(body.password)
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : ''

  // Checked again inside the transaction; this one avoids hashing for nothing.
  const taken = await pool.query('select 1 from auth.users where lower(email) = $1', [email])
  if (taken.rowCount) throw new HttpError(409, 'An account with this email already exists.')
  const hash = await hashPassword(password)
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
  const password = typeof body.password === 'string' ? body.password : ''

  // Only failed attempts count. Ten from one address lock that address out of
  // the account; the account as a whole locks only after far more, so a
  // stranger who knows the email can't shut its owner out with ten bad
  // guesses, while guessing stays capped at LOGIN_ACCOUNT_FAILURES a window.
  const pairKey = `login:pair:${email}|${clientIp(c)}`
  const accountKey = `login:email:${email}`
  if (hitCount(pairKey) >= LOGIN_PAIR_FAILURES || hitCount(accountKey) >= LOGIN_ACCOUNT_FAILURES) {
    throw new HttpError(429, TOO_MANY)
  }
  // Count the attempt before checking the password and take it back on
  // success. If the limiter can't record it (it is full), this throws and the
  // password is never checked: guessing is refused rather than left uncounted.
  countHit(pairKey, LOGIN_WINDOW_MS)
  countHit(accountKey, LOGIN_WINDOW_MS)

  const { rows } = await pool.query<AuthUser & { encrypted_password: string }>(
    `select id, email, encrypted_password, coalesce(raw_user_meta_data ->> 'name', '') as name
       from auth.users where lower(email) = $1`,
    [email],
  )
  const user = rows[0]
  // Unknown emails get the same hashing work as known ones, so response time
  // doesn't reveal which addresses have accounts.
  const ok = await checkPassword(password, user?.encrypted_password ?? (await dummyHash()))
  if (!user || !ok) throw new HttpError(400, 'Invalid login credentials')
  forgiveHit(pairKey)
  forgiveHit(accountKey)

  return c.json(await createSession(pool, { id: user.id, email: user.email, name: user.name }))
})

authRoutes.get('/user', requireUser, (c) => c.json({ user: toClientUser(c.get('user')) }))

authRoutes.post('/logout', requireUser, async (c) => {
  await pool.query('delete from auth.sessions where token_hash = $1', [hashToken(c.get('token'))])
  return c.body(null, 204)
})

/**
 * Change the password while signed in. Needs the current password: a session
 * token alone (a borrowed phone, a stolen token) must not be enough to take
 * the account over. Other devices are signed out and connected AI apps are
 * disconnected.
 */
authRoutes.post('/password', requireUser, async (c) => {
  const body = await readJson(c)
  const password = readPassword(body.password)
  const current = typeof body.current_password === 'string' ? body.current_password : ''
  const user = c.get('user')
  // Also caps guesses at the current password.
  rateLimit(`password:user:${user.id}`, 5, 60 * 60_000, 'Too many password change attempts. Please wait an hour and try again.')
  const stored = await pool.query<{ encrypted_password: string }>(
    'select encrypted_password from auth.users where id = $1',
    [user.id],
  )
  if (!current || !stored.rows[0] || !(await checkPassword(current, stored.rows[0].encrypted_password))) {
    throw new HttpError(400, 'Your current password is incorrect. If you have forgotten it, sign out and use "Forgot password".')
  }
  const hash = await hashPassword(password)
  await withTransaction(async (db) => {
    await db.query(
      'update auth.users set encrypted_password = $2, updated_at = now() where id = $1',
      [user.id, hash],
    )
    await db.query('delete from auth.sessions where user_id = $1 and token_hash <> $2', [
      user.id,
      hashToken(c.get('token')),
    ])
    // A reset link requested before the change must not undo it.
    await db.query('delete from auth.password_reset_tokens where user_id = $1', [user.id])
    await revokeConnectedApps(db, user.id)
  })
  return c.body(null, 204)
})

/**
 * Email a reset link. Answers 204 straight away, before looking the account
 * up, and does the rest in the background: the status and the response time
 * are then the same whether or not the address has an account, and whether
 * or not the email provider is up.
 */
authRoutes.post('/recover', async (c) => {
  limitByIp(c, 'recover')
  const body = await readJson(c)
  const email = readEmail(body.email)
  rateLimit(`recover:email:${email}`, 3, 60 * 60_000)

  void sendResetLink(email).catch((err: unknown) => {
    console.error('Password reset request failed:', err instanceof Error ? err.message : 'unknown error')
  })
  return c.body(null, 204)
})

async function sendResetLink(email: string) {
  const { rows } = await pool.query<{ id: string; email: string }>(
    'select id, email from auth.users where lower(email) = $1',
    [email],
  )
  const user = rows[0]
  if (!user) return
  const token = newToken()
  await pool.query(
    `insert into auth.password_reset_tokens (token_hash, user_id, expires_at)
     values ($1, $2, now() + make_interval(mins => $3))`,
    [hashToken(token), user.id, RESET_TOKEN_MINUTES],
  )
  await sendPasswordResetEmail(user.email, token)
}

/** Redeem a reset link: set the new password, sign out everywhere, disconnect AI apps, sign in here. */
authRoutes.post('/reset', async (c) => {
  limitByIp(c, 'reset')
  const body = await readJson(c)
  const token = typeof body.token === 'string' ? body.token : ''
  const password = readPassword(body.password)
  const invalid = () => new HttpError(400, 'This reset link is invalid or has expired. Request a new one.')

  // Look the token up before hashing, so a made-up token costs one indexed
  // read and nothing more. It is claimed atomically in the transaction below.
  const live = await pool.query(
    'select 1 from auth.password_reset_tokens where token_hash = $1 and used_at is null and expires_at > now()',
    [hashToken(token)],
  )
  if (!live.rowCount) throw invalid()
  const hash = await hashPassword(password)

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
    if (!user) throw invalid()
    await db.query(
      'update auth.users set encrypted_password = $2, updated_at = now() where id = $1',
      [user.id, hash],
    )
    await db.query('delete from auth.sessions where user_id = $1', [user.id])
    await revokeConnectedApps(db, user.id)
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
  await pool.query(
    'delete from auth.sessions where expires_at < now() or created_at < now() - make_interval(days => $1)',
    [SESSION_MAX_DAYS],
  )
  await pool.query(
    `delete from auth.password_reset_tokens
      where expires_at < now() - interval '1 day' or used_at < now() - interval '1 day'`,
  )
}
