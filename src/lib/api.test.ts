import assert from 'node:assert/strict'
import { test } from 'node:test'

// Import a fresh instance per test, with browser storage and events isolated.
async function client() {
  let value: string | null = null
  let reloads = 0
  let readsFail = false
  let writesFail = false
  const events = new EventTarget()
  const storage = {
    getItem: () => { if (readsFail) throw new Error('Storage unavailable'); return value },
    setItem: (_key: string, next: string) => { if (writesFail) throw new Error('Storage unavailable'); value = next },
    removeItem: () => { if (writesFail) throw new Error('Storage unavailable'); value = null },
  }
  Object.assign(globalThis, { localStorage: storage, window: {
    addEventListener: events.addEventListener.bind(events), location: { reload: () => { reloads++ } },
  } })
  const api = await import(`./api.ts?test=${Math.random()}`) as typeof import('./api')
  return { ...api, storage, events, reloads: () => reloads,
    failStorage: (reads: boolean, writes: boolean) => { readsFail = reads; writesFail = writes } }
}
const A = { access_token: 'A', user: { id: 'A', email: 'a@example.test', user_metadata: {} } }
const B = { access_token: 'B', user: { id: 'B', email: 'b@example.test', user_metadata: {} } }

test('a cross-tab account change blocks stale mutations before the storage event arrives', async (t) => {
  const c = await client()
  c.storeSession(A)
  c.storage.setItem('ozempicai.session', JSON.stringify(B))
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('{}'))
  await assert.rejects(c.api('/profile', { method: 'PATCH', body: { name: 'Old account form' } }), /account changed/)
  assert.equal(fetch.mock.callCount(), 0)
  assert.equal(c.reloads(), 1)
})

test('external sign-out clears the account view and requests a full reload', async () => {
  const c = await client()
  c.storeSession(A)
  let seen: unknown = A
  c.onSessionChange(next => { seen = next })
  c.storage.removeItem()
  c.events.dispatchEvent(Object.assign(new Event('storage'), { key: 'ozempicai.session' }))
  assert.equal(seen, null)
  assert.equal(c.reloads(), 1)
})

test('a response started for the old account never populates the new account cache', async (t) => {
  const c = await client()
  c.storeSession(A)
  let finish!: (res: Response) => void
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>(r => { finish = r }))
  const request = c.api('/profile')
  c.storeSession(B)
  finish(new Response(JSON.stringify({ private: 'A data' })))
  await assert.rejects(request, /account changed/)
  assert.equal(c.loadSession()?.user.id, 'B')
})

test('a delayed 401 cannot remove a newly authenticated session', async (t) => {
  const c = await client()
  c.storeSession(A)
  let finish!: (res: Response) => void
  t.mock.method(globalThis, 'fetch', () => new Promise<Response>(r => { finish = r }))
  const request = c.api('/auth/user')
  c.storeSession(B)
  finish(new Response(JSON.stringify({ error: 'Expired old token' }), { status: 401 }))
  await assert.rejects(request, /Expired old token/)
  assert.equal(c.loadSession()?.access_token, 'B')
})

test('a 401 for the current token still signs out the expired session', async (t) => {
  const c = await client()
  c.storeSession(A)
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 401 }))
  await assert.rejects(c.api('/auth/user'))
  assert.equal(c.loadSession(), null)
})

for (const [reads, writes] of [[true, true], [true, false], [false, true]]) {
  test(`session credentials and sign-out work with storage read failure=${reads}, write failure=${writes}`, async (t) => {
    const c = await client()
    c.storeSession(A)
    c.failStorage(reads!, writes!)
    c.storeSession(B)
    let authorization: string | undefined
    t.mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
      authorization = (init?.headers as Record<string, string>).Authorization
      return new Response('{}')
    })
    assert.equal(c.loadSession()?.access_token, 'B')
    await c.api('/profile')
    assert.equal(authorization, 'Bearer B')
    c.storeSession(null)
    assert.equal(c.loadSession(), null)
    await c.api('/auth/login', { method: 'POST', body: {} })
    assert.equal(authorization, undefined)
    assert.equal(c.reloads(), 0)
    // Recovery of the storage API must not silently restore a stale token.
    c.failStorage(false, false)
    assert.equal(c.loadSession(), null)
  })
}

test('a storage read failure after sign-in retains the last known credential', async () => {
  const c = await client()
  c.storeSession(A)
  c.failStorage(true, false)
  assert.equal(c.loadSession()?.access_token, 'A')
})

test('external account events still invalidate a tab using memory fallback', async () => {
  const c = await client()
  c.failStorage(true, true)
  c.storeSession(A)
  c.events.dispatchEvent(Object.assign(new Event('storage'), { key: 'ozempicai.session' }))
  assert.equal(c.reloads(), 1)
  await assert.rejects(c.api('/profile'), /account changed/)
})
