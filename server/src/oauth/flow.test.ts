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
