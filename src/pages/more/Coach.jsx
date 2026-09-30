import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { hasApiKey, sendToClaude, getCoachSettings, ClaudeApiError } from '../../utils/claudeApi'
import { buildSystemPrompt } from '../../utils/coachContext'
import { isSpeechRecognitionSupported, createSpeechRecognizer } from '../../utils/speechInput'
import { isSpeechSynthesisSupported, speak, stopSpeaking, unlockSpeech } from '../../utils/speechOutput'
import DayReplanSheet from '../../components/DayReplanSheet'
import DictateButton from '../../components/DictateButton'
import Sheet from '../../components/Sheet'
import Icon from '../../components/Icon'
import CoachVoicePicker from '../../components/CoachVoicePicker'
import { useT } from '../../i18n/useT'
import { tx } from '../../i18n/tx'

const CHAT_STORAGE = 'lifestyle-tracker-coach-chat'
const SPEAK_STORAGE = 'lifestyle-tracker-coach-speak'
export const COACH_PREFILL = 'lifestyle-tracker-coach-prefill'

const CAN_LISTEN = isSpeechRecognitionSupported()
const CAN_SPEAK = isSpeechSynthesisSupported()

// Appended to the system prompt when the reply will be read out loud.
const SPOKEN_STYLE = '\n\nThe user is talking to you by voice and your reply will be read aloud. Answer in 1–3 short, natural spoken sentences. No lists, headings, markdown or emoji.'

function loadChat() {
  try { return JSON.parse(localStorage.getItem(CHAT_STORAGE) || '[]') } catch { return [] }
}
function saveChat(messages) {
  localStorage.setItem(CHAT_STORAGE, JSON.stringify(messages.slice(-30)))
}
function loadSpeakPref() {
  try { return localStorage.getItem(SPEAK_STORAGE) === '1' } catch { return false }
}

// Chat layout after the Richting E Figma mockup: glowing coach orb,
// bubbles, quick-reply pills and a pill input pinned above the tab bar.
// The coach's personality is picked in Settings → AI Coach.
// Voice: the mic in the input bar dictates (and sends when you stop); a
// reply to something *spoken* is always read aloud, typed messages only
// when the speaker toggle is on. "Praat met je coach" opens a hands-free
// conversation (listen → reply → speak → listen again).
export default function Coach({ setView }) {
  const { data } = useApp()
  const { t, locale } = useT()
  const coachSettings = getCoachSettings()
  const [messages, setMessages] = useState(loadChat)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [replanOpen, setReplanOpen] = useState(false)
  const [speakOn, setSpeakOn] = useState(loadSpeakPref)
  const [talkOpen, setTalkOpen] = useState(false)
  const [talkState, setTalkState] = useState('idle') // idle | listening | thinking | speaking
  const [heard, setHeard] = useState('')
  const talkRef = useRef(false)
  const recognizerRef = useRef(null)
  const messagesRef = useRef(messages)
  const speakOnRef = useRef(speakOn)
  const scrollRef = useRef(null)

  const keyPresent = hasApiKey()

  useEffect(() => { saveChat(messages); messagesRef.current = messages }, [messages])
  // A message handed over from the Vandaag voice sheet ("Praat met de
  // coach") — it was spoken, so the reply is spoken too. Sent once, then cleared.
  useEffect(() => {
    const prefill = sessionStorage.getItem(COACH_PREFILL)
    if (prefill === null) return
    sessionStorage.removeItem(COACH_PREFILL)
    if (prefill.trim() && keyPresent) sendText(prefill, { voice: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])
  useEffect(() => () => { talkRef.current = false; recognizerRef.current?.abort(); stopSpeaking() }, [])

  const send = () => sendText(input)
  // OpenAI/ElevenLabs failed (credit used up, bad key…) — it already fell back
  // to the device voice; just say why it sounds different.
  const voiceError = (e) => setError(`${e.message} ${tx("De stem van je apparaat wordt nu gebruikt.")}`)

  // voice: the message was spoken → short spoken-style reply, read aloud
  // (in the conversation sheet the loop does the speaking itself).
  const sendText = async (raw, { voice = false } = {}) => {
    const text = raw.trim()
    if (!text || sending) return null
    setInput('')
    setError('')
    const nextMessages = [...messagesRef.current, { role: 'user', content: text }]
    messagesRef.current = nextMessages
    setMessages(nextMessages)
    setSending(true)
    try {
      const system = buildSystemPrompt(coachSettings.personality, data) + (voice ? SPOKEN_STYLE : '')
      const reply = await sendToClaude({
        system,
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        maxTokens: voice ? 400 : 700,
      })
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      if (!talkRef.current && CAN_SPEAK && (voice || speakOnRef.current)) speak(reply, { lang: locale, onError: voiceError })
      return reply
    } catch (e) {
      setError(e instanceof ClaudeApiError ? e.message : 'Something went wrong sending that.')
      return null
    } finally {
      setSending(false)
    }
  }

  const toggleSpeak = () => {
    const next = !speakOn
    setSpeakOn(next)
    speakOnRef.current = next
    try { localStorage.setItem(SPEAK_STORAGE, next ? '1' : '0') } catch { /* private mode */ }
    if (next) unlockSpeech()
    else stopSpeaking()
  }

  // ---- hands-free conversation ----
  const listen = () => {
    if (!talkRef.current) return
    stopSpeaking()
    setHeard('')
    setTalkState('listening')
    let said = ''
    const recognizer = createSpeechRecognizer({
      lang: locale,
      onResult: ({ text }) => { said = text; setHeard(text) },
      onError: () => {},
      onEnd: async () => {
        recognizerRef.current = null
        if (!talkRef.current) return
        if (!said.trim()) { setTalkState('idle'); return }
        setTalkState('thinking')
        const reply = await sendText(said, { voice: true })
        if (!talkRef.current) return
        if (!reply) { setTalkState('idle'); return }
        setTalkState('speaking')
        speak(reply, { lang: locale, onError: voiceError, onEnd: () => { if (talkRef.current) listen() } })
      },
    })
    recognizerRef.current = recognizer
    recognizer.start()
  }

  const openTalk = () => {
    unlockSpeech()
    stopSpeaking()
    talkRef.current = true
    setTalkOpen(true)
    listen()
  }
  const closeTalk = () => {
    talkRef.current = false
    recognizerRef.current?.abort()
    recognizerRef.current = null
    stopSpeaking()
    setTalkOpen(false)
    setTalkState('idle')
  }
  const tapOrb = () => {
    if (talkState === 'listening') recognizerRef.current?.stop()
    else if (talkState === 'speaking' || talkState === 'idle') listen()
  }

  const header = (
    <div className="row" style={{ gap: 12, justifyContent: 'flex-start', marginBottom: 16, paddingRight: 52 }}>
      <span
        aria-hidden
        style={{
          width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
          background: 'radial-gradient(circle at 40% 38%, #ffffff 0%, color-mix(in srgb, var(--accent) 55%, #ffffff) 30%, var(--accent) 62%, color-mix(in srgb, var(--accent) 60%, #000000) 100%)',
          boxShadow: '0 0 24px color-mix(in srgb, var(--accent) 55%, transparent)',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{t('coach.title')}</div>
        <div className="text-sm faint">{t('coach.sub')}</div>
      </div>
      {keyPresent && CAN_SPEAK && (
        <button
          type="button"
          onClick={toggleSpeak}
          aria-label={speakOn ? t('coach.voiceOn') : t('coach.voiceOff')}
          title={speakOn ? t('coach.voiceOn') : t('coach.voiceOff')}
          style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: speakOn ? 'var(--accent)' : 'transparent',
            color: speakOn ? 'var(--accent-contrast)' : 'var(--second)',
            border: speakOn ? 'none' : '1.2px solid color-mix(in srgb, var(--second) 70%, transparent)',
          }}
        >
          <Icon name={speakOn ? 'speaker' : 'speakerOff'} size={18} />
        </button>
      )}
    </div>
  )

  if (!keyPresent) {
    return (
      <div className="page">
        {header}
        <Bubble role="assistant">{t('coach.noKey')}</Bubble>
        <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setView('settings')}>{t('coach.toSettings')}</button>
      </div>
    )
  }

  const quickAsk = (text) => { setInput(''); sendText(text) }
  const talkLabel = {
    listening: t('coach.listening'),
    thinking: t('coach.thinking'),
    speaking: t('coach.speaking'),
    idle: t('coach.tapToTalk'),
  }[talkState]
  const lastReply = [...messages].reverse().find((m) => m.role === 'assistant')

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - var(--tabbar-height) - 40px)' }}>
      {header}

      <div ref={scrollRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0 14px' }}>
        {messages.length === 0 && (
          <Bubble role="assistant">{t('coach.hello')}</Bubble>
        )}
        {messages.map((m, i) => (
          <Bubble
            key={i}
            role={m.role}
            onSpeak={m.role === 'assistant' && CAN_SPEAK ? () => { unlockSpeech(); speak(m.content, { lang: locale, onError: voiceError }) } : null}
            speakLabel={t('coach.readAloud')}
          >
            {m.content}
          </Bubble>
        ))}
        {sending && <div className="text-sm faint" style={{ padding: '2px 6px' }}>{t('coach.thinking')}</div>}
      </div>

      {error && <div className="text-sm" style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div>}

      <div
        style={{
          position: 'sticky', bottom: 'calc(var(--tabbar-height) + var(--safe-bottom) + 12px)',
          paddingTop: 8,
        }}
      >
        <div className="scroll-x" style={{ marginBottom: 10 }}>
          {CAN_LISTEN && (
            <button className="chip" onClick={openTalk} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="mic" size={14} />{t('coach.talk')}
            </button>
          )}
          <button className="chip" onClick={() => setReplanOpen(true)}>{t('coach.q.replan')}</button>
          <button className="chip" onClick={() => quickAsk(t('coach.q.focusAsk'))}>{t('coach.q.focus')}</button>
          <button className="chip" onClick={() => quickAsk(t('coach.q.weekAsk'))}>{t('coach.q.week')}</button>
          <button className="chip" onClick={() => quickAsk(t('coach.q.snackAsk'))}>{t('coach.q.snack')}</button>
        </div>
        <div
          className="row"
          style={{ gap: 8, padding: '5px 5px 5px 18px', borderRadius: 999, background: 'var(--surface)', border: '1.2px solid color-mix(in srgb, var(--accent) 55%, transparent)' }}
        >
          <input
            style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14.5 }}
            placeholder={t('coach.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }}
          />
          <DictateButton
            compact
            onText={setInput}
            onDone={(text) => { unlockSpeech(); sendText(text, { voice: true }) }}
          />
          <button className="btn btn-primary btn-sm" disabled={sending || !input.trim()} onClick={send}>{t('coach.send')}</button>
        </div>
      </div>

      <DayReplanSheet open={replanOpen} onClose={() => setReplanOpen(false)} />

      <Sheet open={talkOpen} onClose={closeTalk} title={t('coach.talk')}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '6px 0 4px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={tapOrb}
            disabled={talkState === 'thinking'}
            aria-label={talkLabel}
            className={talkState === 'speaking' ? 'coach-orb speaking' : talkState === 'listening' ? 'coach-orb listening' : 'coach-orb'}
            style={{
              width: 132, height: 132, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'radial-gradient(circle at 40% 38%, #ffffff 0%, color-mix(in srgb, var(--accent) 55%, #ffffff) 30%, var(--accent) 62%, color-mix(in srgb, var(--accent) 60%, #000000) 100%)',
              boxShadow: '0 0 40px color-mix(in srgb, var(--accent) 55%, transparent)',
              opacity: talkState === 'thinking' ? 0.7 : 1,
            }}
          />
          <div style={{ fontWeight: 700 }}>{talkLabel}</div>
          <div className="text-sm muted" style={{ minHeight: 40, maxWidth: 320 }}>
            {talkState === 'listening' || talkState === 'thinking' ? heard : talkState === 'speaking' ? lastReply?.content : ''}
          </div>
          {error && <div className="text-sm" style={{ color: 'var(--danger)' }}>{error}</div>}
          <button className="btn btn-secondary btn-block" onClick={closeTalk}>{t('coach.stopTalk')}</button>
          <details style={{ width: '100%', textAlign: 'left' }}>
            <summary className="text-sm muted" style={{ cursor: 'pointer', textAlign: 'center', padding: '4px 0' }}>{tx("Stem kiezen")}</summary>
            <div style={{ paddingTop: 10 }}><CoachVoicePicker /></div>
          </details>
        </div>
      </Sheet>
    </div>
  )
}

function Bubble({ role, children, onSpeak, speakLabel }) {
  const mine = role === 'user'
  return (
    <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: mine ? '78%' : '86%', display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 4 }}>
      <div
        style={{
          background: mine ? 'var(--accent)' : 'var(--surface)',
          color: mine ? 'var(--accent-contrast)' : 'var(--text)',
          border: mine ? 'none' : '1px solid var(--border-soft)',
          padding: '11px 14px',
          borderRadius: mine ? '18px 6px 18px 18px' : '6px 18px 18px 18px',
          fontSize: 14.5,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}
      >
        {children}
      </div>
      {onSpeak && (
        <button
          type="button"
          onClick={onSpeak}
          aria-label={speakLabel}
          title={speakLabel}
          style={{ background: 'none', border: 'none', padding: '2px 6px', cursor: 'pointer', color: 'var(--text-soft)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}
        >
          <Icon name="speaker" size={14} />{speakLabel}
        </button>
      )}
    </div>
  )
}
