import assert from 'node:assert/strict'
import { test } from 'node:test'

// Import a fresh instance per test, with browser storage and events isolated.
async function client() {
  let value: string | null = null
  let reloads = 0
  const events = new EventTarget()
  const storage = {
    getItem: () => value,
    setItem: (_key: string, next: string) => { value = next },
    removeItem: () => { value = null },
  }
  Object.assign(globalThis, { localStorage: storage, window: {
    addEventListener: events.addEventListener.bind(events), location: { reload: () => { reloads++ } },
  } })
  const api = await import(`./api.ts?test=${Math.random()}`) as typeof import('./api')
  return { ...api, storage, events, reloads: () => reloads }
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
