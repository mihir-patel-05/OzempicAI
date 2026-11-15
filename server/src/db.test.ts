import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.DATABASE_URL ??= 'postgres://unused@127.0.0.1:1/unused'
const { sslConfig } = await import('./db.js')

test('DATABASE_SSL=true verifies the server certificate (SEC-13)', () => {
  assert.equal(sslConfig({}), undefined)
  assert.equal(sslConfig({ DATABASE_SSL: 'false' }), undefined)
  assert.deepEqual(sslConfig({ DATABASE_SSL: 'true' }), { rejectUnauthorized: true })
  assert.deepEqual(sslConfig({ DATABASE_SSL: 'verify', DATABASE_CA_CERT: 'PEM' }), { rejectUnauthorized: true, ca: 'PEM' })
  assert.throws(() => sslConfig({ DATABASE_SSL: 'yes' }))
  const warn = console.warn
  console.warn = () => {}
  try {
    assert.deepEqual(sslConfig({ DATABASE_SSL: 'no-verify' }), { rejectUnauthorized: false })
  } finally {
    console.warn = warn
  }
})
