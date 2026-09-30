// ElevenLabs text-to-speech — natural, human-sounding voices for the
// coach. Bring-your-own-key, same trust model as the Anthropic key
// (claudeApi.js): a real secret, kept in its own localStorage key, never
// in `data`/export/cloud sync, wiped by "Clear everything". Called
// straight from the browser (ElevenLabs allows CORS). Optional: without a
// key the coach uses the device's own voices (speechOutput.js).

import { checkAndRecordSpeech } from './usageGuard'

const KEY_STORAGE = 'lifestyle-tracker-elevenlabs-key'
const VOICE_STORAGE = 'lifestyle-tracker-elevenlabs-voice'
const MODEL_STORAGE = 'lifestyle-tracker-elevenlabs-model'
const API = 'https://api.elevenlabs.io/v1'

// "Sarah" — one of ElevenLabs' default voices, available on every plan.
export const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'

// multilingual_v2 sounds the most natural; flash is ~5× quicker to start
// talking and uses half the credits — nicer for back-and-forth talk.
export const ELEVEN_MODELS = [
  { value: 'eleven_multilingual_v2', label: 'Mooiste klank' },
  { value: 'eleven_flash_v2_5', label: 'Snelste reactie' },
]

function read(key) {
  try { return localStorage.getItem(key) || '' } catch { return '' }
}
function write(key, value) {
  try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key) } catch { /* private mode */ }
}

export const getElevenKey = () => read(KEY_STORAGE)
export const setElevenKey = (key) => write(KEY_STORAGE, key.trim())
export const hasElevenKey = () => !!getElevenKey()
export const getElevenVoice = () => read(VOICE_STORAGE) || DEFAULT_VOICE_ID
export const setElevenVoice = (id) => write(VOICE_STORAGE, id)
export const getElevenModel = () => read(MODEL_STORAGE) || ELEVEN_MODELS[0].value
export const setElevenModel = (model) => write(MODEL_STORAGE, model)

export class ElevenLabsError extends Error {}

async function explain(res) {
  let detail = ''
  try {
    const body = await res.json()
    detail = body?.detail?.message || body?.detail?.status || (typeof body?.detail === 'string' ? body.detail : '')
  } catch { /* not JSON */ }
  // Used-up credit also comes back as a 401, so check for it first.
  if (/quota/i.test(detail)) return 'Je ElevenLabs-tegoed voor deze maand is op.'
  if (res.status === 401) return `ElevenLabs weigert de sleutel${detail ? ` (${detail})` : ''}. Controleer de sleutel en of hij rechten heeft voor "Text to Speech" en "Voices".`
  if (res.status === 429) return 'ElevenLabs: te veel verzoeken tegelijk — probeer het zo nog eens.'
  return `ElevenLabs-fout ${res.status}${detail ? `: ${detail}` : ''}`
}

// [{ id, name, description }] — the voices this account can use.
export async function fetchElevenVoices() {
  const res = await fetch(`${API}/voices`, { headers: { 'xi-api-key': getElevenKey() } })
  if (!res.ok) throw new ElevenLabsError(await explain(res))
  const body = await res.json()
  return (body.voices || [])
    .map((v) => {
      const l = v.labels || {}
      const gender = l.gender === 'female' ? 'vrouw' : l.gender === 'male' ? 'man' : ''
      const description = [gender, l.accent, l.age, l.description || l.descriptive].filter(Boolean).join(', ')
      return { id: v.voice_id, name: v.name, description }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

// Returns an audio Blob (mp3). rate: 0.7–1.2 (ElevenLabs' own range).
export async function synthesize(text, { lang = 'nl-NL', rate = 1, signal } = {}) {
  const model = getElevenModel()
  const input = text.slice(0, 4500)
  checkAndRecordSpeech('elevenlabs', input.length) // throws once the monthly limit is reached
  const body = {
    text: input,
    model_id: model,
    voice_settings: {
      stability: 0.45,
      similarity_boost: 0.8,
      style: 0.15,
      use_speaker_boost: true,
      speed: Math.min(1.2, Math.max(0.7, rate)),
    },
  }
  // The v2.5 models take an explicit language; v2 detects it from the text.
  if (model.includes('v2_5')) body.language_code = lang.split('-')[0]
  const res = await fetch(`${API}/text-to-speech/${encodeURIComponent(getElevenVoice())}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': getElevenKey(), 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) throw new ElevenLabsError(await explain(res))
  return res.blob()
}
