// Thin wrapper around the browser's built-in SpeechRecognition API.
// Notably unsupported on Safari (desktop and iOS) as of this writing —
// callers must check isSpeechRecognitionSupported() and offer a text
// fallback (with a nudge toward the OS keyboard's own dictation button,
// which works everywhere this API doesn't).
export function isSpeechRecognitionSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function createSpeechRecognizer({ onResult, onEnd, onError }) {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition
  const recognition = new Ctor()
  recognition.lang = 'en-US'
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
