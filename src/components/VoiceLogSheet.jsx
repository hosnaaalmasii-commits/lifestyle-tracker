import { useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { hasApiKey, ClaudeApiError } from '../utils/claudeApi'
import { parseVoiceTranscript, applyVoiceIntent, CATEGORY_META } from '../utils/voiceLogging'
import { isSpeechRecognitionSupported, createSpeechRecognizer } from '../utils/speechInput'
import Sheet from './Sheet'
import Icon from './Icon'

const SPEECH_SUPPORTED = isSpeechRecognitionSupported()

const CONFIDENCE_LABEL = {
  exact: 'Exact',
  estimated: 'Estimated',
  unknown: 'Unknown',
}

const FIELD_LABEL = {
  volumeMl: 'Amount', slot: 'Meal', includesVegetables: 'Vegetables', label: 'Mood', note: 'Note',
  mode: 'Type', exerciseName: 'Exercise', weightKg: 'Weight', reps: 'Reps',
  flow: 'Flow', symptoms: 'Symptoms', time: 'Time', text: 'Note', amount: 'Amount', category: 'Category',
}

function formatValue(name, value) {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (name === 'volumeMl') return `${value} ml`
  if (name === 'weightKg') return `${value} kg`
  return String(value)
}

export default function VoiceLogSheet({ open, onClose }) {
  const app = useApp()
  const [transcript, setTranscript] = useState('')
  const [intents, setIntents] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [listening, setListening] = useState(false)
  const savingRef = useRef(false)
  const recognizerRef = useRef(null)
  const transcriptRef = useRef('')
  const parseTriggeredRef = useRef(false)
  const suppressAutoParseRef = useRef(false)

  const reset = () => {
    setTranscript('')
    setIntents(null)
    setError('')
    setSaved(false)
    savingRef.current = false
  }

  // A manual tap-to-stop should still transcribe+parse whatever was heard —
  // only closing the whole sheet should discard it, which is why these are
  // two different methods (plain .stop() vs .abort() + a suppress flag) even
  // though both end the underlying recognizer.
  const stopListening = () => {
    recognizerRef.current?.stop()
  }

  const handleClose = () => {
    suppressAutoParseRef.current = true
    recognizerRef.current?.abort()
    setListening(false)
    reset()
    onClose()
  }

  const parse = async (textOverride) => {
    const text = (textOverride ?? transcript).trim()
    if (!text || loading) return
    setLoading(true)
    setError('')
    try {
      const result = await parseVoiceTranscript(text)
      setIntents(result)
      if (result.length === 0) setError('Didn\'t catch anything to log — try rephrasing.')
    } catch (e) {
      setError(e instanceof ClaudeApiError ? e.message : 'Something went wrong understanding that.')
    } finally {
      setLoading(false)
    }
  }

  const startListening = () => {
    setError('')
    setTranscript('')
    transcriptRef.current = ''
    parseTriggeredRef.current = false
    suppressAutoParseRef.current = false

    // Without a key there's nothing to auto-parse into — leave the
    // transcript sitting in the box so "Save as note" can pick it up.
    const triggerParseOnce = (text) => {
      if (parseTriggeredRef.current || !hasApiKey()) return
      parseTriggeredRef.current = true
      parse(text)
    }

    const recognizer = createSpeechRecognizer({
      onResult: ({ text, isFinal }) => {
        setTranscript(text)
        transcriptRef.current = text
        if (isFinal) {
          setListening(false)
          triggerParseOnce(text)
        }
      },
      // Fires whether the session ended by detected silence, a manual
      // tap-to-stop, or an error — any of those should still parse
      // whatever was heard, unless we're the ones tearing the sheet down.
      onEnd: () => {
        setListening(false)
        if (!suppressAutoParseRef.current && transcriptRef.current.trim()) {
          triggerParseOnce(transcriptRef.current)
        }
      },
      onError: (err) => {
        setListening(false)
        if (err !== 'no-speech' && err !== 'aborted') setError('Couldn\'t hear anything — try again or type it instead.')
      },
    })
    recognizerRef.current = recognizer
    recognizer.start()
    setListening(true)
  }

  const toggleListening = () => {
    if (listening) stopListening()
    else startListening()
  }

  const resolveFollowUp = (intentId, value) => {
    setIntents((prev) => prev.map((intent) => {
      if (intent.id !== intentId) return intent
      return {
        ...intent,
        fields: { ...intent.fields, [intent.followUp.field]: { value, confidence: 'exact' } },
        followUp: null,
      }
    }))
  }

  const removeIntent = (intentId) => {
    setIntents((prev) => prev.filter((i) => i.id !== intentId))
  }

  const pendingCount = intents ? intents.filter((i) => i.followUp).length : 0

  const saveAll = () => {
    if (savingRef.current) return
    savingRef.current = true
    intents.forEach((intent) => applyVoiceIntent(app, intent))
    setSaved(true)
    setTimeout(handleClose, 900)
  }

  // No AI required — the transcript itself (from the native speech API or
  // typed text) is the thing being logged, saved as a plain dated note.
  const saveAsNote = () => {
    const text = transcript.trim()
    if (!text || savingRef.current) return
    savingRef.current = true
    app.addNote(text)
    setSaved(true)
    setTimeout(handleClose, 900)
  }

  return (
    <Sheet open={open} onClose={handleClose} title="Log by voice">
      {saved ? (
        <div className="empty-state">
          <div className="icon"><Icon name="check" size={26} /></div>
          <p>Logged.</p>
        </div>
      ) : (
        <>
          {SPEECH_SUPPORTED && !intents && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 18px' }}>
              <button
                className="btn-ghost"
                onClick={toggleListening}
                disabled={loading}
                aria-label={listening ? 'Stop listening' : 'Tap to speak'}
                style={{
                  width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: listening ? 'var(--danger)' : 'var(--accent-fill)',
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: 'var(--shadow-md)',
                  animation: listening ? 'mic-pulse 1.2s ease-in-out infinite' : 'none',
                }}
              >
                <Icon name="mic" size={28} />
              </button>
              <div className="text-sm muted" style={{ marginTop: 10 }}>
                {listening ? 'Listening… tap to stop' : 'Tap to speak'}
              </div>
            </div>
          )}

          <div className="field">
            <label>{SPEECH_SUPPORTED ? 'Or type it' : 'Say what happened — type it, or use your keyboard\'s dictation mic'}</label>
            <textarea
              className="input"
              style={{ minHeight: 84, resize: 'vertical' }}
              placeholder="e.g. I drank a bottle of water and had a salad for lunch"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              disabled={loading || listening}
            />
            {!SPEECH_SUPPORTED && (
              <p className="text-sm faint" style={{ marginTop: 6 }}>
                This browser doesn't support in-app voice capture — tap the box above and use your keyboard's microphone/dictation button to speak instead.
              </p>
            )}
          </div>

          {!intents && (
            <div className="stack" style={{ gap: 8 }}>
              {hasApiKey() && (
                <button className="btn btn-primary btn-block" disabled={!transcript.trim() || loading} onClick={() => parse()}>
                  {loading ? 'Thinking…' : 'Parse with AI'}
                </button>
              )}
              <button className="btn btn-secondary btn-block" disabled={!transcript.trim() || loading} onClick={saveAsNote}>
                Save as note
              </button>
              {!hasApiKey() && (
                <p className="text-sm faint" style={{ margin: '2px 4px 0' }}>
                  Add a Claude API key in More → Settings → AI Coach to auto-categorize this into water, meals, workouts, and more instead of a plain note.
                </p>
              )}
            </div>
          )}

          {error && <div className="text-sm" style={{ color: 'var(--danger)', marginTop: 10 }}>{error}</div>}

          {intents && intents.length > 0 && (
            <div className="stack" style={{ marginTop: 16 }}>
              {intents.map((intent) => {
                const meta = CATEGORY_META[intent.category]
                return (
                  <div key={intent.id} className="card">
                    <div className="row" style={{ alignItems: 'flex-start' }}>
                      <div className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
                        <span style={{ color: meta.color }}><Icon name={meta.icon} size={18} /></span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{intent.summary}</div>
                          <div className="text-sm faint">{meta.label} · {intent.when === 'yesterday' ? 'Yesterday' : 'Today'}</div>
                        </div>
                      </div>
                      <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }} onClick={() => removeIntent(intent.id)}>Remove</button>
                    </div>

                    <div className="stack" style={{ marginTop: 10, gap: 6 }}>
                      {Object.entries(intent.fields)
                        .filter(([name]) => !(intent.followUp && intent.followUp.field === name))
                        .map(([name, field]) => (
                          <div key={name} className="row" style={{ fontSize: 13 }}>
                            <span className="muted">{FIELD_LABEL[name] || name}</span>
                            <span className="row" style={{ gap: 8, justifyContent: 'flex-end', width: 'auto' }}>
                              <span className="mono">{formatValue(name, field.value)}</span>
                              {field.confidence !== 'exact' && (
                                <span className="text-sm faint" style={{ fontSize: 11 }}>({CONFIDENCE_LABEL[field.confidence] || field.confidence})</span>
                              )}
                            </span>
                          </div>
                        ))}
                    </div>

                    {intent.followUp && (
                      <div style={{ marginTop: 12, padding: 12, borderRadius: 'var(--radius-sm)', background: 'color-mix(in srgb, var(--warning) 12%, var(--surface-soft))', border: '1px solid color-mix(in srgb, var(--warning) 35%, var(--border-soft))' }}>
                        <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>{intent.followUp.question}</p>
                        {intent.followUp.choices ? (
                          <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                            {intent.followUp.choices.map((c) => (
                              <button key={c.label} className="chip" onClick={() => resolveFollowUp(intent.id, c.value)}>{c.label}</button>
                            ))}
                          </div>
                        ) : (
                          <FollowUpNumberInput onSubmit={(v) => resolveFollowUp(intent.id, v)} />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              <button className="btn btn-primary btn-block" disabled={pendingCount > 0} onClick={saveAll}>
                {pendingCount > 0 ? `Answer ${pendingCount} question${pendingCount > 1 ? 's' : ''} to save` : `Save ${intents.length} ${intents.length === 1 ? 'entry' : 'entries'}`}
              </button>
              <button className="btn btn-ghost btn-block" onClick={reset}>Start over</button>
            </div>
          )}
        </>
      )}
    </Sheet>
  )
}

function FollowUpNumberInput({ onSubmit }) {
  const [value, setValue] = useState('')
  return (
    <div className="row" style={{ gap: 8 }}>
      <input
        className="input"
        style={{ flex: 1 }}
        type="number"
        placeholder="Enter a number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <button className="btn btn-secondary btn-sm" disabled={!value} onClick={() => onSubmit(Number(value))}>Confirm</button>
    </div>
  )
}
