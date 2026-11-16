import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import bcrypt from 'bcryptjs'

const database = process.env.TEST_DATABASE_URL
let app: typeof import('./app.js').app
let pool: typeof import('./db.js').pool
let hashToken: typeof import('./auth.js').hashToken
before(async () => {
  if (!database) return
  process.env.DATABASE_URL = database
  process.env.SIGNUP_MODE = 'open'
  app = (await import('./app.js')).app
  ;({ pool } = await import('./db.js'))
  ;({ hashToken } = await import('./auth.js'))
})
after(async () => { if (pool) await pool.end() })

for (const operation of ['reset', 'password'] as const) {
  test(`recovery race: a login verified before ${operation} cannot create a session afterward`, { skip: !database }, async (t) => {
    const email = `race-${randomUUID()}@example.test`
    const password = 'original test password'
    const call = (path: string, body: unknown, token?: string) => app.request(`/api/auth/${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    })
    const signup = await call('signup', { email, password })
    assert.equal(signup.status, 201)
    const user = await signup.json() as { user: { id: string }; access_token: string }
    let verified!: () => void
    let release!: () => void
    const ready = new Promise<void>(resolve => { verified = resolve })
    const resume = new Promise<void>(resolve => { release = resolve })
    const compare = bcrypt.compare.bind(bcrypt)
    let pause = true
    const mock = t.mock.method(bcrypt, 'compare', async (candidate: string, hash: string) => {
      const result = await compare(candidate, hash)
      if (pause) { pause = false; verified(); await resume }
      return result
    })
    const login = call('login', { email, password })
    try {
      await ready
      const next = 'replacement test password'
      let response: Response
      if (operation === 'reset') {
        const token = randomUUID()
        await pool.query('insert into auth.password_reset_tokens(token_hash,user_id,expires_at) values($1,$2,now()+interval \'1 hour\')', [hashToken(token), user.user.id])
        response = await call('reset', { token, password: next })
      } else {
        response = await call('password', { current_password: password, password: next }, user.access_token)
      }
      assert.equal(response.status, operation === 'reset' ? 200 : 204)
      release()
      assert.equal((await login).status, 400)
      assert.equal((await call('login', { email, password: next })).status, 200)
    } finally {
      release()
      await login
      mock.mock.restore()
      await pool.query('delete from auth.users where id=$1', [user.user.id])
    }
  })
}
