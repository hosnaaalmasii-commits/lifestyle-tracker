// Text-to-speech for the coach, on the browser's built-in speechSynthesis
// (works in Chrome, Edge and Safari incl. iOS — no key or service needed).
// Long replies are spoken sentence by sentence: Chrome silently stops a
// single utterance after ~15 seconds.

export function isSpeechSynthesisSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

let voices = []
function loadVoices() {
  voices = window.speechSynthesis.getVoices()
}
if (isSpeechSynthesisSupported()) {
  loadVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
}

// Prefer the nicer-sounding voices a platform ships for the language.
function pickVoice(lang) {
  if (!voices.length) loadVoices()
  const base = lang.split('-')[0].toLowerCase()
  const matching = voices.filter((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase())
  const pool = matching.length ? matching : voices.filter((v) => v.lang.toLowerCase().startsWith(base))
  return pool.find((v) => /natural|neural|premium|enhanced|google/i.test(v.name)) || pool[0] || null
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

// onEnd fires once, after the last chunk (or right away if there's nothing
// to say) — but not when stopSpeaking() cut it short.
export function speak(text, { lang = 'nl-NL', onEnd } = {}) {
  if (!isSpeechSynthesisSupported()) { onEnd?.(); return }
  stopSpeaking()
  const id = ++session
  const parts = chunks(toSpeakable(text))
  if (!parts.length) { onEnd?.(); return }
  const voice = pickVoice(lang)
  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part)
    u.lang = voice?.lang || lang
    if (voice) u.voice = voice
    u.rate = 1.02
    if (i === parts.length - 1) {
      const done = () => { if (id === session) onEnd?.() }
      u.onend = done
      u.onerror = done
    }
    window.speechSynthesis.speak(u)
  })
}

export function stopSpeaking() {
  if (!isSpeechSynthesisSupported()) return
  session++
  window.speechSynthesis.cancel()
}

// iOS only allows speech that starts from a tap. Calling this inside a
// click handler unlocks later, asynchronous speak() calls (e.g. once the
// coach's reply arrives).
export function unlockSpeech() {
  if (!isSpeechSynthesisSupported()) return
  const u = new SpeechSynthesisUtterance(' ')
  u.volume = 0
  window.speechSynthesis.speak(u)
}
