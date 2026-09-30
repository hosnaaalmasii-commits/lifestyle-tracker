// Spending guard for every paid API the app calls (Claude, OpenAI TTS,
// ElevenLabs). Counts what this device spends per calendar month and
// refuses a call before it's sent once a limit is reached; a per-minute
// and per-day cap on Claude calls stops any runaway retry loop (e.g. the
// automatic translation/estimate calls) long before it can add up.
// Per device, in its own localStorage keys — the provider-side limits
// (spend limits, no auto-reload) remain the real hard stop across devices.

const USAGE_STORAGE = 'lifestyle-tracker-usage-v1'
const LIMITS_STORAGE = 'lifestyle-tracker-usage-limits'

export const DEFAULT_LIMITS = {
  claudeUsd: 2,        // per month
  claudeCallsPerDay: 150,
  openaiUsd: 1,        // per month (~65 minutes of speech)
  elevenChars: 10000,  // per month (the free plan's size)
}
const CLAUDE_CALLS_PER_MINUTE = 20

// $ per 1M tokens (input, output) — Anthropic list prices.
const CLAUDE_PRICES = {
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-4-5': [1, 5],
  'claude-opus-5-5': [4, 20],
}
// gpt-4o-mini-tts: ~1.5 cent per minute of speech ≈ 1000 characters.
const OPENAI_USD_PER_CHAR = 0.015 / 1000

export class UsageLimitError extends Error {}

function monthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function dayKey() {
  return new Date().toLocaleDateString('sv')
}

function emptyUsage() {
  return { month: monthKey(), claudeUsd: 0, claudeCalls: 0, openaiUsd: 0, elevenChars: 0, day: dayKey(), claudeCallsToday: 0 }
}

export function getUsage() {
  let u
  try { u = JSON.parse(localStorage.getItem(USAGE_STORAGE) || 'null') } catch { u = null }
  if (!u || u.month !== monthKey()) u = emptyUsage()
  if (u.day !== dayKey()) { u.day = dayKey(); u.claudeCallsToday = 0 }
  return u
}
function saveUsage(u) {
  try { localStorage.setItem(USAGE_STORAGE, JSON.stringify(u)) } catch { /* private mode */ }
  listeners.forEach((fn) => fn())
}

export function getLimits() {
  try { return { ...DEFAULT_LIMITS, ...JSON.parse(localStorage.getItem(LIMITS_STORAGE) || '{}') } } catch { return { ...DEFAULT_LIMITS } }
}
export function setLimits(partial) {
  const next = { ...getLimits(), ...partial }
  try { localStorage.setItem(LIMITS_STORAGE, JSON.stringify(next)) } catch { /* private mode */ }
  listeners.forEach((fn) => fn())
  return next
}

const listeners = new Set()
export function onUsageChanged(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ---- Claude ----
const recentCalls = []

export function checkClaudeAllowed() {
  const u = getUsage()
  const l = getLimits()
  if (u.claudeUsd >= l.claudeUsd) {
    throw new UsageLimitError(`Maandlimiet voor Claude bereikt ($${l.claudeUsd}). Verhoog hem in Instellingen → Kostenlimieten, of wacht tot volgende maand.`)
  }
  if (u.claudeCallsToday >= l.claudeCallsPerDay) {
    throw new UsageLimitError(`Daglimiet van ${l.claudeCallsPerDay} Claude-aanvragen bereikt — morgen kan het weer.`)
  }
  const now = Date.now()
  while (recentCalls.length && now - recentCalls[0] > 60000) recentCalls.shift()
  if (recentCalls.length >= CLAUDE_CALLS_PER_MINUTE) {
    throw new UsageLimitError('Te veel Claude-aanvragen in korte tijd — even pauze, probeer het over een minuut opnieuw.')
  }
  recentCalls.push(now)
  u.claudeCallsToday += 1
  u.claudeCalls += 1
  saveUsage(u)
}

// usage: the API response's `usage` object.
export function recordClaudeUsage(model, usage) {
  if (!usage) return
  const [inPrice, outPrice] = CLAUDE_PRICES[model] || [4, 20] // unknown model → assume the priciest
  const input = (usage.input_tokens || 0)
    + (usage.cache_creation_input_tokens || 0) * 1.25
    + (usage.cache_read_input_tokens || 0) * 0.1
  const cost = (input * inPrice + (usage.output_tokens || 0) * outPrice) / 1e6
  const u = getUsage()
  u.claudeUsd += cost
  saveUsage(u)
}

// ---- Text-to-speech ----
export function checkAndRecordSpeech(provider, chars) {
  const u = getUsage()
  const l = getLimits()
  if (provider === 'openai') {
    const cost = chars * OPENAI_USD_PER_CHAR
    if (u.openaiUsd + cost > l.openaiUsd) {
      throw new UsageLimitError(`Maandlimiet voor OpenAI-stemmen bereikt ($${l.openaiUsd}).`)
    }
    u.openaiUsd += cost
  } else if (provider === 'elevenlabs') {
    if (u.elevenChars + chars > l.elevenChars) {
      throw new UsageLimitError(`Maandlimiet voor ElevenLabs bereikt (${l.elevenChars.toLocaleString('nl-NL')} tekens).`)
    }
    u.elevenChars += chars
  }
  saveUsage(u)
}
