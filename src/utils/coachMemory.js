// The coach getting to know the user. data.coach (AppContext) holds the
// synced conversation plus a short list of durable facts about the user —
// goals, preferences, circumstances, what helps or doesn't — that the
// coach distils from the conversation every few messages with one small
// Claude call (Haiku, cheap). Those facts, the recent conversation and the
// full data snapshot (coachContext.js) go into every coach reply, so it
// remembers across days and devices. The user can see and delete every
// fact, clear the conversation, or have the coach forget everything
// (Coach → Coach instellen → Geheugen).
import { sendToClaude } from './claudeApi'
import { coachImage } from './coachAvatar'

export const MAX_FACTS = 50
// Messages sent along with each reply (older ones live on as facts).
export const HISTORY_FOR_REPLY = 30
// Distil facts once this many new user messages have come in.
const EXTRACT_EVERY = 3

export function coachName(data) {
  const own = data.settings.coachName?.trim()
  if (own) return own
  return coachImage(data.settings.coachAvatar)?.name || null
}

export function memoryPrompt(data) {
  const name = coachName(data)
  const user = data.settings.displayName?.trim()
  const facts = data.coach?.memory || []
  return `
WHO YOU ARE: ${name ? `Your name is ${name}. Use it when you introduce yourself or when it fits naturally.` : 'You have no name yet.'}${user ? `\nThe user's name is ${user}.` : ''}

WHAT YOU REMEMBER ABOUT THE USER (from earlier conversations — use it naturally, the way a coach who knows someone would; never list it back or say "according to my notes"):
${facts.length ? facts.map((f) => `- ${f.text}`).join('\n') : '- Nothing yet — you are just getting to know each other. Take a genuine interest.'}`
}

const SCHEMA = {
  type: 'object',
  properties: {
    facts: { type: 'array', items: { type: 'string' } },
  },
  required: ['facts'],
  additionalProperties: false,
}

// Should the facts be refreshed now? (Called after each reply.)
export function memoryIsDue(coach, force = false) {
  const pending = (coach?.messages || []).slice(coach?.memoryUpTo || 0)
  const userCount = pending.filter((m) => m.role === 'user').length
  return force ? userCount > 0 : userCount >= EXTRACT_EVERY
}

// → { memory, memoryUpTo } to store, or null when there was nothing to do.
export async function refreshMemory(coach, { language } = {}) {
  const messages = coach?.messages || []
  const from = coach?.memoryUpTo || 0
  const pending = messages.slice(from)
  if (!pending.some((m) => m.role === 'user')) return null
  const current = coach?.memory || []
  const transcript = pending.map((m) => `${m.role === 'user' ? 'USER' : 'COACH'}: ${m.content}`).join('\n')

  const raw = await sendToClaude({
    model: 'claude-haiku-4-5',
    maxTokens: 1500,
    schema: SCHEMA,
    language,
    system: `You maintain a personal health coach's memory of one user. You get the facts already known and a new piece of conversation. Return the complete, updated list of facts (at most ${MAX_FACTS}).

Keep only durable, useful things about the USER that help coach them better over weeks: goals and why they matter, preferences (food, training, time of day, tone they like), circumstances (work, schedule, family, living situation), health context they chose to share (injuries, conditions, cycle, sleep issues), what motivates or discourages them, recurring struggles, wins and milestones, and people or things they care about.
Skip small talk, one-off questions, anything the coach said, and anything already visible in their logged data (today's water, sleep hours, weight numbers).
Each fact: one short sentence, written in the user's language, third person ("Werkt in ploegendienst", "Houdt niet van hardlopen"). Update or merge facts when the new conversation changes them; drop facts that are clearly outdated; keep the rest unchanged.`,
    messages: [{
      role: 'user',
      content: `KNOWN FACTS:\n${current.length ? current.map((f) => `- ${f.text}`).join('\n') : '(none)'}\n\nNEW CONVERSATION:\n${transcript}`,
    }],
  })

  let facts
  try {
    facts = JSON.parse(raw).facts
  } catch {
    return null
  }
  if (!Array.isArray(facts)) return null
  const byText = new Map(current.map((f) => [f.text.trim().toLowerCase(), f]))
  const memory = facts
    .map((t) => String(t).trim())
    .filter(Boolean)
    .slice(0, MAX_FACTS)
    .map((text) => byText.get(text.toLowerCase()) || { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, text, at: Date.now() })
  return { memory, memoryUpTo: messages.length }
}
