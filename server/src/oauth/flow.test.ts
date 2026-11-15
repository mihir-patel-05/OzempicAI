/**
 * The whole OAuth flow against a real database. Runs only when
 * TEST_DATABASE_URL points at a migrated, disposable Postgres, e.g.
 *   TEST_DATABASE_URL=postgres://postgres@localhost:55432/ozempicai npm test
 */
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { after, before, test } from 'node:test'

const DB = process.env.TEST_DATABASE_URL
const skip = DB ? false : 'set TEST_DATABASE_URL to run'
const APP = 'https://app.test'
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback'

type App = typeof import('../app.js').app
let app: App
let tokens: typeof import('./tokens.js')
let endPool: () => Promise<void>

before(async () => {
  if (!DB) return
  process.env.DATABASE_URL = DB
  process.env.MCP_ENABLED = 'true'
  process.env.APP_URL = APP
  app = (await import('../app.js')).app
  tokens = await import('./tokens.js')
  const { pool } = await import('../db.js')
  endPool = () => pool.end()
})

after(async () => {
  if (endPool) await endPool()
})

// ─── Helpers ────────────────────────────────────────────────────────────────

async function json(res: Response) {
  return (await res.json()) as Record<string, unknown>
}

async function signUp(): Promise<string> {
  const email = `mcp-${randomBytes(6).toString('hex')}@example.com`
  const res = await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'correct horse battery', name: 'Test' }),
  })
  assert.equal(res.status, 201)
  return (await json(res)).access_token as string
}

async function registerClient(body: Record<string, unknown> = {}) {
  const res = await app.request('/api/oauth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Claude',
      redirect_uris: [REDIRECT],
      token_endpoint_auth_method: 'none',
      ...body,
    }),
  })
  assert.equal(res.status, 201)
  return json(res)
}

function pkce() {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

function authorizeParams(clientId: string, challenge: string, extra: Record<string, string> = {}) {
  return {
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    scope: 'read write',
    state: 'xyz',
    resource: `${APP}/api/mcp`,
    ...extra,
  }
}

async function approve(session: string, params: Record<string, string>, scopes = ['read', 'write']) {
  const res = await app.request('/api/oauth/authorize', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` },
    body: JSON.stringify({ params, decision: 'allow', scopes }),
  })
  assert.equal(res.status, 200)
  return new URL((await json(res)).redirect_to as string)
}

function token(form: Record<string, string>, headers: Record<string, string> = {}) {
  return app.request('/api/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: new URLSearchParams(form).toString(),
  })
}

/** Run the whole dance and return the token response plus what produced it. */
async function connect(session: string, scopes = ['read', 'write']) {
  const client = await registerClient()
  const { verifier, challenge } = pkce()
  const redirect = await approve(session, authorizeParams(client.client_id as string, challenge), scopes)
  const code = redirect.searchParams.get('code')!
  const res = await token({
    grant_type: 'authorization_code',
    client_id: client.client_id as string,
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT,
    resource: `${APP}/api/mcp`,
  })
  assert.equal(res.status, 200)
  return { client, code, verifier, tokens: await json(res) }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test('discovery documents are served when MCP is enabled', { skip }, async () => {
  const resource = await app.request('/.well-known/oauth-protected-resource/api/mcp')
  assert.equal(resource.status, 200)
  assert.equal((await json(resource)).resource, `${APP}/api/mcp`)
  const server = await app.request('/.well-known/oauth-authorization-server')
  assert.equal((await json(server)).issuer, APP)
})

test('consent screen request: details for a valid request, errors for bad ones', { skip }, async () => {
  const session = await signUp()
  const client = await registerClient()
  const { challenge } = pkce()
  const query = (params: Record<string, string>) =>
    app.request(`/api/oauth/authorize?${new URLSearchParams(params)}`, {
      headers: { authorization: `Bearer ${session}` },
    })

  const ok = await query(authorizeParams(client.client_id as string, challenge))
  assert.equal(ok.status, 200)
  assert.deepEqual(await json(ok), { client_name: 'Claude', redirect_to_label: 'claude.ai', scopes: ['read', 'write'] })

  // Needs an OzempicAI session.
  const anonymous = await app.request(`/api/oauth/authorize?${new URLSearchParams(authorizeParams('x', challenge))}`)
  assert.equal(anonymous.status, 401)

  // Unknown client or unregistered redirect: shown to the user, never redirected.
  assert.equal((await query(authorizeParams('oza_cid_nope', challenge))).status, 400)
  assert.equal(
    (await query(authorizeParams(client.client_id as string, challenge, { redirect_uri: 'https://evil.example/cb' }))).status,
    400,
  )

  // Missing PKCE goes back to the app as an OAuth error.
  const noPkce = await json(await query(authorizeParams(client.client_id as string, challenge, { code_challenge_method: 'plain' })))
  const back = new URL(noPkce.redirect_to as string)
  assert.equal(back.origin + back.pathname, REDIRECT)
  assert.equal(back.searchParams.get('error'), 'invalid_request')
  assert.equal(back.searchParams.get('state'), 'xyz')
  assert.equal(back.searchParams.get('iss'), APP)
})

test('denying returns access_denied to the app', { skip }, async () => {
  const session = await signUp()
  const client = await registerClient()
  const res = await app.request('/api/oauth/authorize', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` },
    body: JSON.stringify({ params: authorizeParams(client.client_id as string, pkce().challenge), decision: 'deny' }),
  })
  const back = new URL((await json(res)).redirect_to as string)
  assert.equal(back.searchParams.get('error'), 'access_denied')
  assert.equal(back.searchParams.get('code'), null)
})

test('code exchange issues tokens for the user with the chosen scopes', { skip }, async () => {
  const session = await signUp()
  const { tokens: issued } = await connect(session, ['read'])
  assert.equal(issued.token_type, 'Bearer')
  assert.equal(issued.scope, 'read')
  assert.match(issued.access_token as string, /^oza_at_/)
  assert.match(issued.refresh_token as string, /^oza_rt_/)

  const access = await tokens.verifyAccessToken(issued.access_token as string)
  assert.ok(access)
  assert.deepEqual(access.scopes, ['read'])
  assert.equal(access.clientName, 'Claude')
  // A refresh token is not an access token.
  assert.equal(await tokens.verifyAccessToken(issued.refresh_token as string), null)
})

test('code exchange rejects a wrong verifier, another client, and a replay', { skip }, async () => {
  const session = await signUp()
  const client = await registerClient()
  const other = await registerClient()
  const { verifier, challenge } = pkce()
  const code = (await approve(session, authorizeParams(client.client_id as string, challenge))).searchParams.get('code')!
  const base = { grant_type: 'authorization_code', code, redirect_uri: REDIRECT }

  const wrongVerifier = await token({ ...base, client_id: client.client_id as string, code_verifier: pkce().verifier })
  assert.equal(wrongVerifier.status, 400)
  assert.equal((await json(wrongVerifier)).error, 'invalid_grant')

  const wrongClient = await token({ ...base, client_id: other.client_id as string, code_verifier: verifier })
  assert.equal((await json(wrongClient)).error, 'invalid_grant')

  const ok = await token({ ...base, client_id: client.client_id as string, code_verifier: verifier })
  assert.equal(ok.status, 200)
  const issued = await json(ok)

  // Replaying the code fails and disconnects what it was exchanged for.
  const replay = await token({ ...base, client_id: client.client_id as string, code_verifier: verifier })
  assert.equal((await json(replay)).error, 'invalid_grant')
  assert.equal(await tokens.verifyAccessToken(issued.access_token as string), null)
})

test('refresh rotates tokens; a quick retry fails without disconnecting', { skip }, async () => {
  const session = await signUp()
  const { client, tokens: first } = await connect(session)
  const refresh = (refreshToken: string) =>
    token({ grant_type: 'refresh_token', client_id: client.client_id as string, refresh_token: refreshToken })

  const rotated = await refresh(first.refresh_token as string)
  assert.equal(rotated.status, 200)
  const second = await json(rotated)
  assert.notEqual(second.refresh_token, first.refresh_token)
  assert.equal(second.scope, 'read write')

  const retry = await refresh(first.refresh_token as string)
  assert.equal((await json(retry)).error, 'invalid_grant')
  assert.ok(await tokens.verifyAccessToken(second.access_token as string), 'a quick retry keeps the connection')

  const narrower = await token({
    grant_type: 'refresh_token',
    client_id: client.client_id as string,
    refresh_token: second.refresh_token as string,
    scope: 'read admin',
  })
  assert.equal((await json(narrower)).error, 'invalid_scope')
})

test('secret-based clients must authenticate at the token endpoint', { skip }, async () => {
  const session = await signUp()
  const client = await registerClient({ token_endpoint_auth_method: 'client_secret_basic' })
  assert.match(client.client_secret as string, /^oza_cs_/)
  const { verifier, challenge } = pkce()
  const code = (await approve(session, authorizeParams(client.client_id as string, challenge))).searchParams.get('code')!
  const form = { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: REDIRECT }

  const noSecret = await token({ ...form, client_id: client.client_id as string })
  assert.equal(noSecret.status, 401)
  assert.equal((await json(noSecret)).error, 'invalid_client')

  const basic = Buffer.from(`${client.client_id}:${client.client_secret}`).toString('base64')
  const ok = await token(form, { authorization: `Basic ${basic}` })
  assert.equal(ok.status, 200)
})

test('revoking a token ends the connection', { skip }, async () => {
  const session = await signUp()
  const { client, tokens: issued } = await connect(session)
  const res = await app.request('/api/oauth/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: client.client_id as string, token: issued.refresh_token as string }).toString(),
  })
  assert.equal(res.status, 200)
  assert.equal(await tokens.verifyAccessToken(issued.access_token as string), null)
})

// ─── /api/mcp with real tokens ──────────────────────────────────────────────

let rpcId = 0
async function rpc(accessToken: string | null, method: string, params: Record<string, unknown> = {}) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': '2025-11-25',
  }
  if (accessToken) headers.authorization = `Bearer ${accessToken}`
  return app.request('/api/mcp', {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })
}

async function callTool(accessToken: string, name: string, args: Record<string, unknown>) {
  const res = await rpc(accessToken, 'tools/call', { name, arguments: args })
  assert.equal(res.status, 200)
  const body = await json(res)
  const result = body.result as { content: { text: string }[]; isError?: boolean }
  return { isError: result.isError === true, text: result.content[0]!.text }
}

test('/api/mcp without a valid token points the client at OAuth discovery', { skip }, async () => {
  const none = await rpc(null, 'tools/list')
  assert.equal(none.status, 401)
  const challenge = none.headers.get('www-authenticate') ?? ''
  assert.match(challenge, /^Bearer /)
  assert.match(challenge, /resource_metadata="https:\/\/app\.test\/\.well-known\/oauth-protected-resource\/api\/mcp"/)
  assert.doesNotMatch(challenge, /invalid_token/)

  const bad = await rpc('oza_at_not-a-real-token', 'tools/list')
  assert.equal(bad.status, 401)
  assert.match(bad.headers.get('www-authenticate') ?? '', /error="invalid_token"/)

  // A web session token is not an MCP token.
  const session = await signUp()
  assert.equal((await rpc(session, 'tools/list')).status, 401)

  const get = await app.request('/api/mcp', { method: 'GET' })
  assert.equal(get.status, 405)
})

test('a connected app can initialize, list and call tools, and its writes are logged', { skip }, async () => {
  const session = await signUp()
  const { tokens: issued } = await connect(session)
  const accessToken = issued.access_token as string

  const init = await rpc(accessToken, 'initialize', {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'flow-test', version: '1.0.0' },
  })
  assert.equal(init.status, 200)
  const initResult = (await json(init)).result as { serverInfo: { name: string }; instructions: string }
  assert.equal(initResult.serverInfo.name, 'ozempicai')
  assert.match(initResult.instructions, /get_profile first/)

  const list = (await json(await rpc(accessToken, 'tools/list'))).result as { tools: { name: string }[] }
  assert.ok(list.tools.some((tool) => tool.name === 'add_grocery_items'))

  const profile = await callTool(accessToken, 'get_profile', {})
  assert.equal(profile.isError, false)
  assert.equal(JSON.parse(profile.text).timezone, 'UTC')

  const added = await callTool(accessToken, 'add_grocery_items', {
    items: [
      { name: 'Greek yogurt', category: 'dairy' },
      { name: 'Spinach', category: 'produce' },
    ],
  })
  assert.equal(added.isError, false)
  assert.deepEqual(JSON.parse(added.text).added, ['Greek yogurt', 'Spinach'])

  const listed = JSON.parse((await callTool(accessToken, 'get_grocery_list', { include_purchased: false })).text)
  assert.equal(listed.count, 2)
  assert.match(listed.items[0].id, /^[0-9a-f-]{36}$/)

  const bad = await callTool(accessToken, 'add_grocery_items', { items: [{ name: 'Ice', category: 'frozen' }] })
  assert.equal(bad.isError, true)

  const { pool } = await import('../db.js')
  const access = await tokens.verifyAccessToken(accessToken)
  const { rows } = await pool.query(
    'select client_name, tool_name, summary, resource, cardinality(created_ids) as n from public.agent_activity where user_id = $1',
    [access!.userId],
  )
  assert.deepEqual(rows, [
    { client_name: 'Claude', tool_name: 'add_grocery_items', summary: 'Added 2 items to Groceries', resource: 'grocery-items', n: 2 },
  ])
})

test('read-only connections cannot write, and users never see each other’s rows', { skip }, async () => {
  const writer = (await connect(await signUp())).tokens.access_token as string
  await callTool(writer, 'add_grocery_items', { items: [{ name: 'Private item', category: 'other' }] })

  const reader = (await connect(await signUp(), ['read'])).tokens.access_token as string
  const list = (await json(await rpc(reader, 'tools/list'))).result as { tools: { name: string }[] }
  assert.ok(!list.tools.some((tool) => tool.name === 'add_grocery_items'))

  const denied = await callTool(reader, 'add_grocery_items', { items: [{ name: 'Milk', category: 'dairy' }] })
  assert.equal(denied.isError, true)
  assert.match(denied.text, /read-only/)

  const theirs = JSON.parse((await callTool(reader, 'get_grocery_list', { include_purchased: true })).text)
  assert.equal(theirs.count, 0)
})

test('Profile lists connected apps and Disconnect revokes them', { skip }, async () => {
  const session = await signUp()
  const { tokens: issued } = await connect(session, ['read'])
  const auth = { authorization: `Bearer ${session}` }

  const listed = (await (await app.request('/api/connections', { headers: auth })).json()) as {
    id: string
    client_name: string
    scopes: string[]
    last_used_at: string | null
  }[]
  assert.equal(listed.length, 1)
  assert.equal(listed[0]!.client_name, 'Claude')
  assert.deepEqual(listed[0]!.scopes, ['read'])
  assert.ok(listed[0]!.last_used_at)

  // Another user can't see or remove it.
  const stranger = { authorization: `Bearer ${await signUp()}` }
  assert.deepEqual(await (await app.request('/api/connections', { headers: stranger })).json(), [])
  const notYours = await app.request(`/api/connections/${listed[0]!.id}`, { method: 'DELETE', headers: stranger })
  assert.equal(notYours.status, 404)

  const removed = await app.request(`/api/connections/${listed[0]!.id}`, { method: 'DELETE', headers: auth })
  assert.equal(removed.status, 204)
  assert.equal(await tokens.verifyAccessToken(issued.access_token as string), null)
  assert.deepEqual(await (await app.request('/api/connections', { headers: auth })).json(), [])
})
