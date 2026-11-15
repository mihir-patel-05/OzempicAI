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

test('rate-limit keys built from long input are stored at a fixed size (SEC-17)', async () => {
  const { rateLimit, rateLimitKeyCount } = await import('./auth.js')
  const before = rateLimitKeyCount()
  const long = `login:email:${'a'.repeat(200_000)}@example.com`
  rateLimit(long, 2, 60_000)
  rateLimit(long, 2, 60_000)
  assert.throws(() => rateLimit(long, 2, 60_000), /Too many attempts/)
  assert.equal(rateLimitKeyCount(), before + 1)
})

test('client address comes only from a well-formed X-Real-IP (SEC-02)', async () => {
  const { clientIpFromHeader } = await import('./auth.js')
  assert.equal(clientIpFromHeader('203.0.113.7'), '203.0.113.7')
  assert.equal(clientIpFromHeader(' 203.0.113.7 '), '203.0.113.7')
  assert.equal(clientIpFromHeader('::ffff:203.0.113.7'), '203.0.113.7')
  // One /64 is one bucket, however the address is written.
  assert.equal(clientIpFromHeader('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), '2001:db8:1:2::/64')
  assert.equal(clientIpFromHeader('2001:0db8:0001:0002::1'), '2001:db8:1:2::/64')
  assert.equal(clientIpFromHeader('2001:db8::1'), '2001:db8:0:0::/64')
  for (const bad of [undefined, '', 'rotated-1', '203.0.113.7, 10.0.0.1', 'x'.repeat(5000)]) {
    assert.equal(clientIpFromHeader(bad), 'unknown')
  }
})
