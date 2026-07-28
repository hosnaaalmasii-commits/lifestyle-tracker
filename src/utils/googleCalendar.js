// Client-side-only Google Calendar connection via Google Identity Services
// (GIS). Unlike the Anthropic key, a Google OAuth "Client ID" is meant to be
// public — it's restricted server-side by the authorized origins configured
// in Google Cloud Console, not by secrecy — so it's fine to store it in
// regular app data. The access token GIS returns is short-lived (~1 hour)
// and is kept in memory only (never localStorage): the app re-requests it,
// silently where possible, each time it's needed.

const SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy'
let scriptPromise = null

function loadGisScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Google Identity Services.'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * Requests an access token, prompting the user for consent unless
 * `silent` is true (in which case it resolves to null instead of prompting
 * — used for a quiet reconnect attempt on app load).
 */
export async function requestGoogleToken(clientId, { silent = false } = {}) {
  await loadGisScript()
  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (response) => {
          if (response.error) {
            if (silent) resolve(null)
            else reject(new Error(response.error_description || response.error))
            return
          }
          resolve(response.access_token)
        },
        error_callback: () => {
          if (silent) resolve(null)
          else reject(new Error('Google sign-in was cancelled or blocked.'))
        },
      })
      client.requestAccessToken(silent ? { prompt: 'none' } : { prompt: 'consent' })
    } catch (e) {
      reject(e)
    }
  })
}

function startOfTodayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfTodayISO() {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

export async function fetchTodayBusyMinutes(accessToken) {
  const response = await fetch('https://www.googleapis.com/calendar/v3/freebusy', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      timeMin: startOfTodayISO(),
      timeMax: endOfTodayISO(),
      items: [{ id: 'primary' }],
    }),
  })
  if (!response.ok) {
    if (response.status === 401) throw new Error('Google session expired — reconnect in Settings.')
    throw new Error(`Calendar request failed (${response.status}).`)
  }
  const data = await response.json()
  const busy = data?.calendars?.primary?.busy || []
  const minutes = busy.reduce((sum, slot) => sum + (new Date(slot.end) - new Date(slot.start)) / 60000, 0)
  return Math.round(minutes)
}
