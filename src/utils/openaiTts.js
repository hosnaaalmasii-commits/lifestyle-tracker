// OpenAI text-to-speech (gpt-4o-mini-tts) — natural voices, pay per use
// (~1.5 cent per minute of speech). Bring-your-own-key, same trust model
// as the Anthropic and ElevenLabs keys: its own localStorage slot, never
// in `data`/export/cloud sync, wiped by "Clear everything". Called
// straight from the browser.

import { checkAndRecordSpeech } from './usageGuard'

const KEY_STORAGE = 'lifestyle-tracker-openai-key'
const VOICE_STORAGE = 'lifestyle-tracker-openai-voice'
const MODEL = 'gpt-4o-mini-tts'

// The fixed set gpt-4o-mini-tts offers. OpenAI recommends marin and cedar
// for the best quality.
export const OPENAI_VOICES = [
  { id: 'marin', name: 'Marin', description: 'vrouw, helder en natuurlijk (aanbevolen)' },
  { id: 'cedar', name: 'Cedar', description: 'man, warm en natuurlijk (aanbevolen)' },
  { id: 'coral', name: 'Coral', description: 'vrouw, vriendelijk en levendig' },
  { id: 'nova', name: 'Nova', description: 'vrouw, energiek' },
  { id: 'shimmer', name: 'Shimmer', description: 'vrouw, zacht' },
  { id: 'sage', name: 'Sage', description: 'vrouw, rustig' },
  { id: 'alloy', name: 'Alloy', description: 'neutraal' },
  { id: 'ballad', name: 'Ballad', description: 'man, zacht en expressief' },
  { id: 'ash', name: 'Ash', description: 'man, helder' },
  { id: 'echo', name: 'Echo', description: 'man, kalm' },
  { id: 'verse', name: 'Verse', description: 'man, expressief' },
  { id: 'onyx', name: 'Onyx', description: 'man, diep' },
  { id: 'fable', name: 'Fable', description: 'man, vertellend' },
]

function read(key) {
  try { return localStorage.getItem(key) || '' } catch { return '' }
}
function write(key, value) {
  try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key) } catch { /* private mode */ }
}

export const getOpenAiKey = () => read(KEY_STORAGE)
export const setOpenAiKey = (key) => write(KEY_STORAGE, key.trim())
export const hasOpenAiKey = () => !!getOpenAiKey()
export const getOpenAiVoice = () => read(VOICE_STORAGE) || OPENAI_VOICES[0].id
export const setOpenAiVoice = (id) => write(VOICE_STORAGE, id)

export class OpenAiTtsError extends Error {}

async function explain(res) {
  let detail = ''
  try { detail = (await res.json())?.error?.message || '' } catch { /* not JSON */ }
  if (res.status === 401) return 'OpenAI weigert de sleutel. Controleer of je hem volledig hebt geplakt.'
  if (res.status === 429 && /quota|billing|credit/i.test(detail)) return 'Je OpenAI-tegoed is op — vul het aan op platform.openai.com → Billing.'
  if (res.status === 429) return 'OpenAI: te veel verzoeken tegelijk — probeer het zo nog eens.'
  return `OpenAI-fout ${res.status}${detail ? `: ${detail}` : ''}`
}

// gpt-4o-mini-tts ignores the `speed` field, so pace goes in the
// instructions instead — together with the coach's tone.
function instructionsFor(lang, rate) {
  const pace = rate < 0.95 ? 'Speak at a calm, unhurried pace.' : rate > 1.1 ? 'Speak at a brisk, lively pace.' : 'Speak at a natural conversational pace.'
  return `You are a warm, encouraging personal health coach talking to the user. Speak with a natural native accent for the language of the text (the app language is ${lang}). ${pace}`
}

// Returns an audio Blob (mp3).
export async function synthesizeOpenAi(text, { lang = 'nl-NL', rate = 1, signal } = {}) {
  const input = text.slice(0, 4000)
  checkAndRecordSpeech('openai', input.length) // throws once the monthly limit is reached
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getOpenAiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      voice: getOpenAiVoice(),
      input,
      instructions: instructionsFor(lang, rate),
      response_format: 'mp3',
    }),
    signal,
  })
  if (!res.ok) throw new OpenAiTtsError(await explain(res))
  return res.blob()
}
