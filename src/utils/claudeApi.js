// Direct browser -> Anthropic API calls using the user's own personal key.
// The key lives only in this browser's localStorage (a separate key from
// the main app data, so it's never included in JSON export/backup) and is
// sent straight to Anthropic on each request — this app has no backend to
// route through, by design.

const KEY_STORAGE = 'lifestyle-tracker-anthropic-key'
const SETTINGS_STORAGE = 'lifestyle-tracker-coach-settings'

export const MODEL_OPTIONS = [
  { value: 'claude-sonnet-5', label: 'Sonnet 5 (recommended)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (fastest, cheapest)' },
  { value: 'claude-opus-4-8', label: 'Opus 4.8 (most capable)' },
]

const DEFAULT_COACH_SETTINGS = {
  model: 'claude-sonnet-5',
  personality: 'friendly',
}

export function getApiKey() {
  return localStorage.getItem(KEY_STORAGE) || ''
}

export function setApiKey(key) {
  if (key) localStorage.setItem(KEY_STORAGE, key)
  else localStorage.removeItem(KEY_STORAGE)
}

export function hasApiKey() {
  return !!getApiKey()
}

export function getCoachSettings() {
  try {
    return { ...DEFAULT_COACH_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_STORAGE) || '{}') }
  } catch {
    return { ...DEFAULT_COACH_SETTINGS }
  }
}

export function setCoachSettings(partial) {
  const next = { ...getCoachSettings(), ...partial }
  localStorage.setItem(SETTINGS_STORAGE, JSON.stringify(next))
  return next
}

class ClaudeApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

/**
 * messages: [{ role: 'user' | 'assistant', content: string }]
 * Returns the assistant's reply text, or throws ClaudeApiError with a
 * human-readable message.
 */
export async function sendToClaude({ system, messages, maxTokens = 1024, model }) {
  const apiKey = getApiKey()
  if (!apiKey) throw new ClaudeApiError('No API key set. Add one in Settings → AI Coach.')

  let response
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: model || getCoachSettings().model,
        max_tokens: maxTokens,
        system,
        messages,
      }),
    })
  } catch {
    throw new ClaudeApiError('Could not reach Anthropic — check your internet connection.')
  }

  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = body?.error?.message || ''
    } catch { /* ignore */ }
    if (response.status === 401) throw new ClaudeApiError('That API key was rejected. Double-check it in Settings.', 401)
    if (response.status === 429) throw new ClaudeApiError('Rate limited — wait a moment and try again.', 429)
    throw new ClaudeApiError(detail || `Request failed (${response.status}).`, response.status)
  }

  const data = await response.json()
  const text = data?.content?.find((c) => c.type === 'text')?.text
  if (!text) throw new ClaudeApiError('Got an empty response — try again.')
  return text
}

export { ClaudeApiError }
