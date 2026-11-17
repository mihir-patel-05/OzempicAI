import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { authRoutes, clientIp, rateLimit, requireUser } from './auth.js'
import type { AppEnv } from './auth.js'
import { pool } from './db.js'
import { toHttpError } from './http.js'
import { OAuthError } from './oauth/errors.js'
import { wellKnownRoutes } from './oauth/metadata.js'
import { oauthRoutes } from './oauth/routes.js'
import { mcpRoutes } from './mcp/routes.js'
import { activityRoutes } from './routes/activity.js'
import { aiRoutes } from './routes/ai.js'
import { analyticsRoutes } from './routes/analytics.js'
import { connectionRoutes } from './routes/connections.js'
import { fastingRoutes } from './routes/fasting.js'
import { profileRoutes } from './routes/profile.js'
import { resourceRoutes } from './routes/resources.js'
import { workoutRoutes } from './routes/workouts.js'

/** The whole API. index.ts serves it; tests call app.request() directly. */
export const app = new Hono<AppEnv>()

// One line per request: method, path, status, time. The query string is left
// out on purpose: it carries date ranges and OAuth parameters that don't
// belong in logs.
app.use('*', async (c, next) => {
  const started = Date.now()
  await next()
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${Date.now() - started}ms`)
})

// API responses hold health data and credentials: never cache them, in the
// browser or anywhere in between. Routes that set their own policy keep it.
app.use('/api/*', async (c, next) => {
  await next()
  if (!c.res.headers.has('Cache-Control')) c.res.headers.set('Cache-Control', 'no-store')
})

// The web service proxies /api on the same origin, so CORS is only needed when
// the frontend is served from somewhere else (e.g. a separate dev host).
const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
if (corsOrigins.length > 0) {
  app.use('/api/*', cors({ origin: corsOrigins, allowHeaders: ['Authorization', 'Content-Type'] }))
}

// Sign-in bodies are an email, a password and a name: a few hundred bytes.
app.use('/api/auth/*', bodyLimit({ maxSize: 8 * 1024 }))
app.use('/api/*', bodyLimit({ maxSize: 256 * 1024 }))

// A ceiling on requests per address across the whole API, counted before any
// route touches the database. Generous for a person using the app (the
// busiest screen makes a few dozen requests); it exists to blunt floods of
// cheap unauthenticated requests. /api/mcp is left out because AI apps call
// it from shared server addresses; it has its own limits. Requests with no
// usable address (local development, internal health checks) are not counted.
const REQUESTS_PER_ADDRESS = Number(process.env.RATE_LIMIT_PER_ADDRESS) || 600
app.use('/api/*', async (c, next) => {
  const ip = clientIp(c)
  if (ip !== 'unknown' && !c.req.path.startsWith('/api/mcp')) {
    rateLimit(`ip-all:${ip}`, REQUESTS_PER_ADDRESS, 5 * 60_000, 'Too many requests. Please slow down and try again in a few minutes.')
  }
  await next()
})

// Anyone can call this, so it checks the database at most once every few
// seconds and otherwise answers from the last result.
const HEALTH_PROBE_MS = 5_000
let health = { checkedAt: 0, ok: true }
app.get('/api/health', async (c) => {
  if (Date.now() - health.checkedAt >= HEALTH_PROBE_MS) {
    health.checkedAt = Date.now()
    health.ok = await pool.query('select 1').then(
      () => true,
      () => false,
    )
  }
  return health.ok ? c.json({ ok: true }) : c.json({ ok: false }, 503)
})

app.route('/api/auth', authRoutes)

// OAuth discovery for MCP clients (off unless MCP_ENABLED=true).
app.route('/.well-known', wellKnownRoutes)
app.route('/api/oauth', oauthRoutes)
// Bearer-token MCP endpoint. Must come before `data`, whose requireUser would
// reject OAuth access tokens.
app.route('/api/mcp', mcpRoutes)

const data = new Hono<AppEnv>()
data.use('*', requireUser)
// A ceiling on changes per account, whichever address they come from. Far
// above what a person logging meals and workouts does; it stops a script from
// filling the database through one account.
data.use('*', async (c, next) => {
  if (c.req.method !== 'GET') {
    rateLimit(`writes:${c.get('user').id}`, 600, 15 * 60_000, 'Too many changes in a short time. Please wait a few minutes.')
  }
  await next()
})
data.route('/', resourceRoutes)
data.route('/', profileRoutes)
data.route('/', workoutRoutes)
data.route('/', fastingRoutes)
data.route('/', analyticsRoutes)
data.route('/', aiRoutes)
data.route('/', connectionRoutes)
data.route('/', activityRoutes)
app.route('/api', data)

app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  if (err instanceof OAuthError) {
    c.header('Cache-Control', 'no-store')
    if (err.status === 401) c.header('WWW-Authenticate', 'Basic realm="OzempicAI"')
    return c.json(err.toJSON(), err.status)
  }
  // Raised by Hono's own middleware, e.g. 413 from the body limit.
  if (err instanceof HTTPException) {
    const message = err.status === 413 ? 'That request is too large.' : 'The request could not be processed.'
    return c.json({ error: message }, err.status)
  }
  const httpError = toHttpError(err)
  if (httpError) return c.json({ error: httpError.message }, httpError.status)
  if (isOverloaded(err)) {
    console.error('Database busy:', err instanceof Error ? err.message : err)
    c.header('Retry-After', '5')
    return c.json({ error: 'The service is busy. Please try again in a moment.' }, 503)
  }
  // Not the whole error object: a database error's detail can include row values.
  console.error('Unhandled error:', describeError(err))
  return c.json({ error: 'Something went wrong on our side. Please try again.' }, 500)
})

/** The pool had no free connection in time, or a statement hit its time limit. */
function isOverloaded(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  if ('code' in err && (err.code === '57014' || err.code === '25P03')) return true
  return err instanceof Error && err.message.includes('timeout exceeded when trying to connect')
}

function describeError(err: unknown): string {
  if (!(err instanceof Error)) return 'non-error thrown'
  const code = 'code' in err && typeof err.code === 'string' ? ` code=${err.code}` : ''
  const frame = err.stack?.split('\n')[1]?.trim() ?? ''
  return `${err.name}: ${err.message.slice(0, 300)}${code} ${frame}`
}
