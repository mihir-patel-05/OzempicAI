/**
 * Web Push in the browser (docs/fasting-plan.md, phase 5): can this device get
 * notifications, and subscribing or unsubscribing it. The service worker that
 * shows them is public/push-sw.js, loaded by the generated sw.js; it is
 * registered in production builds only, so `npm run dev` reports no worker.
 */

export type PushSupport =
  /** Service worker, Push API and notifications are all there. */
  | 'supported'
  /** iPhone or iPad in a Safari tab: push only works from the Home Screen app. */
  | 'install-first'
  | 'unsupported'

export interface PushEnvironment {
  userAgent: string
  platform: string
  maxTouchPoints: number
  standalone: boolean
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
}

export function isAppleMobile(env: Pick<PushEnvironment, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  // iPadOS reports itself as a Mac; touch gives it away.
  return /iPad|iPhone|iPod/.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1)
}

export function pushSupport(env: PushEnvironment): PushSupport {
  // Check this first: a Safari tab on iOS has no PushManager at all, and the
  // fix is adding to the Home Screen, not a different browser.
  if (isAppleMobile(env) && !env.standalone) return 'install-first'
  return env.hasServiceWorker && env.hasPushManager && env.hasNotification ? 'supported' : 'unsupported'
}

export function browserPushEnvironment(): PushEnvironment {
  const nav = navigator as Navigator & { standalone?: boolean }
  return {
    userAgent: nav.userAgent,
    platform: nav.platform ?? '',
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone: window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true,
    hasServiceWorker: 'serviceWorker' in nav,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
  }
}

/** A VAPID public key (base64url) as the bytes PushManager.subscribe wants. */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Whether a subscription was made with `publicKey` (false after the server's keys change). */
export function subscribedWithKey(subscription: PushSubscription, publicKey: string): boolean {
  const key = subscription.options?.applicationServerKey
  if (!key) return false
  const have = new Uint8Array(key)
  const want = base64UrlToBytes(publicKey)
  return have.length === want.length && have.every((byte, i) => byte === want[i])
}

/** The active service worker, or null if there isn't one within a few seconds. */
export async function serviceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  // `ready` never settles when nothing is registered (development), so cap the wait.
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await serviceWorker()
  return registration ? registration.pushManager.getSubscription() : null
}

/**
 * Ask for permission (call from a tap: browsers ignore the request otherwise),
 * then subscribe this browser with the server's public key.
 */
export async function subscribeThisDevice(publicKey: string): Promise<PushSubscription> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked. Allow them in your browser or system settings, then try again.'
        : 'Notifications were not allowed.',
    )
  }
  const registration = await serviceWorker()
  if (!registration) throw new Error('The app’s background worker isn’t running yet. Reload the page and try again.')
  const existing = await registration.pushManager.getSubscription()
  if (existing && !subscribedWithKey(existing, publicKey)) await existing.unsubscribe()
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) })
}

/** Unsubscribe this browser. Returns the endpoint it had, for the server to forget. */
export async function unsubscribeThisDevice(): Promise<string | null> {
  const subscription = await currentSubscription()
  if (!subscription) return null
  const { endpoint } = subscription
  await subscription.unsubscribe()
  return endpoint
}

/**
 * For signing out: unsubscribe this browser without waiting for a service
 * worker that may never come (development). Returns the endpoint it had.
 */
export async function forgetThisDevice(): Promise<string | null> {
  if (!('serviceWorker' in navigator)) return null
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager?.getSubscription()
  if (!subscription) return null
  const { endpoint } = subscription
  await subscription.unsubscribe()
  return endpoint
}
