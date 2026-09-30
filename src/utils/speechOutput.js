// Text-to-speech for the coach. The user picks the provider: the device's
// own voices (browser speechSynthesis — Chrome, Edge, Safari incl. iOS, no
// key needed), OpenAI (openaiTts.js) or ElevenLabs (elevenLabs.js). A
// cloud provider without a key, or whose call fails, falls back to the
// device voice. Device-voice replies are spoken sentence by sentence:
// Chrome silently stops a single utterance after ~15 seconds.
import { hasElevenKey, synthesize } from './elevenLabs'
import { hasOpenAiKey, synthesizeOpenAi } from './openaiTts'

export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

// The chosen provider, voice and speed are per device (each device has its
// own voices and keys), so they live in their own localStorage keys, not in `data`.
const VOICE_STORAGE = 'lifestyle-tracker-coach-voice'
const RATE_STORAGE = 'lifestyle-tracker-coach-rate'
const PROVIDER_STORAGE = 'lifestyle-tracker-coach-voice-provider'

export const VOICE_PROVIDERS = [
  { id: 'device', label: 'Toestel' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'elevenlabs', label: 'ElevenLabs' },
]

// Before the provider choice existed, an ElevenLabs key alone meant "use it".
export function getVoiceProvider() {
  let saved = ''
  try { saved = localStorage.getItem(PROVIDER_STORAGE) || '' } catch { /* private mode */ }
  if (VOICE_PROVIDERS.some((p) => p.id === saved)) return saved
  return hasElevenKey() ? 'elevenlabs' : 'device'
}
export function setVoiceProvider(id) {
  try { localStorage.setItem(PROVIDER_STORAGE, id) } catch { /* private mode */ }
}

// The cloud provider that will actually be used right now, if any.
function activeCloud() {
  const provider = getVoiceProvider()
  if (provider === 'elevenlabs' && hasElevenKey()) return { name: 'ElevenLabs', synth: synthesize }
  if (provider === 'openai' && hasOpenAiKey()) return { name: 'OpenAI', synth: synthesizeOpenAi }
  return null
}

const SPEECH_LANG_STORAGE = 'lifestyle-tracker-speech-lang'

// Applied to every voice: the device voice's own rate, and the playback
// rate of OpenAI/ElevenLabs audio (pitch preserved) — asking those
// services for a speed barely changed anything audible.
export const SPEECH_RATES = [
  { value: 0.75, label: 'Heel rustig' },
  { value: 0.9, label: 'Rustig' },
  { value: 1, label: 'Normaal' },
  { value: 1.15, label: 'Snel' },
  { value: 1.3, label: 'Heel snel' },
]

// The language you talk to the app in and the coach answers in — by
// default the app language. aiName is what Claude is told to reply in.
export const SPEECH_LANGS = [
  { code: 'nl-NL', label: 'Nederlands (Nederland)', aiName: 'Dutch' },
  { code: 'nl-BE', label: 'Nederlands (België)', aiName: 'Dutch (Flemish)' },
  { code: 'en-GB', label: 'English (UK)', aiName: 'English' },
  { code: 'en-US', label: 'English (US)', aiName: 'English' },
  { code: 'fr-FR', label: 'Français', aiName: 'French' },
  { code: 'de-DE', label: 'Deutsch', aiName: 'German' },
  { code: 'es-ES', label: 'Español', aiName: 'Spanish' },
  { code: 'it-IT', label: 'Italiano', aiName: 'Italian' },
  { code: 'pt-PT', label: 'Português', aiName: 'Portuguese' },
  { code: 'tr-TR', label: 'Türkçe', aiName: 'Turkish' },
  { code: 'ar-SA', label: 'العربية (Arabisch)', aiName: 'Arabic' },
  { code: 'fa-IR', label: 'فارسی (Perzisch)', aiName: 'Persian (Farsi)' },
  { code: 'pl-PL', label: 'Polski', aiName: 'Polish' },
]

// Saved choice, or '' = follow the app language.
export function getSpeechLangSetting() {
  try { return localStorage.getItem(SPEECH_LANG_STORAGE) || '' } catch { return '' }
}
export function setSpeechLangSetting(code) {
  try { code ? localStorage.setItem(SPEECH_LANG_STORAGE, code) : localStorage.removeItem(SPEECH_LANG_STORAGE) } catch { /* private mode */ }
}
// The locale to listen and speak in, given the app's own locale.
export function getSpeechLang(appLocale) {
  return getSpeechLangSetting() || appLocale
}
// The language name to make Claude reply in, or null = app language.
export function getSpeechAiLanguage() {
  const code = getSpeechLangSetting()
  return code ? SPEECH_LANGS.find((l) => l.code === code)?.aiName || null : null
}

let voices = []
const voiceListeners = new Set()
function loadVoices() {
  voices = window.speechSynthesis.getVoices()
  voiceListeners.forEach((fn) => fn())
}
if (isSpeechSynthesisSupported()) {
  loadVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
}

// Voices load asynchronously in Chrome — returns an unsubscribe function.
export function onVoicesChanged(fn) {
  voiceListeners.add(fn)
  return () => voiceListeners.delete(fn)
}

const NICE_VOICE = /natural|neural|premium|enhanced|google/i

// All voices for the app language, nicest first.
export function getVoicesFor(lang) {
  if (!isSpeechSynthesisSupported()) return []
  if (!voices.length) loadVoices()
  const base = lang.split('-')[0].toLowerCase()
  return voices
    .filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(base))
    .sort((a, b) => Number(NICE_VOICE.test(b.name)) - Number(NICE_VOICE.test(a.name))
      || Number(b.lang.replace('_', '-').toLowerCase() === lang.toLowerCase()) - Number(a.lang.replace('_', '-').toLowerCase() === lang.toLowerCase())
      || a.name.localeCompare(b.name))
}

// "Microsoft Colette Online (Natural) - Dutch (Netherlands)" → "Colette"
export function voiceLabel(voice) {
  const name = voice.name
    .replace(/^(Microsoft|Google|Apple)\s+/i, '')
    .replace(/\s*-\s*[^-]*$/, '')
    .replace(/\s*\((Natural|Enhanced|Premium)\)/i, '')
    .replace(/\s+Online/i, '')
    .trim() || voice.name
  const region = voice.lang.replace('_', '-').split('-')[1]
  return `${name}${region ? ` (${region})` : ''}${NICE_VOICE.test(voice.name) ? ' · natuurlijk' : ''}`
}

export function getPreferredVoiceName() {
  try { return localStorage.getItem(VOICE_STORAGE) || '' } catch { return '' }
}
export function setPreferredVoiceName(name) {
  try { name ? localStorage.setItem(VOICE_STORAGE, name) : localStorage.removeItem(VOICE_STORAGE) } catch { /* private mode */ }
}
// Snapped to the nearest option (older saves used 0.85 / 1.02 / 1.2).
export function getSpeechRate() {
  let saved = 1
  try { saved = Number(localStorage.getItem(RATE_STORAGE)) || 1 } catch { /* private mode */ }
  return SPEECH_RATES.reduce((best, r) => (Math.abs(r.value - saved) < Math.abs(best - saved) ? r.value : best), 1)
}
export function setSpeechRate(rate) {
  try { localStorage.setItem(RATE_STORAGE, String(rate)) } catch { /* private mode */ }
}

// The user's chosen voice if it speaks this language, else the nicest one.
function pickVoice(lang) {
  const pool = getVoicesFor(lang)
  const preferred = getPreferredVoiceName()
  return (preferred && pool.find((v) => v.name === preferred)) || pool[0] || null
}

// Markdown, emoji and list bullets read out loud sound odd.
function toSpeakable(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[*_#`>|]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function chunks(text) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text]
  const out = []
  let cur = ''
  for (const s of sentences) {
    if ((cur + s).length > 220 && cur) { out.push(cur.trim()); cur = '' }
    cur += s
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

let session = 0
let abort = null
let audioEl = null
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

function getAudio() {
  if (!audioEl && typeof Audio !== 'undefined') audioEl = new Audio()
  return audioEl
}

function speakWithDevice(parts, lang, id, onEnd) {
  if (!isSpeechSynthesisSupported()) { onEnd?.(); return }
  const voice = pickVoice(lang)
  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part)
    u.lang = voice?.lang || lang
    if (voice) u.voice = voice
    u.rate = getSpeechRate()
    if (i === parts.length - 1) {
      const done = () => { if (id === session) onEnd?.() }
      u.onend = done
      u.onerror = done
    }
    window.speechSynthesis.speak(u)
  })
}

async function speakWithCloud(cloud, text, parts, lang, id, onEnd, onError) {
  const controller = new AbortController()
  abort = controller
  try {
    const blob = await cloud.synth(text, { lang, signal: controller.signal })
    if (id !== session) return
    const audio = getAudio()
    const url = URL.createObjectURL(blob)
    const done = () => { URL.revokeObjectURL(url); if (id === session) onEnd?.() }
    audio.onended = done
    audio.onerror = done
    audio.src = url
    // Tempo via playback rate, pitch kept. Loading a new src resets
    // playbackRate to defaultPlaybackRate, so set both.
    const rate = getSpeechRate()
    audio.preservesPitch = true
    audio.defaultPlaybackRate = rate
    audio.playbackRate = rate
    await audio.play()
  } catch (e) {
    if (id !== session || e?.name === 'AbortError') return
    // Out of credits, bad key, offline… — say it with the device voice
    // rather than staying silent, and let the caller show why.
    console.warn(`${cloud.name} failed, using the device voice`, e)
    onError?.(e)
    speakWithDevice(parts, lang, id, onEnd)
  }
}

// onEnd fires once, after speaking finishes (or right away if there's
// nothing to say) — but not when stopSpeaking() cut it short.
export function speak(text, { lang = 'nl-NL', onEnd, onError } = {}) {
  stopSpeaking()
  const id = ++session
  const clean = toSpeakable(text)
  const parts = chunks(clean)
  if (!parts.length) { onEnd?.(); return }
  const cloud = activeCloud()
  if (cloud) speakWithCloud(cloud, clean, parts, lang, id, onEnd, onError)
  else speakWithDevice(parts, lang, id, onEnd)
}

export function stopSpeaking() {
  session++
  abort?.abort()
  abort = null
  if (audioEl) { audioEl.pause(); audioEl.onended = null; audioEl.onerror = null }
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel()
}

// iOS only allows audio/speech that starts from a tap. Calling this inside
// a click handler unlocks later, asynchronous speak() calls (e.g. once the
// coach's reply arrives) — for both the device voice and cloud audio.
export function unlockSpeech() {
  const audio = getAudio()
  if (audio && activeCloud()) {
    audio.src = SILENT_WAV
    audio.play().catch(() => {})
  }
  if (!isSpeechSynthesisSupported()) return
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  window.speechSynthesis.speak(u)
}
