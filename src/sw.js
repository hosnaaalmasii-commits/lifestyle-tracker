import { precacheAndRoute } from 'workbox-precaching'

// injectManifest strategy (vite.config.js) — Workbox injects the precache
// list here at build time; this file also gets the push/notificationclick
// listeners a generateSW-produced service worker can't be given.
precacheAndRoute(self.__WB_MANIFEST)

// generateSW auto-injects this listener; injectManifest does not, so it has
// to be added by hand. Without it, registerType: 'autoUpdate' on the client
// side (main.jsx's registerSW) has no way to tell a new, already-installed-
// but-"waiting" service worker to actually take over — every deploy after
// switching to injectManifest silently got stuck one version behind until a
// full uninstall/reinstall, with no visible error anywhere. This is the fix.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('push', (event) => {
  let payload = { title: 'Lifestyle Tracker', body: '' }
  try { payload = event.data.json() } catch { /* non-JSON push, keep default */ }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: payload.tag || 'task-reminder',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c)
      if (existing) return existing.focus()
      return self.clients.openWindow('./')
    })
  )
})
