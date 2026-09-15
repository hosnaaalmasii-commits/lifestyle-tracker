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
// home-screen PWA) until something else happened to fully close every
// tab/instance for the origin. onNeedRefresh + updateSW(true) explicitly
// sends the skip-waiting message and reloads as soon as a new version is
// found, instead of relying on that implicit behavior.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true)
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
