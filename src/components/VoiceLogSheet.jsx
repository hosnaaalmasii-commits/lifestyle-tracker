import { useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { hasApiKey, ClaudeApiError } from '../utils/claudeApi'
import { parseVoiceTranscript, applyVoiceIntent, CATEGORY_META, CATEGORY_DESTINATION } from '../utils/voiceLogging'
import { parseTranscriptLocally } from '../utils/localVoiceParser'
import { unlockSpeech } from '../utils/speechOutput'
import { isSpeechRecognitionSupported, createSpeechRecognizer } from '../utils/speechInput'
import Sheet from './Sheet'
import Icon from './Icon'
import { tx } from '../i18n/tx'
import { useT } from '../i18n/useT'
import { todayKey } from '../utils/dates'
import { getTasksForDate } from '../utils/taskSchedule'

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
  count: 'Drinks', hours: 'Hours', quality: 'Quality', kg: 'Weight', name: 'Name', calories: 'kcal',
  proteinG: 'Protein', carbsG: 'Carbs', fatG: 'Fat', title: 'What', start: 'From', end: 'Until',
  location: 'Where', travelMinutes: 'Travel (min)', address: 'Address', taskId: 'Task',
}

function formatValue(name, value) {
  if (value == null || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (name === 'volumeMl') return `${value} ml`
  if (name === 'weightKg') return `${value} kg`
  return String(value)
}

// onOpenCoach(text): hand what was said to the AI coach instead of
// logging it (the coach page sends it as the first message).
export default function VoiceLogSheet({ open, onClose, onOpenCoach }) {
  const app = useApp()
  const [transcript, setTranscript] = useState('')
  const [intents, setIntents] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // What was just written, and where — shown instead of the form after saving.
  const [saved, setSaved] = useState(null)
  const [listening, setListening] = useState(false)
  const { locale } = useT()
  const savingRef = useRef(false)
  const recognizerRef = useRef(null)
  const transcriptRef = useRef('')
  const parseTriggeredRef = useRef(false)
  const suppressAutoParseRef = useRef(false)

  const reset = () => {
    setTranscript('')
    setIntents(null)
    setError('')
    setSaved(null)
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
      const today = todayKey()
      const done = app.data.taskCompletions[today] || {}
      const tasks = getTasksForDate(app.data.taskSchedule, today, app.data.dayOverrides)
        .map((t) => ({ id: t.id, time: t.time, label: t.label, done: !!done[t.id] }))
      // Claude when a key is set (better estimates, more categories); the
      // rule-based parser otherwise, or when the API call fails.
      let result
      if (hasApiKey()) {
        try {
          result = await parseVoiceTranscript(text, { tasks, places: app.data.places || [] })
        } catch (e) {
          console.warn('AI parse failed, using the offline parser', e)
          result = parseTranscriptLocally(text, { tasks })
        }
      } else {
        result = parseTranscriptLocally(text, { tasks })
      }
      if (result.length === 0) setError(tx("Didn't catch anything to log — try rephrasing."))
      else if (result.some((i) => i.followUp)) setIntents(result) // only ask when an amount really matters
      else commit(result)
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
      if (parseTriggeredRef.current) return
      parseTriggeredRef.current = true
      parse(text)
    }

    const recognizer = createSpeechRecognizer({
      lang: locale,
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

  // Writes straight into the matching parts of the app (Voeding, Water,
  // Slaap, …) — no extra confirm step unless a follow-up question was needed.
  const commit = (list) => {
    if (savingRef.current) return
    savingRef.current = true
    list.forEach((intent) => applyVoiceIntent(app, intent))
    setIntents(null)
    setSaved(list)
  }
  const saveAll = () => commit(intents)

  // No AI required — the transcript itself (from the native speech API or
  // typed text) is the thing being logged, saved as a plain dated note.
  const saveAsNote = () => {
    const text = transcript.trim()
    if (!text || savingRef.current) return
    savingRef.current = true
    app.addNote(text)
    setSaved([{ id: 'note', category: 'note', summary: text, when: 'today' }])
  }

  return (
    <Sheet open={open} onClose={handleClose} title={tx("Inspreken")}>
      {saved ? (
        <div className="stack" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
            <span style={{ color: 'var(--accent)' }}><Icon name="check" size={22} /></span>
            <div style={{ fontWeight: 700 }}>{tx("Opgeslagen")}</div>
          </div>
          <div className="card">
            {saved.map((intent, i) => {
              const meta = CATEGORY_META[intent.category] || CATEGORY_META.note
              return (
                <div key={intent.id || i} className="row" style={{ gap: 10, justifyContent: 'flex-start', padding: '8px 0', borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
                  <span style={{ color: meta.color }}><Icon name={meta.icon} size={18} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{intent.summary}</div>
                    <div className="text-sm faint">→ {tx(CATEGORY_DESTINATION[intent.category] || 'Notities')}{intent.when === 'yesterday' ? ` · ${tx("Yesterday")}` : ''}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <button className="btn btn-primary btn-block" onClick={handleClose}>{tx("Klaar")}</button>
          <button className="btn btn-ghost btn-block" onClick={reset}>{tx("Nog iets inspreken")}</button>
        </div>
      ) : (
        <>
          {SPEECH_SUPPORTED && !intents && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 18px' }}>
              <button
                className="btn-ghost"
                onClick={toggleListening}
                disabled={loading}
                aria-label={listening ? tx("Stop listening") : tx("Tap to speak")}
                style={{
                  width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: listening ? 'var(--danger)' : 'var(--accent-fill)',
                  color: listening ? '#fff' : 'var(--accent-contrast)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: 'var(--shadow-md)',
                  animation: listening ? 'mic-pulse 1.2s ease-in-out infinite' : 'none',
                }}
              >
                <Icon name="mic" size={28} />
              </button>
              <div className="text-sm muted" style={{ marginTop: 10 }}>
                {listening ? tx("Listening… tap to stop") : tx("Tap to speak")}
              </div>
            </div>
          )}

          <div className="field">
            <label>{SPEECH_SUPPORTED ? tx("Or type it") : tx("Say what happened — type it, or use your keyboard's dictation mic")}</label>
            <textarea
              className="input"
              style={{ minHeight: 84, resize: 'vertical' }}
              placeholder={tx("bv. ik heb 7 uur geslapen, voel me goed, om 15:00 tandarts in Utrecht en mijn gym is aan de Kerkstraat 5")}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              disabled={loading || listening}
            />
            {!SPEECH_SUPPORTED && (
              <p className="text-sm faint" style={{ marginTop: 6 }}>
                {tx("This browser doesn't support in-app voice capture — tap the box above and use your keyboard's microphone/dictation button to speak instead.")}
              </p>
            )}
          </div>

          {!intents && (
            <div className="stack" style={{ gap: 8 }}>
              <button className="btn btn-primary btn-block" disabled={!transcript.trim() || loading} onClick={() => parse()}>
                {loading ? tx("Thinking…") : tx("Opslaan")}
              </button>
              {onOpenCoach && hasApiKey() && (
                <button
                  className="btn btn-secondary btn-block"
                  disabled={loading}
                  onClick={() => { const text = transcript.trim(); unlockSpeech(); handleClose(); onOpenCoach(text) }}
                >
                  {tx("Praat met de coach")}
                </button>
              )}
              <button className="btn btn-ghost btn-block" disabled={!transcript.trim() || loading} onClick={saveAsNote}>
                {tx("Save as note")}
              </button>
              {!hasApiKey() && (
                <p className="text-sm faint" style={{ margin: '2px 4px 0' }}>
                  {tx("Eten, water, slaap, gewicht, stemming, training en uitgaven worden automatisch herkend. Met een Claude API-sleutel (Instellingen → AI Coach) worden de schattingen nauwkeuriger en herkent de app ook afspraken en plaatsen.")}
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
                          <div className="text-sm faint">{tx(meta.label)} · {intent.when === 'yesterday' ? tx("Yesterday") : tx("Today")}</div>
                        </div>
                      </div>
                      <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 12 }} onClick={() => removeIntent(intent.id)}>{tx("Remove")}</button>
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
                              <button key={c.label} className="chip" onClick={() => resolveFollowUp(intent.id, c.value)}>{tx(c.label)}</button>
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
              <button className="btn btn-ghost btn-block" onClick={reset}>{tx("Start over")}</button>
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
        placeholder={tx("Enter a number")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <button className="btn btn-secondary btn-sm" disabled={!value} onClick={() => onSubmit(Number(value))}>{tx("Confirm")}</button>
    </div>
  )
}
