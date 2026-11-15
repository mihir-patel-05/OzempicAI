import { serve } from '@hono/node-server'
import { app } from './app.js'
import { purgeExpiredAuthRows } from './auth.js'
import { pool } from './db.js'

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
