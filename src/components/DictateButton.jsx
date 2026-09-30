import { useEffect, useRef, useState } from 'react'
import { isSpeechRecognitionSupported, createSpeechRecognizer } from '../utils/speechInput'
import { getSpeechLang } from '../utils/speechOutput'
import Icon from './Icon'
import { tx } from '../i18n/tx'
import { useT } from '../i18n/useT'

export const DICTATION_SUPPORTED = isSpeechRecognitionSupported()

// Small Dutch "tap and talk" mic for a text field — no AI involved, it
// only fills in the words. Renders nothing where the browser has no
// SpeechRecognition (Safari/iOS); callers show a hint pointing at the
// keyboard's own dictation mic instead.
// compact: a round icon-only mic, for inside a pill input bar.
export default function DictateButton({ onText, onDone, onError, lang: langProp, compact = false }) {
  const [listening, setListening] = useState(false)
  const { locale } = useT()
  const lang = langProp || getSpeechLang(locale) // the chosen conversation language, else the app's
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
      onError: (err) => { setListening(false); onError?.(err) },
    })
    recognizerRef.current = recognizer
    setListening(true)
    recognizer.start()
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-label={listening ? tx("Stop met luisteren") : tx("Inspreken")}
        style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: listening ? 'var(--accent)' : 'transparent',
          color: listening ? 'var(--accent-contrast)' : 'var(--second)',
          border: listening ? 'none' : '1.2px solid color-mix(in srgb, var(--second) 70%, transparent)',
          animation: listening ? 'mic-pulse 1.2s ease-in-out infinite' : 'none',
        }}
      >
        <Icon name="mic" size={16} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? tx("Stop met luisteren") : tx("Inspreken")}
      className={listening ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
      style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, animation: listening ? 'mic-pulse 1.2s ease-in-out infinite' : 'none' }}
    >
      <Icon name="mic" size={16} />
      {listening ? tx("Luistert…") : tx("Inspreken")}
    </button>
  )
}
