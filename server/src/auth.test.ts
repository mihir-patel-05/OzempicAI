import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.DATABASE_URL ??= 'postgres://unused@127.0.0.1:1/unused'
const { isEmail } = await import('./auth.js')

test('isEmail accepts ordinary addresses and rejects malformed ones', () => {
  for (const ok of ['a@b.co', 'first.last+tag@sub.example.com', 'ü@exämple.de']) assert.equal(isEmail(ok), true, ok)
  for (const bad of ['', 'a', 'a@b', '@b.co', 'a@.co', 'a@b.', 'a@@b.co', 'a b@c.de', 'a@b\n.co', 'a@b.co\n!']) {
    assert.equal(isEmail(bad), false, JSON.stringify(bad))
  }
})

test('isEmail is bounded: long and adversarial input is rejected quickly (SEC-12)', () => {
  const started = performance.now()
  assert.equal(isEmail(`${'a'.repeat(250)}@example.com`), false)
  assert.equal(isEmail('a@' + 'a.'.repeat(120_000) + '\n!'), false)
  assert.ok(performance.now() - started < 50)
})
