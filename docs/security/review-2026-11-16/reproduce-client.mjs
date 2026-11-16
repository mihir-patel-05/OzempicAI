// node docs/security/review-2026-11-16/reproduce-client.mjs
// Exercises the actual API module with fake browser storage/network, not a browser.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync(new URL('../../../src/lib/api.ts', import.meta.url), 'utf8')
  .replace("import { createSseParser } from './sse'", 'const createSseParser = () => {}')
  .replace('import.meta.env.VITE_API_URL', 'undefined')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const A = { access_token: 'synthetic-A', user: { id: 'A' } }
const B = { access_token: 'synthetic-B', user: { id: 'B' } }
let stored = null
let blocked = false
let fetchImpl
const context = vm.createContext({ exports: {}, URLSearchParams, TextDecoder,
  localStorage: {
    getItem() { if (blocked) throw Error('storage blocked'); return stored },
    setItem(_key, value) { if (blocked) throw Error('storage blocked'); stored = value },
    removeItem() { if (blocked) throw Error('storage blocked'); stored = null },
  },
  fetch: (...args) => fetchImpl(...args),
})
vm.runInContext(compiled, context)
const api = context.exports
let displayed = null
api.onSessionChange(session => displayed = session)
api.storeSession(A)
stored = JSON.stringify(B) // Another tab changes shared localStorage.
let authorization
fetchImpl = async (_url, init) => {
  authorization = init.headers.Authorization
  return new Response('{}', { status: 200 })
}
await api.api('/profile', { method: 'PATCH', body: { name: 'Edit in tab A' } })
assert.equal(displayed.user.id, 'A')
assert.equal(authorization, 'Bearer synthetic-B')
console.log('CONFIRMED: tab displaying account A sends a mutation with account B token')

api.storeSession(A)
let resolveFetch
fetchImpl = () => new Promise(r => resolveFetch = r)
const oldRequest = api.api('/auth/user').catch(e => e)
api.storeSession(B)
resolveFetch(new Response('{}', { status: 401 }))
await oldRequest
assert.equal(api.loadSession(), null)
console.log('CONFIRMED: delayed 401 for account A clears newly signed-in account B')

blocked = true
api.storeSession(A)
assert.equal(displayed.user.id, 'A')
assert.equal(api.loadSession(), null)
console.log('CONFIRMED: storage failure announces signed-in state but retains no request credential')
