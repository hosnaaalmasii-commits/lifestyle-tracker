import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { hasApiKey, setApiKey, sendToClaude, getCoachSettings, ClaudeApiError } from '../../utils/claudeApi'
import { buildSystemPrompt } from '../../utils/coachContext'
import { isSpeechRecognitionSupported, createSpeechRecognizer, micErrorText } from '../../utils/speechInput'
import { cloudEarsAvailable, startRecording, transcribe } from '../../utils/voiceRecorder'
import { hasOpenAiKey } from '../../utils/openaiTts'
import { isSpeechSynthesisSupported, speak, stopSpeaking, unlockSpeech, getSpeechLang, getSpeechAiLanguage, getReadAloud, DeviceSpeechError, getVoiceProvider, getSpeechRate } from '../../utils/speechOutput'
import { hasElevenKey } from '../../utils/elevenLabs'
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
// iOS's speech recognition only hears you when it's started from a tap:
// started on its own after the coach speaks, it "listens" but never gets
// any audio (worked once, then silent — 2026-10-01). So on iOS each turn
// starts with a tap on the coach; elsewhere the loop stays hands-free.
const IS_IOS = typeof navigator !== 'undefined'
  && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
// Spoken replies are 1–3 sentences: Haiku answers several times faster
// than Sonnet (which always thinks first), and speed is what a conversation
// needs.
const VOICE_MODEL = 'claude-haiku-4-5'
// Stop listening this long after the last word instead of waiting for the
// browser's own (slow, on iOS several seconds) end-of-speech detection.
const SILENCE_MS = 1300
const NOTHING_HEARD_MS = 8000
// Record + transcribe ourselves (voiceRecorder.js) instead of the
// browser's recognition: on iOS whenever an OpenAI/ElevenLabs key is
// there (its own recognition often hears nothing), elsewhere only when the
// browser has no recognition at all.
// With ElevenLabs as the coach's voice, "Praat met je coach" is a real live
// conversation through ElevenLabs Agents (elevenAgent.js): just talk, the
// coach answers in that voice, and you can interrupt it. Otherwise the
// listen → Claude → speak loop below.
const useLiveCoach = () => getVoiceProvider() === 'elevenlabs' && hasElevenKey()
const useCloudEars = () => cloudEarsAvailable() && (IS_IOS || !CAN_LISTEN)
const NOTHING_HEARD = "Ik hoorde niets. Tik op de coach en praat opnieuw."
const IOS_NOTHING_HEARD = "Je iPhone gaf geen geluid door aan de spraakherkenning. Tik bovenaan op je coach → Stem → OpenAI of ElevenLabs en vul daar een sleutel in, dan neemt de app zelf op — of typ en gebruik de microfoon van je toetsenbord."
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
  // One small line in the talk view saying what the ears did (mode, clip
  // length, level, transcript) — so a test on the phone can be reported.
  const [diag, setDiag] = useState('')
  const [talkReply, setTalkReply] = useState('') // the reply being spoken in the talk view
  const talkRef = useRef(false)
  const unheardRef = useRef(false) // the last reply was never heard — a tap replays it
  const recognizerRef = useRef(null)
  const wrapUpRef = useRef(null) // ends the current listening turn now
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const coachRef = useRef(data.coach)
  coachRef.current = data.coach
  const dataRef = useRef(data)
  dataRef.current = data
  const memoryBusy = useRef(false)
  const scrollRef = useRef(null)

  // Re-read after the key is pasted on this page (it lives in localStorage).
  const [, setKeyTick] = useState(0)
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
  const liveRef = useRef(null) // the ElevenLabs live conversation, while one is open
  useEffect(() => () => { talkRef.current = false; recognizerRef.current?.abort(); stopSpeaking(); liveRef.current?.endSession() }, [])

  const send = () => sendText(input)
  // The language to listen and speak in (voice settings; default the app's).
  const voiceLang = () => getSpeechLang(locale)
  // OpenAI/ElevenLabs failed (credit used up, bad key…) — it already fell back
  // to the device voice; just say why it sounds different.
  const voiceError = (e) => setError(e instanceof DeviceSpeechError ? tx(e.message) : `${e.message} ${tx("De stem van je apparaat wordt nu gebruikt.")}`)

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
        ...(voice ? { model: VOICE_MODEL } : {}),
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
  // stop = false when the caller just stopped and unlocked speech in the
  // same tap — stopping again would undo the iOS unlock.
  // What was said → the coach's spoken reply.
  const respond = async (said) => {
    if (!talkRef.current) { setTalkState('idle'); return }
    if (!said.trim()) { setError(tx(IS_IOS && !useCloudEars() ? IOS_NOTHING_HEARD : NOTHING_HEARD)); setTalkState('idle'); return }
    setTalkState('thinking')
    const reply = await sendText(said, { voice: true })
    if (!talkRef.current) return
    if (!reply) { setTalkState('idle'); return }
    setTalkReply(reply)
    setTalkState('speaking')
    speakInLoop(reply)
  }

  const listenWithRecorder = () => {
    let rec
    const via = hasOpenAiKey() ? 'OpenAI' : 'ElevenLabs'
    setDiag(`${tx("opname via")} ${via}`)
    let info = ''
    try {
      rec = startRecording({
        onSpeech: () => setHeard('…'),
        onInfo: ({ seconds, peak, bytes }) => {
          info = `${tx("opname via")} ${via} · ${seconds.toFixed(1)} s · ${tx("niveau")} ${peak.toFixed(3)} · ${Math.round(bytes / 1024)} kB`
          setDiag(info)
        },
      })
    } catch {
      setError(tx("Kon de microfoon niet starten."))
      setTalkState('idle')
      return
    }
    wrapUpRef.current = rec.stop
    const handle = { stop: rec.stop, abort: rec.stop }
    recognizerRef.current = handle
    rec.done
      .then(async (blob) => {
        if (recognizerRef.current === handle) recognizerRef.current = null
        if (!talkRef.current) { setTalkState('idle'); return }
        if (!blob) { respond(''); return }
        setTalkState('thinking')
        const said = await transcribe(blob, voiceLang())
        setDiag(`${info} · ${said ? `"${said.slice(0, 60)}"` : tx("lege tekst terug")}`)
        setHeard(said)
        respond(said)
      })
      .catch((e) => { setError(e.message); setDiag(`${info || via} · ${e.message}`); setTalkState('idle') })
  }

  const listen = (stop = true) => {
    if (!talkRef.current) return
    if (stop) stopSpeaking()
    setHeard('')
    setTalkState('listening')
    if (useCloudEars()) { listenWithRecorder(); return }
    setDiag(tx("ingebouwde spraakherkenning"))
    let said = ''
    let done = false
    let silenceTimer = null
    let fallbackTimer = null
    // Runs once per turn, whichever comes first: the recognizer's own end,
    // our silence timer, or a watchdog (iOS sometimes never fires onend).
    const finish = async () => {
      if (done) return
      done = true
      clearTimeout(silenceTimer)
      clearTimeout(fallbackTimer)
      clearTimeout(nothingTimer)
      if (recognizerRef.current === recognizer) {
        recognizerRef.current = null
        try { recognizer.abort() } catch { /* already ended */ }
      }
      respond(said)
    }
    // Ask the recognizer to wrap up, but don't wait on it for long.
    const wrapUp = () => {
      try { recognizer.stop() } catch { /* already ended */ }
      clearTimeout(fallbackTimer)
      fallbackTimer = setTimeout(finish, 1500)
    }
    const recognizer = createSpeechRecognizer({
      lang: voiceLang(),
      onResult: ({ text }) => {
        said = text
        setHeard(text)
        clearTimeout(nothingTimer)
        clearTimeout(silenceTimer)
        silenceTimer = setTimeout(wrapUp, SILENCE_MS)
      },
      onError: (err) => {
        const msg = micErrorText(err)
        if (msg) { done = true; setError(msg); talkRef.current = false; setTalkState('idle'); recognizerRef.current = null }
      },
      onEnd: finish,
    })
    const nothingTimer = setTimeout(wrapUp, NOTHING_HEARD_MS)
    wrapUpRef.current = wrapUp
    recognizerRef.current = recognizer
    try {
      recognizer.start()
    } catch {
      // iOS throws when the previous session hasn't fully let go yet.
      done = true
      clearTimeout(nothingTimer)
      recognizerRef.current = null
      setError(tx("De microfoon was nog bezig. Tik op de coach en probeer het opnieuw."))
      setTalkState('idle')
    }
  }

  // Speak a reply, then listen again — unless nothing could be heard: then
  // stay on the reply with the error, so a tap on the coach can replay it.
  const speakInLoop = (reply) => {
    let silent = false
    unheardRef.current = false
    speak(reply, {
      lang: voiceLang(),
      onError: (e) => { if (e instanceof DeviceSpeechError) { silent = true; unheardRef.current = true } voiceError(e) },
      // iOS: wait for a tap (see IS_IOS) instead of listening on our own.
      onEnd: () => { if (talkRef.current && !silent) { if (IS_IOS) setTalkState('idle'); else listen() } },
    })
  }

  // ---- live conversation (ElevenLabs) ----
  const recordLive = (role, content) => {
    const msg = { role, content, at: Date.now() }
    messagesRef.current = [...messagesRef.current, msg]
    addCoachMessages([msg])
  }

  // Called straight from a tap: the microphone is asked for before any
  // await, which iOS wants; the SDK (loaded only now — it's big) reuses it.
  const startLive = async () => {
    const micAsk = navigator.mediaDevices?.getUserMedia?.({ audio: true })
    setError('')
    setHeard('')
    setTalkReply('')
    setTalkState('thinking')
    setDiag(tx("live via ElevenLabs · verbinden…"))
    const d = dataRef.current
    const recent = messagesRef.current.slice(-HISTORY_FOR_REPLY)
      .map((m) => `${m.role === 'user' ? 'Gebruiker' : 'Coach'}: ${m.content}`).join('\n')
    const language = getSpeechAiLanguage()
    const prompt = buildSystemPrompt(coachSettings.personality, d) + memoryPrompt(d) + SPOKEN_STYLE
      + (recent ? `\n\nRecent conversation, for context:\n${recent}` : '')
      + (language ? `\n\nAlways reply in ${language}.` : '')
    let mic = null
    try {
      mic = await micAsk
      const { startLiveCoach } = await import('../../utils/elevenAgent')
      const conversation = await startLiveCoach({
        prompt,
        firstMessage: tx("Hoi! Ik luister, zeg het maar."),
        lang: voiceLang(),
        speed: getSpeechRate(),
        onMode: (mode) => { if (talkRef.current) setTalkState(mode === 'speaking' ? 'speaking' : 'listening') },
        onUserText: (text) => { setHeard(text); recordLive('user', text) },
        onAgentText: (text) => { setTalkReply(text); recordLive('assistant', text) },
        onEnd: (reason) => {
          liveRef.current = null
          if (!talkRef.current) return
          if (reason) setError(reason)
          setTalkState('idle')
          setDiag(tx("live-gesprek beëindigd — tik op de coach om opnieuw te beginnen"))
        },
        onError: (message) => setDiag(`${tx("live via ElevenLabs")} · ${message}`),
      })
      if (!talkRef.current) { conversation.endSession(); return }
      liveRef.current = conversation
      setDiag(tx("live via ElevenLabs"))
      setTalkState('listening')
    } catch (e) {
      const message = e?.name === 'NotAllowedError'
        ? tx("De microfoon is geblokkeerd. Zet hem aan via Instellingen → Safari (of de app) → Microfoon.")
        : e.message
      setError(message)
      setDiag(tx("live via ElevenLabs"))
      setTalkState('idle')
    } finally {
      mic?.getTracks().forEach((t) => t.stop())
    }
  }

  const openTalk = () => {
    if (useLiveCoach()) {
      stopSpeaking()
      talkRef.current = true
      setTalkOpen(true)
      startLive()
      return
    }
    stopSpeaking()
    unlockSpeech()
    setError('')
    talkRef.current = true
    setTalkOpen(true)
    listen(false)
  }
  const closeTalk = () => {
    talkRef.current = false
    liveRef.current?.endSession()
    liveRef.current = null
    recognizerRef.current?.abort()
    recognizerRef.current = null
    stopSpeaking()
    setTalkOpen(false)
    setTalkState('idle')
    updateMemory(true)
  }
  const tapOrb = () => {
    // Live: the conversation runs by itself; a tap only restarts one that ended.
    if (useLiveCoach()) {
      if (!liveRef.current && talkState === 'idle') { talkRef.current = true; startLive() }
      return
    }
    if (talkState === 'listening') wrapUpRef.current?.()
    else if (talkState === 'speaking' || talkState === 'idle') {
      // A reply that couldn't be heard: this tap may play it.
      if (talkState === 'speaking' && unheardRef.current && talkReply) {
        setError('')
        stopSpeaking()
        unlockSpeech()
        speakInLoop(talkReply)
        return
      }
      setError('')
      stopSpeaking()
      unlockSpeech()
      talkRef.current = true
      listen(false)
    }
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

  // No key yet: paste it right here (with where to find it) — as soon as
  // it's in, the chat and the talk button appear.
  if (!keyPresent) {
    return (
      <div className="page">
        {header}
        <Bubble role="assistant">{t('coach.noKey')}</Bubble>
        <div className="card stack" style={{ marginTop: 16, gap: 10 }}>
          <label style={{ fontWeight: 700, fontSize: 14 }}>{tx("Plak hier je Claude-sleutel")}</label>
          <input
            className="input"
            type="password"
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => { const k = e.target.value.trim(); if (/^sk-ant-/.test(k) && k.length > 30) { setApiKey(k); setKeyTick((n) => n + 1) } }}
          />
          <div className="text-sm muted">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{tx("Waar vind ik die?")}</div>
            <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
              <li>{tx("Ga naar console.anthropic.com en log in.")}</li>
              <li>{tx("Klik links op API Keys → Create Key.")}</li>
              <li>{tx("Kopieer de sleutel (begint met sk-ant-) en plak hem hierboven.")}</li>
            </ol>
            <div style={{ marginTop: 6 }}>{tx("Ben je ingelogd bij Cloud Sync, dan wordt hij versleuteld bewaard en staat hij ook op je andere apparaten.")}</div>
          </div>
        </div>
        {avatarSheet}
      </div>
    )
  }

  const quickAsk = (text) => { setInput(''); sendText(text) }
  // A coach with a face (preset person or own photo): shown waist-up in a
  // glass arch above the chat; tapping it starts a spoken conversation.
  // It can't move its lips, so it breathes and glows (motion.css .coach-arch).
  const face = coachImage(data.settings.coachAvatar)
  const canTalk = CAN_LISTEN || cloudEarsAvailable()
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
            onClick={canTalk ? openTalk : undefined}
            label={t('coach.talk')}
          />
          {canTalk && <div className="text-sm muted">{coachName(data) ? `${tx("Tik op")} ${coachName(data)} ${tx("om te praten")}` : tx("Tik op je coach om te praten")}</div>}
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
          {canTalk && (
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
        diag={`${diag ? `${diag} · ` : ''}${IS_IOS ? 'iOS · ' : ''}${tx("versie")} ${__BUILD_ID__}`}
        tapToFinish={!useLiveCoach() && useCloudEars()}
        live={useLiveCoach()}
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
