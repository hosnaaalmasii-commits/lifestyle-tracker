// Live, interruptible voice conversations with the coach through
// ElevenLabs Agents — the user's ElevenLabs voice, ElevenLabs' own speech
// recognition and turn-taking (which works on the iPhone, where the
// browser's recognition didn't), and Claude Haiku 4.5 as the brain, run by
// ElevenLabs. Added 2026-10-01: "ik wil gewoon op coach tikken … live
// praten en antwoorden krijgen zonder in en uit te tikken" + "ik wil de
// stemmen van eleven".
//
// Bring-your-own-key like elevenLabs.js: with the user's key the app
// creates one agent in *their* ElevenLabs account the first time (a shell
// whose prompt, language and voice are overridden per conversation, so it
// always gets the app's current coach prompt, plan and memory), then asks
// for a short-lived conversation token and connects straight from the
// browser. Nothing goes through a server of ours.

import { Conversation } from '@elevenlabs/client'
import { getElevenKey, getElevenVoice, DEFAULT_VOICE_ID } from './elevenLabs'

const API = 'https://api.elevenlabs.io/v1'
const AGENT_STORAGE = 'lifestyle-tracker-elevenlabs-agent'
// Bump when the agent's base config below changes, so it's recreated.
const AGENT_VERSION = 1
export const LIVE_LLM = 'claude-haiku-4-5'

// ElevenLabs' override languages (subset the app's speech languages map to).
const LANGS = new Set(['nl', 'en', 'fr', 'de', 'es', 'it', 'pt', 'tr', 'ar', 'fa', 'pl'])

export class LiveCoachError extends Error {}

async function explain(res, what) {
  let detail = ''
  try {
    const body = await res.json()
    detail = body?.detail?.message || body?.detail?.status || (typeof body?.detail === 'string' ? body.detail : '')
  } catch { /* not JSON */ }
  if (/quota|credit/i.test(detail)) return 'Je ElevenLabs-tegoed is op.'
  if (res.status === 401 || res.status === 403) {
    return `ElevenLabs weigert de sleutel bij ${what}${detail ? ` (${detail})` : ''}. Geef je API-sleutel op elevenlabs.io (Developers → API Keys) ook toegang tot "ElevenLabs Agents" (lezen én schrijven).`
  }
  if (res.status === 429) return 'ElevenLabs: te veel gesprekken tegelijk of tegoed op — probeer het zo nog eens.'
  return `ElevenLabs-fout ${res.status} bij ${what}${detail ? `: ${detail}` : ''}`
}

async function api(path, { method = 'GET', body, what }) {
  let res
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { 'xi-api-key': getElevenKey(), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new LiveCoachError('Kon ElevenLabs niet bereiken — ben je online?')
  }
  if (!res.ok) {
    const err = new LiveCoachError(await explain(res, what))
    err.status = res.status
    throw err
  }
  return res.json()
}

// The agent belongs to the key that made it — a different key (another
// account) gets its own.
function keyTag() {
  return getElevenKey().slice(-8)
}

function readAgent() {
  try {
    const saved = JSON.parse(localStorage.getItem(AGENT_STORAGE) || 'null')
    return saved && saved.key === keyTag() && saved.version === AGENT_VERSION ? saved.agentId : null
  } catch { return null }
}

function forgetAgent() {
  try { localStorage.removeItem(AGENT_STORAGE) } catch { /* private mode */ }
}

async function createAgent() {
  const body = {
    name: 'Lifestyle Tracker — coach',
    conversation_config: {
      agent: {
        first_message: '',
        language: 'nl',
        prompt: { prompt: 'Je bent een vriendelijke, korte en praktische leefstijlcoach.', llm: LIVE_LLM, temperature: 0.7 },
      },
      // Flash v2.5: multilingual (non-English agents need it) and the
      // quickest to start talking.
      tts: { model_id: 'eleven_flash_v2_5', voice_id: getElevenVoice() || DEFAULT_VOICE_ID },
    },
    platform_settings: {
      overrides: {
        conversation_config_override: {
          agent: { first_message: true, language: true, prompt: { prompt: true, llm: true } },
          tts: { voice_id: true, speed: true },
        },
      },
    },
  }
  const { agent_id: agentId } = await api('/convai/agents/create', { method: 'POST', body, what: 'het aanmaken van je live-coach' })
  try {
    localStorage.setItem(AGENT_STORAGE, JSON.stringify({ agentId, key: keyTag(), version: AGENT_VERSION }))
  } catch { /* private mode — recreated next time */ }
  return agentId
}

async function connect(agentId, sessionOptions) {
  // WebRTC (better echo cancellation, the SDK's recommended path); fall
  // back to a WebSocket if the token can't be had or WebRTC fails.
  try {
    const { token } = await api(`/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`, { what: 'het starten van het gesprek' })
    return await Conversation.startSession({ ...sessionOptions, conversationToken: token, connectionType: 'webrtc' })
  } catch (e) {
    if (e instanceof LiveCoachError && e.status === 404) throw e
    if (e instanceof LiveCoachError && (e.status === 401 || e.status === 403)) throw e
    console.warn('Live coach: WebRTC failed, trying WebSocket', e)
    const { signed_url: signedUrl } = await api(`/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, { what: 'het starten van het gesprek' })
    return Conversation.startSession({ ...sessionOptions, signedUrl, connectionType: 'websocket' })
  }
}

/**
 * Starts a live conversation. Returns the SDK conversation (call
 * endSession() to hang up). Callbacks:
 *   onMode('listening' | 'speaking'), onUserText(text), onAgentText(text),
 *   onEnd(reason|null), onError(message)
 * Must be called from a tap (microphone + audio on iOS).
 */
export async function startLiveCoach({ prompt, firstMessage = '', lang = 'nl-NL', speed = 1, onMode, onUserText, onAgentText, onEnd, onError }) {
  const base = lang.split('-')[0].toLowerCase()
  const sessionOptions = {
    overrides: {
      agent: {
        prompt: { prompt, llm: LIVE_LLM },
        firstMessage,
        ...(LANGS.has(base) ? { language: base } : {}),
      },
      tts: { voiceId: getElevenVoice() || DEFAULT_VOICE_ID, speed: Math.min(1.2, Math.max(0.7, speed)) },
    },
    onModeChange: ({ mode }) => onMode?.(mode),
    onMessage: ({ message, role, source }) => {
      if (!message?.trim()) return
      if ((role || (source === 'ai' ? 'agent' : 'user')) === 'agent') onAgentText?.(message)
      else onUserText?.(message)
    },
    onDisconnect: (details) => {
      const reason = details?.reason === 'error' ? (details.message || 'De verbinding viel weg.') : null
      onEnd?.(reason)
    },
    onError: (message) => onError?.(typeof message === 'string' ? message : 'Er ging iets mis in het live-gesprek.'),
  }

  let agentId = readAgent() || await createAgent()
  try {
    return await connect(agentId, sessionOptions)
  } catch (e) {
    // The agent was deleted in the ElevenLabs dashboard: make a new one once.
    if (e instanceof LiveCoachError && e.status === 404) {
      forgetAgent()
      agentId = await createAgent()
      return connect(agentId, sessionOptions)
    }
    if (e instanceof LiveCoachError) throw e
    if (e?.name === 'NotAllowedError') throw new LiveCoachError('De microfoon is geblokkeerd. Zet hem aan via Instellingen → Safari (of de app) → Microfoon.')
    throw new LiveCoachError(`Live-gesprek starten mislukt${e?.message ? `: ${e.message.replace(/\.+$/, '')}` : ''}.`)
  }
}
