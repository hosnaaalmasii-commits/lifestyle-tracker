import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { hasApiKey, sendToClaude, getCoachSettings, ClaudeApiError } from '../../utils/claudeApi'
import { buildSystemPrompt } from '../../utils/coachContext'
import { isSpeechRecognitionSupported, createSpeechRecognizer, micErrorText } from '../../utils/speechInput'
import { isSpeechSynthesisSupported, speak, stopSpeaking, unlockSpeech, getSpeechLang, getSpeechAiLanguage, getReadAloud } from '../../utils/speechOutput'
import DayReplanSheet from '../../components/DayReplanSheet'
import DictateButton from '../../components/DictateButton'
import Icon from '../../components/Icon'
import CoachAvatar from '../../components/CoachAvatar'
import { coachImage } from '../../utils/coachAvatar'
import CoachPortrait from '../../components/CoachPortrait'
import { coachName, memoryPrompt, memoryIsDue, refreshMemory, HISTORY_FOR_REPLY } from '../../utils/coachMemory'
import { getSpeechProgress } from '../../utils/speechOutput'
import CoachSettingsSheet from '../../components/CoachSettingsSheet'
import CoachTalkView from '../../components/CoachTalkView'
import { useT } from '../../i18n/useT'
import { tx } from '../../i18n/tx'

const CHAT_STORAGE = 'lifestyle-tracker-coach-chat'
export const COACH_PREFILL = 'lifestyle-tracker-coach-prefill'

const CAN_LISTEN = isSpeechRecognitionSupported()
const CAN_SPEAK = isSpeechSynthesisSupported()

// Appended to the system prompt when the reply will be read out loud.
const SPOKEN_STYLE = '\n\nThe user is talking to you by voice and your reply will be read aloud. Answer in 1–3 short, natural spoken sentences. No lists, headings, markdown or emoji.'

// Chats used to live only in this browser (last 30 messages); they now
// sync in data.coach — moved over once, then the old key is removed.
function takeOldChat() {
  try {
    const old = JSON.parse(localStorage.getItem(CHAT_STORAGE) || '[]')
    localStorage.removeItem(CHAT_STORAGE)
    return Array.isArray(old) ? old : []
  } catch { return [] }
}


// Chat layout after the Richting E Figma mockup: glowing coach orb,
// bubbles, quick-reply pills and a pill input pinned above the tab bar.
// The coach's personality is picked in Settings → AI Coach.
// Voice: the mic in the input bar dictates (and sends when you stop); a
// reply to something *spoken* is always read aloud, typed messages only
// when the speaker toggle is on. "Praat met je coach" opens a hands-free
// conversation (listen → reply → speak → listen again).
// openSettings: open straight into "Coach instellen" (from the menu item).
export default function Coach({ setView, openSettings = false }) {
  const { data, addCoachMessages, setCoachMemory } = useApp()
  const { t, locale } = useT()
  const coachSettings = getCoachSettings()
  const messages = data.coach?.messages || []
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [replanOpen, setReplanOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(openSettings)
  const [speakingNow, setSpeakingNow] = useState(false)
  const [talkOpen, setTalkOpen] = useState(false)
  const [talkState, setTalkState] = useState('idle') // idle | listening | thinking | speaking
  const [heard, setHeard] = useState('')
  const [talkReply, setTalkReply] = useState('') // the reply being spoken in the talk view
  const talkRef = useRef(false)
  const recognizerRef = useRef(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const coachRef = useRef(data.coach)
  coachRef.current = data.coach
  const dataRef = useRef(data)
  dataRef.current = data
  const memoryBusy = useRef(false)
  const scrollRef = useRef(null)

  const keyPresent = hasApiKey()

  useEffect(() => {
    const old = takeOldChat()
    if (old.length && !messagesRef.current.length) addCoachMessages(old.map((m) => ({ role: m.role, content: m.content })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Whether the coach is speaking right now (also replies read aloud in the
  // chat) — makes the portrait glow.
  useEffect(() => {
    const id = setInterval(() => setSpeakingNow(!!getSpeechProgress()), 250)
    return () => clearInterval(id)
  }, [])
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
  // The language to listen and speak in (voice settings; default the app's).
  const voiceLang = () => getSpeechLang(locale)
  // OpenAI/ElevenLabs failed (credit used up, bad key…) — it already fell back
  // to the device voice; just say why it sounds different.
  const voiceError = (e) => setError(`${e.message} ${tx("De stem van je apparaat wordt nu gebruikt.")}`)

  // voice: the message was spoken → short spoken-style reply, read aloud
  // (in the conversation sheet the loop does the speaking itself).
  // Every few messages (and when a spoken conversation ends) the coach
  // updates what it knows about the user — in the background.
  const updateMemory = async (force = false, coachNow = coachRef.current) => {
    if (memoryBusy.current || !memoryIsDue(coachNow, force)) return
    memoryBusy.current = true
    try {
      const result = await refreshMemory(coachNow, { language: getSpeechAiLanguage() || undefined })
      if (result) setCoachMemory(result.memory, result.memoryUpTo)
    } catch (e) {
      console.warn('Coach memory update failed', e)
    } finally {
      memoryBusy.current = false
    }
  }

  const sendText = async (raw, { voice = false } = {}) => {
    const text = raw.trim()
    if (!text || sending) return null
    setInput('')
    setError('')
    const userMsg = { role: 'user', content: text, at: Date.now() }
    const nextMessages = [...messagesRef.current, userMsg]
    messagesRef.current = nextMessages
    addCoachMessages([userMsg])
    setSending(true)
    try {
      const d = dataRef.current
      const system = buildSystemPrompt(coachSettings.personality, d) + memoryPrompt(d) + (voice ? SPOKEN_STYLE : '')
      // The API needs the history to start with the user; older messages
      // are covered by the remembered facts.
      let history = nextMessages.slice(-HISTORY_FOR_REPLY).map((m) => ({ role: m.role, content: m.content }))
      while (history.length && history[0].role !== 'user') history = history.slice(1)
      const reply = await sendToClaude({
        system,
        messages: history,
        maxTokens: voice ? 400 : 700,
        // A conversation language picked in the voice settings overrides the app language.
        language: getSpeechAiLanguage() || undefined,
      })
      const coachMsg = { role: 'assistant', content: reply, at: Date.now() }
      messagesRef.current = [...messagesRef.current, coachMsg]
      addCoachMessages([coachMsg])
      updateMemory(false, { ...coachRef.current, messages: messagesRef.current })
      if (!talkRef.current && CAN_SPEAK && (voice || getReadAloud())) speak(reply, { lang: voiceLang(), onError: voiceError })
      return reply
    } catch (e) {
      setError(e instanceof ClaudeApiError ? e.message : 'Something went wrong sending that.')
      return null
    } finally {
      setSending(false)
    }
  }


  // ---- hands-free conversation ----
  const listen = () => {
    if (!talkRef.current) return
    stopSpeaking()
    setHeard('')
    setTalkState('listening')
    let said = ''
    const recognizer = createSpeechRecognizer({
      lang: voiceLang(),
      onResult: ({ text }) => { said = text; setHeard(text) },
      onError: (err) => {
        const msg = micErrorText(err)
        if (msg) { setError(msg); talkRef.current = false; setTalkState('idle') }
      },
      onEnd: async () => {
        recognizerRef.current = null
        if (!talkRef.current) { setTalkState('idle'); return }
        if (!said.trim()) { setTalkState('idle'); return }
        setTalkState('thinking')
        const reply = await sendText(said, { voice: true })
        if (!talkRef.current) return
        if (!reply) { setTalkState('idle'); return }
        setTalkReply(reply)
        setTalkState('speaking')
        speak(reply, { lang: voiceLang(), onError: voiceError, onEnd: () => { if (talkRef.current) listen() } })
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
    updateMemory(true)
  }
  const tapOrb = () => {
    if (talkState === 'listening') recognizerRef.current?.stop()
    else if (talkState === 'speaking' || talkState === 'idle') { setError(''); talkRef.current = true; listen() }
  }

  // Just the coach at the top: tap the face or name to set it up (face,
  // name, voice incl. reading replies aloud, memory).
  const header = (
    <button
      type="button"
      onClick={() => setSettingsOpen(true)}
      aria-label={tx("Coach instellen")}
      className="row"
      style={{ gap: 12, justifyContent: 'flex-start', marginBottom: 16, paddingRight: 52, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text)', textAlign: 'left' }}
    >
      <CoachAvatar avatar={data.settings.coachAvatar} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{coachName(data) || t('coach.title')}</div>
        <div className="text-sm faint">{t('coach.sub')}</div>
      </div>
    </button>
  )

  const avatarSheet = <CoachSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />

  if (!keyPresent) {
    return (
      <div className="page">
        {header}
        <Bubble role="assistant">{t('coach.noKey')}</Bubble>
        {avatarSheet}
      </div>
    )
  }

  const quickAsk = (text) => { setInput(''); sendText(text) }
  // A coach with a face (preset person or own photo): shown waist-up in a
  // glass arch above the chat; tapping it starts a spoken conversation.
  // It can't move its lips, so it breathes and glows (motion.css .coach-arch).
  const face = coachImage(data.settings.coachAvatar)
  const talkLabel = {
    listening: t('coach.listening'),
    thinking: t('coach.thinking'),
    speaking: t('coach.speaking'),
    idle: face ? tx("Tik op je coach en praat") : t('coach.tapToTalk'),
  }[talkState]

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - var(--tabbar-height) - 40px)' }}>
      {header}

      {face && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, margin: '0 0 18px' }}>
          <CoachPortrait
            avatar={data.settings.coachAvatar}
            width={170}
            state={speakingNow ? 'speaking' : 'idle'}
            onClick={CAN_LISTEN ? openTalk : undefined}
            label={t('coach.talk')}
          />
          {CAN_LISTEN && <div className="text-sm muted">{coachName(data) ? `${tx("Tik op")} ${coachName(data)} ${tx("om te praten")}` : tx("Tik op je coach om te praten")}</div>}
        </div>
      )}

      <div ref={scrollRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0 14px' }}>
        {messages.length === 0 && (
          <Bubble role="assistant">{t('coach.hello')}</Bubble>
        )}
        {messages.map((m, i) => (
          <Bubble
            key={i}
            role={m.role}
            onSpeak={m.role === 'assistant' && CAN_SPEAK ? () => { unlockSpeech(); speak(m.content, { lang: voiceLang(), onError: voiceError }) } : null}
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
            onError={(err) => { const msg = micErrorText(err); if (msg) setError(msg) }}
          />
          <button className="btn btn-primary btn-sm" disabled={sending || !input.trim()} onClick={send}>{t('coach.send')}</button>
        </div>
      </div>

      <DayReplanSheet open={replanOpen} onClose={() => setReplanOpen(false)} />
      {avatarSheet}

      <CoachTalkView
        open={talkOpen}
        avatar={data.settings.coachAvatar}
        name={coachName(data)}
        state={talkState}
        heard={heard}
        reply={talkReply}
        error={error}
        onTapCoach={tapOrb}
        onStop={closeTalk}
      />
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
