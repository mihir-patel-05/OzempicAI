import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import { testInvitation } from './test-support.js'

const database = process.env.TEST_DATABASE_URL
let app: typeof import('./app.js').app
let pool: typeof import('./db.js').pool
let withUser: typeof import('./db.js').withUser
let hashToken: typeof import('./auth.js').hashToken
before(async () => {
  if (!database) return
  process.env.DATABASE_URL = database
  process.env.SIGNUP_MODE = 'open'
  app = (await import('./app.js')).app
  ;({ pool, withUser } = await import('./db.js'))
  ;({ hashToken } = await import('./auth.js'))
})
after(async () => { if (pool) await pool.end() })

test('signup requires an unexpired, single-use invitation matching the email even when open', { skip: !database }, async () => {
  const email = `invited-${randomUUID()}@example.test`
  const signup = (invite_token?: string, address = email) => app.request('/api/auth/signup', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: address, password: 'test password', invite_token }),
  })
  assert.equal((await signup()).status, 400)
  assert.equal((await signup('not-an-invitation')).status, 400)
  const token = await testInvitation(email)
  assert.equal((await signup(token, 'other@example.test')).status, 400)
  await pool.query("update auth.signup_invitations set expires_at=now()-interval '1 minute' where token_hash=$1", [hashToken(token)])
  assert.equal((await signup(token)).status, 400)
  assert.equal((await pool.query('select 1 from auth.users where email=$1', [email])).rowCount, 0)
  const fresh = await testInvitation(email)
  const responses = await Promise.all([signup(fresh), signup(fresh)])
  assert.equal(responses.filter(r => r.status === 201).length, 1)
  assert.ok(responses.every(r => [201, 400, 409].includes(r.status)))
  assert.equal((await signup(fresh)).status, 400)
  const account = await (responses.find(r => r.status === 201)!).json() as { user: { id: string }; access_token: string }
  // Invited users get the normal session, while uninvited attempts get none.
  assert.equal((await app.request('/api/profile', { headers: { authorization: `Bearer ${account.access_token}` } })).status, 200)
  await assert.rejects(withUser(account.user.id, db => db.query('select * from auth.signup_invitations')), /permission denied/)
  await assert.rejects(withUser(account.user.id, db => db.query("insert into auth.signup_invitations values ('forged','forged@example.test',now(),now(),null)")), /permission denied/)
  await pool.query('delete from auth.users where id=$1', [account.user.id])
})
