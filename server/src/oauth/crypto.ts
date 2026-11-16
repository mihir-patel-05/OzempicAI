import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * A new random secret with a recognisable prefix (so a leaked one is easy to
 * spot in logs and secret scanners). Only its sha256 is ever stored.
 */
export function newSecret(prefix: 'oza_cid' | 'oza_cs' | 'oza_ac' | 'oza_at' | 'oza_rt'): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`
}

/** Constant-time comparison of two strings. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** RFC 7636 code_verifier: 43–128 unreserved characters. */
const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/
/** An S256 code_challenge is a base64url sha256: 43 characters. */
const CHALLENGE = /^[A-Za-z0-9\-_]{43}$/

export function isValidCodeChallenge(challenge: string): boolean {
  return CHALLENGE.test(challenge)
}

/** PKCE S256: base64url(sha256(verifier)) must equal the stored challenge. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!VERIFIER.test(verifier)) return false
  const computed = createHash('sha256').update(verifier).digest('base64url')
  return safeEqual(computed, challenge)
}
