/**
 * Web Push settings and the push services the API will send to. No database
 * access here, so it can be loaded (and tested) on its own.
 *
 * Configured by VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT
 * (`npm run vapid:keys` makes a key pair). Without all three, notifications
 * are off and nothing else changes.
 */

export interface PushConfig {
  publicKey: string
  privateKey: string
  /** A mailto: or https: contact the push services can reach about abuse. */
  subject: string
}

export function pushConfig(env: NodeJS.ProcessEnv = process.env): PushConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = env.VAPID_PRIVATE_KEY?.trim()
  const subject = env.VAPID_SUBJECT?.trim()
  if (!publicKey || !privateKey || !subject) return null
  if (!/^(mailto:|https:\/\/)/.test(subject)) {
    throw new Error('VAPID_SUBJECT must start with mailto: or https://')
  }
  return { publicKey, privateKey, subject }
}

/**
 * Push services this API will send to. The endpoint comes from the browser,
 * and the server POSTs to it, so anything else is refused: otherwise a client
 * could point the server at an arbitrary URL (an internal address, say).
 */
const PUSH_HOSTS: RegExp[] = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge on Android, Samsung Internet, Opera
  /^android\.googleapis\.com$/, // older Chrome
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/, // Safari, including iPhone home-screen apps
  /^[a-z0-9-]+\.notify\.windows\.com$/, // Edge on Windows
]

export function isPushEndpoint(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return (
    url.protocol === 'https:' &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    PUSH_HOSTS.some((host) => host.test(url.hostname))
  )
}
