import { useEffect, useRef, useState } from 'react'
import { isSpeechRecognitionSupported, createSpeechRecognizer } from '../utils/speechInput'
import Icon from './Icon'

export const DICTATION_SUPPORTED = isSpeechRecognitionSupported()

// Small Dutch "tap and talk" mic for a text field — no AI involved, it
// only fills in the words. Renders nothing where the browser has no
// SpeechRecognition (Safari/iOS); callers show a hint pointing at the
// keyboard's own dictation mic instead.
export default function DictateButton({ onText, onDone, lang = 'nl-NL' }) {
  const [listening, setListening] = useState(false)
  const recognizerRef = useRef(null)

  useEffect(() => () => recognizerRef.current?.abort(), [])

  if (!DICTATION_SUPPORTED) return null

  const toggle = () => {
    if (listening) {
      recognizerRef.current?.stop()
      return
    }
    let last = ''
    const recognizer = createSpeechRecognizer({
      lang,
      onResult: ({ text }) => { last = text; onText(text) },
      onEnd: () => { setListening(false); recognizerRef.current = null; if (last) onDone?.(last) },
      onError: () => setListening(false),
    })
    recognizerRef.current = recognizer
    setListening(true)
    recognizer.start()
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? 'Stop met luisteren' : 'Inspreken'}
      className={listening ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
      style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, animation: listening ? 'mic-pulse 1.2s ease-in-out infinite' : 'none' }}
    >
      <Icon name="mic" size={16} />
      {listening ? 'Luistert…' : 'Inspreken'}
    </button>
  )
}
