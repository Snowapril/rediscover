/*
 * Shows the notification a reminder produced, and opens the scrap when it is
 * clicked.
 *
 * Deliberately small. A service worker outlives the page and is updated on its
 * own schedule, so anything clever in here is clever in a copy that may be
 * weeks old.
 */

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = {}
  }

  const title = payload.title || 'rediscover'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || 'Something you meant to read',
      // Collapses onto the previous one rather than stacking: several reminders
      // coming due is one thing to look at, not several notifications to clear.
      tag: 'rediscover-due',
      renotify: true,
      data: { url: payload.url || null },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // The scrap itself when there is one, the due list when the notification
  // stood for several.
  const target = event.notification.data && event.notification.data.url
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((client) => client.url.startsWith(self.registration.scope))
      if (open !== undefined) {
        open.focus()
        if (target) open.navigate(target)
        return undefined
      }
      return self.clients.openWindow(target || self.registration.scope)
    }),
  )
})
