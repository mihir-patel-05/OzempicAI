import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from '../auth.js'
import { clientIp, rateLimit } from '../auth.js'
import { HttpError, readJson } from '../http.js'
import { registerClient } from './clients.js'
import { mcpEnabled } from './config.js'
import { parseRegistration } from './registration.js'

/**
 * The OAuth authorization server behind /api/mcp, mounted at /api/oauth
 * before the session-only data routes (docs/mcp-server-plan.md §3.3).
 */
export const oauthRoutes = new Hono<AppEnv>()

oauthRoutes.use('*', async (_c, next) => {
  if (!mcpEnabled()) throw new HttpError(404, 'Not found')
  await next()
})

// Called by AI apps' servers or, for some clients, from a browser. No cookies
// are involved, so any origin may call these.
const publicCors = cors({ origin: '*', allowMethods: ['POST', 'OPTIONS'], allowHeaders: ['Authorization', 'Content-Type'] })
oauthRoutes.use('/register', publicCors)
oauthRoutes.use('/token', publicCors)
oauthRoutes.use('/revoke', publicCors)

/** Dynamic Client Registration (RFC 7591). */
oauthRoutes.post('/register', async (c) => {
  rateLimit(`oauth-register:ip:${clientIp(c)}`, 20, 60 * 60_000)
  const registration = parseRegistration(await readJson(c))
  c.header('Cache-Control', 'no-store')
  return c.json(await registerClient(registration), 201)
})
