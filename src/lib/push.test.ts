import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { base64UrlToBytes, isAppleMobile, pushSupport } from './push'
import type { PushEnvironment } from './push'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.1 Mobile/15E148 Safari/604.1'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15'
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36'

const everything = { hasServiceWorker: true, hasPushManager: true, hasNotification: true }

function env(overrides: Partial<PushEnvironment>): PushEnvironment {
  return { userAgent: ANDROID, platform: 'Linux armv8l', maxTouchPoints: 5, standalone: false, ...everything, ...overrides }
}

describe('pushSupport', () => {
  it('asks iPhone users in a Safari tab to add the app to the Home Screen', () => {
    // Safari tabs on iOS have no PushManager; the answer is still "install", not "unsupported".
    assert.equal(pushSupport(env({ userAgent: IPHONE, platform: 'iPhone', hasPushManager: false, hasNotification: false })), 'install-first')
  })

  it('treats a touch "Mac" as an iPad', () => {
    assert.equal(isAppleMobile({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 }), true)
    assert.equal(isAppleMobile({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 }), false)
    assert.equal(pushSupport(env({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 })), 'install-first')
  })

  it('supports the Home Screen app on iOS 16.4 and later', () => {
    assert.equal(pushSupport(env({ userAgent: IPHONE, platform: 'iPhone', standalone: true })), 'supported')
  })

  it('says unsupported when an installed iPhone app has no Push API (older iOS)', () => {
    assert.equal(pushSupport(env({ userAgent: IPHONE, platform: 'iPhone', standalone: true, hasPushManager: false })), 'unsupported')
  })

  it('supports desktop and Android browsers in a normal tab', () => {
    assert.equal(pushSupport(env({})), 'supported')
    assert.equal(pushSupport(env({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 })), 'supported')
    assert.equal(pushSupport(env({ hasServiceWorker: false })), 'unsupported')
  })
})

describe('base64UrlToBytes', () => {
  it('decodes unpadded base64url, including - and _', () => {
    assert.deepEqual([...base64UrlToBytes('-_8')], [0xfb, 0xff])
    assert.deepEqual([...base64UrlToBytes('AQID')], [1, 2, 3])
    assert.deepEqual([...base64UrlToBytes('AQIDBA')], [1, 2, 3, 4])
  })

  it('reads a VAPID public key as a 65-byte uncompressed point', () => {
    const key = 'BHHnMXqQo8u7UZ733t9gAKyHEzG0HR-WMoRi82HE3C0ksExDANE_Ox2iuLvgTb2kYxC4P_SvqXwItp5QTQeIoO4'
    const bytes = base64UrlToBytes(key)
    assert.equal(bytes.length, 65)
    assert.equal(bytes[0], 0x04)
  })
})
