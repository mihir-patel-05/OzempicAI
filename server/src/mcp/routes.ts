import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from '../auth.js'
import { clientIp, countHit, hitCount, rateLimit } from '../auth.js'
import { HttpError } from '../http.js'
import { SCOPES, mcpEnabled, protectedResourceMetadataUrl } from '../oauth/config.js'
import { verifyAccessToken } from '../oauth/tokens.js'
import { buildMcpServer } from './server.js'

const CALLS_PER_WINDOW = 120
const WINDOW_MS = 15 * 60_000
const BAD_TOKENS_PER_WINDOW = 60

/**
 * The remote MCP endpoint (Streamable HTTP, stateless, JSON responses).
 * Mounted at /api/mcp before the session-only data routes.
 */
export const mcpRoutes = new Hono<AppEnv>()

// Authenticated by bearer token, never cookies, so any origin may call it
// (browser-based clients such as MCP Inspector need this).
mcpRoutes.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['POST', 'GET', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'Mcp-Protocol-Version', 'Mcp-Session-Id', 'Last-Event-ID'],
    exposeHeaders: ['WWW-Authenticate', 'Mcp-Session-Id'],
  }),
)
mcpRoutes.use('*', async (_c, next) => {
  if (!mcpEnabled()) throw new HttpError(404, 'Not found')
  await next()
})

/** 401 that points the client at our OAuth metadata (MCP authorization spec). */
function unauthorized(c: Context, error?: 'invalid_token') {
  const params = [
    `resource_metadata="${protectedResourceMetadataUrl()}"`,
    `scope="${SCOPES.join(' ')}"`,
    ...(error ? [`error="${error}"`, 'error_description="The access token is invalid or expired"'] : []),
  ]
  c.header('WWW-Authenticate', `Bearer ${params.join(', ')}`)
  return c.json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' }, id: null }, 401)
}

mcpRoutes.all('/', async (c) => {
  if (c.req.method !== 'POST') {
    // Stateless: no standalone SSE stream (GET) and no sessions to end (DELETE).
    c.header('Allow', 'POST')
    return c.json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null }, 405)
  }

  const header = c.req.header('authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!bearer) return unauthorized(c)
  // Each bad token costs a database lookup, so an address that keeps sending
  // them is refused before the lookup. Valid tokens are never counted here.
  const badTokenKey = `mcp-bad-token:${clientIp(c)}`
  if (hitCount(badTokenKey) >= BAD_TOKENS_PER_WINDOW) {
    throw new HttpError(429, 'Too many requests with an invalid token. Please wait a few minutes.')
  }
  const access = await verifyAccessToken(bearer)
  if (!access) {
    countHit(badTokenKey, WINDOW_MS)
    return unauthorized(c, 'invalid_token')
  }

  rateLimit(
    `mcp:grant:${access.grantId}`,
    CALLS_PER_WINDOW,
    WINDOW_MS,
    'Too many requests from this connected app. Please wait a few minutes.',
  )

  // One JSON-RPC message per request. The transport would run a batch of up
  // to 100 concurrently, and the limit above counts requests, so a batch
  // would multiply both the allowance and the load on the database pool.
  let message: unknown
  try {
    message = await c.req.json()
  } catch {
    return c.json({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null }, 400)
  }
  if (Array.isArray(message)) {
    return c.json(
      { jsonrpc: '2.0', error: { code: -32600, message: 'Batch requests are not supported. Send one message per request.' }, id: null },
      400,
    )
  }

  const server = buildMcpServer(access)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  try {
    return await transport.handleRequest(c.req.raw, { parsedBody: message })
  } finally {
    await server.close()
  }
})
