/*
 * Web Push for the service worker (docs/fasting-plan.md, phase 5). Workbox's
 * generated sw.js loads this with importScripts (vite.config.ts), so the
 * precaching setup stays generated.
 *
 * The API sends JSON: { title, body, tag, url }. Same tag, same notification:
 * "Goal reached" replaces "1 hour to go" instead of stacking under it.
 */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'OzempicAI'
  const tag = typeof data.tag === 'string' ? data.tag : undefined
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === 'string' ? data.body : '',
      tag,
      // A replacement under the same tag should still buzz.
      renotify: Boolean(tag),
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: safePath(data.url) },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(safePath(event.notification.data && event.notification.data.url), self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Reuse an open window of the app rather than opening another.
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client.navigate(target).then((navigated) => (navigated || client).focus())
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})

/** Only paths inside this app: a notification can never send someone to another site. */
function safePath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}
