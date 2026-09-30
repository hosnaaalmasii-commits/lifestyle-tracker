// Direct browser -> Anthropic API calls using the user's own personal key.
// The key lives only in this browser's localStorage (a separate key from
// the main app data, so it's never included in JSON export/backup) and is
// sent straight to Anthropic on each request — this app has no backend to
// route through, by design.

import { checkClaudeAllowed, recordClaudeUsage } from './usageGuard'
import { secretChanged } from './secretSync'

const KEY_STORAGE = 'lifestyle-tracker-anthropic-key'
const SETTINGS_STORAGE = 'lifestyle-tracker-coach-settings'

export const MODEL_OPTIONS = [
  { value: 'claude-sonnet-5-5', label: 'Sonnet 5.5 (recommended)' },
  { value: 'claude-haiku-4-5', label: 'Haiku 4.5 (fastest, cheapest)' },
  { value: 'claude-opus-5-5', label: 'Opus 5.5 (most capable)' },
]

// Saved choices from earlier model lists, mapped to their current successor
// (same tier, same or lower price) so a stored setting never points at a
// model the picker no longer shows.
const LEGACY_MODELS = {
  'claude-sonnet-5': 'claude-sonnet-5-5',
  'claude-haiku-4-5-20251001': 'claude-haiku-4-5',
  'claude-opus-4-8': 'claude-opus-5-5',
}

const DEFAULT_COACH_SETTINGS = {
  model: 'claude-sonnet-5-5',
  personality: 'friendly',
}

export function getApiKey() {
  return localStorage.getItem(KEY_STORAGE) || ''
}

export function setApiKey(key) {
  if (key) localStorage.setItem(KEY_STORAGE, key)
  else localStorage.removeItem(KEY_STORAGE)
  secretChanged('anthropic', key) // encrypted copy for the user's other devices (secretSync.js)
}

export function hasApiKey() {
  return !!getApiKey()
}

export function getCoachSettings() {
  try {
    const merged = { ...DEFAULT_COACH_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_STORAGE) || '{}') }
    merged.model = LEGACY_MODELS[merged.model] || merged.model
    return merged
  } catch {
    return { ...DEFAULT_COACH_SETTINGS }
  }
}

export function setCoachSettings(partial) {
  const next = { ...getCoachSettings(), ...partial }
  localStorage.setItem(SETTINGS_STORAGE, JSON.stringify(next))
  return next
}

// The app language's English name ("French", …), set from AppContext —
// every request asks Claude to write user-facing text in it.
let aiLanguage = null
export function setAiLanguage(name) {
  aiLanguage = name
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
 *
 * schema (optional): a JSON Schema — sent as structured outputs
 * (output_config.format), which guarantees the reply text is valid JSON of
 * that shape; the caller still JSON.parse()s it.
 * effort (optional): 'low' | 'medium' | 'high' — thinking depth/spend on
 * models that support it (ignored for Haiku 4.5, which rejects it).
 */
// language (optional): reply in this language instead of the app language.
export async function sendToClaude({ system, messages, maxTokens = 1024, model, schema, effort = 'low', language }) {
  const replyLanguage = language || aiLanguage
  const chosenModel = model || getCoachSettings().model
  const isHaiku = chosenModel.startsWith('claude-haiku')
  const outputConfig = {}
  if (schema) outputConfig.format = { type: 'json_schema', schema }
  // Sonnet 5.5 / Opus 5.5 always think first (it can't be switched off),
  // and that thinking counts against max_tokens — a small cap could be used
  // up before any text is written ("empty response"). So: low effort by
  // default (chat, parsing and short answers don't need deep reasoning;
  // callers can ask for more), and never less than 2048 tokens of room.
  // Only tokens actually generated are billed, so the headroom costs nothing.
  if (effort && !isHaiku) outputConfig.effort = effort
  const maxTokensSent = isHaiku ? maxTokens : Math.max(maxTokens, 2048)
  const apiKey = getApiKey()
  if (!apiKey) throw new ClaudeApiError('No API key set. Add one in Settings → AI Coach.')
  // Monthly $ limit + per-day/per-minute call caps (Settings → Kostenlimieten).
  try {
    checkClaudeAllowed()
  } catch (e) {
    throw new ClaudeApiError(e.message)
  }

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
        model: chosenModel,
        max_tokens: maxTokensSent,
        system: replyLanguage && typeof system === 'string'
          ? `${system}\n\nIMPORTANT: write every piece of user-facing text (replies, notes, summaries, meal names) in ${replyLanguage}, whatever language the instructions above use. Keep JSON keys and enum values exactly as specified.`
          : system,
        messages,
        ...(Object.keys(outputConfig).length ? { output_config: outputConfig } : {}),
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
  recordClaudeUsage(data?.model || chosenModel, data?.usage)
  if (data?.stop_reason === 'refusal') throw new ClaudeApiError('Claude declined this request — try rephrasing it.')
  if (data?.stop_reason === 'max_tokens' && schema) throw new ClaudeApiError('The answer got cut off — try again.')
  const text = data?.content?.find((c) => c.type === 'text')?.text
  if (!text && data?.stop_reason === 'max_tokens') throw new ClaudeApiError('Claude ran out of room before answering — try again, or pick Haiku in Settings.')
  if (!text) throw new ClaudeApiError('Got an empty response — try again.')
  return text
}

export { ClaudeApiError }
