import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles/theme.css'
import './styles/global.css'
import './styles/fintech.css'
import App from './App.jsx'

// registerType: 'autoUpdate' alone isn't enough with the injectManifest
// strategy (custom sw.js) — a new service worker was observed sitting in
// "waiting" indefinitely after a deploy, never taking over, so updates
// never appeared for a returning visitor (including the installed
// home-screen PWA). A first attempt added onNeedRefresh + updateSW(true),
// which helped but didn't fully fix it: onNeedRefresh (built on
// workbox-window) only fires for a worker that transitions TO waiting
// during *this* page session — a worker already sitting in `.waiting`
// from an earlier visit (the normal case for a returning user, since the
// registration persists across page loads) never re-triggers it. Verified
// live: a fresh load could still serve stale content while
// registration.waiting was already true. onRegisteredSW below checks for
// and activates a pre-existing waiting worker directly, on top of
// listening for one that appears mid-session — the belt-and-suspenders
// version of the same fix.
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return

    const activateWaiting = (worker) => worker?.postMessage({ type: 'SKIP_WAITING' })

    // Case 1: a worker installed on a previous visit is already waiting.
    if (registration.waiting) activateWaiting(registration.waiting)

    // Case 2: a new worker finishes installing during this page session.
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && registration.waiting) {
          activateWaiting(registration.waiting)
        }
      })
    })

    // Either case ends the same way: the new worker takes control, reload
    // once to actually render what it's serving. Guarded against firing
    // twice — controllerchange can otherwise fire more than once.
    let reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return
      reloaded = true
      window.location.reload()
    })
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
