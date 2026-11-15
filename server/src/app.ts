import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes, clientIp, rateLimit, requireUser } from './auth.js'
import type { AppEnv } from './auth.js'
import { pool } from './db.js'
import { toHttpError } from './http.js'
import { OAuthError } from './oauth/errors.js'
import { wellKnownRoutes } from './oauth/metadata.js'
import { oauthRoutes } from './oauth/routes.js'
import { mcpRoutes } from './mcp/routes.js'
import { aiRoutes } from './routes/ai.js'
import { analyticsRoutes } from './routes/analytics.js'
import { connectionRoutes } from './routes/connections.js'
import { profileRoutes } from './routes/profile.js'
import { resourceRoutes } from './routes/resources.js'
import { workoutRoutes } from './routes/workouts.js'

/** The whole API. index.ts serves it; tests call app.request() directly. */
export const app = new Hono<AppEnv>()

app.use('*', logger())

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
data.route('/', resourceRoutes)
data.route('/', profileRoutes)
data.route('/', workoutRoutes)
data.route('/', analyticsRoutes)
data.route('/', aiRoutes)
data.route('/', connectionRoutes)
app.route('/api', data)

app.notFound((c) => c.json({ error: 'Not found' }, 404))

app.onError((err, c) => {
  if (err instanceof OAuthError) {
    c.header('Cache-Control', 'no-store')
    if (err.status === 401) c.header('WWW-Authenticate', 'Basic realm="OzempicAI"')
    return c.json(err.toJSON(), err.status)
  }
  const httpError = toHttpError(err)
  if (httpError) return c.json({ error: httpError.message }, httpError.status)
  if (isOverloaded(err)) {
    console.error('Database busy:', err instanceof Error ? err.message : err)
    c.header('Retry-After', '5')
    return c.json({ error: 'The service is busy. Please try again in a moment.' }, 503)
  }
  console.error(err)
  return c.json({ error: 'Something went wrong on our side. Please try again.' }, 500)
})

/** The pool had no free connection in time, or a statement hit its time limit. */
function isOverloaded(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  if ('code' in err && (err.code === '57014' || err.code === '25P03')) return true
  return err instanceof Error && err.message.includes('timeout exceeded when trying to connect')
}
