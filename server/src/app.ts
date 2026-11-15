import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes, requireUser } from './auth.js'
import type { AppEnv } from './auth.js'
import { pool } from './db.js'
import { toHttpError } from './http.js'
import { OAuthError } from './oauth/errors.js'
import { wellKnownRoutes } from './oauth/metadata.js'
import { oauthRoutes } from './oauth/routes.js'
import { aiRoutes } from './routes/ai.js'
import { analyticsRoutes } from './routes/analytics.js'
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

app.use('/api/*', bodyLimit({ maxSize: 256 * 1024 }))

app.get('/api/health', async (c) => {
  await pool.query('select 1')
  return c.json({ ok: true })
})

app.route('/api/auth', authRoutes)

// OAuth discovery for MCP clients (off unless MCP_ENABLED=true).
app.route('/.well-known', wellKnownRoutes)
app.route('/api/oauth', oauthRoutes)

const data = new Hono<AppEnv>()
data.use('*', requireUser)
data.route('/', resourceRoutes)
data.route('/', profileRoutes)
data.route('/', workoutRoutes)
data.route('/', analyticsRoutes)
data.route('/', aiRoutes)
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
  console.error(err)
  return c.json({ error: 'Something went wrong on our side. Please try again.' }, 500)
})
