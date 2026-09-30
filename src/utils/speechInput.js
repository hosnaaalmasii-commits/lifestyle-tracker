import { tx } from '../i18n/tx'

// Thin wrapper around the browser's built-in SpeechRecognition API.
// Notably unsupported on Safari (desktop and iOS) as of this writing —
// callers must check isSpeechRecognitionSupported() and offer a text
// fallback (with a nudge toward the OS keyboard's own dictation button,
// which works everywhere this API doesn't).
export function isSpeechRecognitionSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function createSpeechRecognizer({ onResult, onEnd, onError, lang = 'en-US' }) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
  const recognition = new Ctor()
  recognition.lang = lang
  recognition.interimResults = true
  recognition.continuous = false
  recognition.maxAlternatives = 1

  recognition.onresult = (e) => {
    let finalText = ''
    let interimText = ''
    for (let i = 0; i < e.results.length; i++) {
      const transcript = e.results[i][0].transcript
      if (e.results[i].isFinal) finalText += transcript
      else interimText += transcript
    }
    onResult?.({ text: finalText || interimText, isFinal: !!finalText })
  }
  recognition.onerror = (e) => onError?.(e.error)
  recognition.onend = () => onEnd?.()

  return recognition
}

// What the microphone reported, in words the user can act on.
export function micErrorText(err) {
  if (err === 'not-allowed' || err === 'service-not-allowed') return tx("De microfoon is geblokkeerd. Klik op het slotje naast het webadres → Microfoon → Toestaan, en herlaad de pagina.")
  if (err === 'audio-capture') return tx("Geen microfoon gevonden. Controleer of er een microfoon aangesloten en aangezet is.")
  if (err === 'network') return tx("Spraakherkenning heeft internet nodig. Controleer je verbinding.")
  if (err === 'language-not-supported') return tx("Deze taal wordt niet ondersteund door de spraakherkenning van je browser.")
  return null
}
