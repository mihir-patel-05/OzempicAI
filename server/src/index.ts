import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { authRoutes, purgeExpiredAuthRows, requireUser } from './auth.js'
import type { AppEnv } from './auth.js'
import { pool } from './db.js'
import { toHttpError } from './http.js'
import { aiRoutes } from './routes/ai.js'
import { analyticsRoutes } from './routes/analytics.js'
import { profileRoutes } from './routes/profile.js'
import { resourceRoutes } from './routes/resources.js'
import { workoutRoutes } from './routes/workouts.js'

const app = new Hono<AppEnv>()

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
  const httpError = toHttpError(err)
  if (httpError) return c.json({ error: httpError.message }, httpError.status)
  console.error(err)
  return c.json({ error: 'Something went wrong on our side. Please try again.' }, 500)
})

const port = Number(process.env.PORT ?? 8787)
// '::' accepts IPv4 and IPv6, which Railway's private network needs. Set
// HOST=0.0.0.0 on machines without IPv6.
const hostname = process.env.HOST ?? '::'
const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`API listening on port ${info.port}`)
})

const housekeeping = setInterval(() => {
  purgeExpiredAuthRows().catch((err) => console.error('Auth housekeeping failed', err))
}, 60 * 60_000)
housekeeping.unref()

function shutdown() {
  clearInterval(housekeeping)
  server.close(() => {
    pool.end().finally(() => process.exit(0))
  })
  setTimeout(() => process.exit(0), 10_000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
