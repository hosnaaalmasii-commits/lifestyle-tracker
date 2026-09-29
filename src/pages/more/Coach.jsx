import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { hasApiKey, sendToClaude, getCoachSettings, ClaudeApiError } from '../../utils/claudeApi'
import { buildSystemPrompt } from '../../utils/coachContext'
import DayReplanSheet from '../../components/DayReplanSheet'
import { useT } from '../../i18n/useT'

const CHAT_STORAGE = 'lifestyle-tracker-coach-chat'
export const COACH_PREFILL = 'lifestyle-tracker-coach-prefill'

function loadChat() {
  try { return JSON.parse(localStorage.getItem(CHAT_STORAGE) || '[]') } catch { return [] }
}
function saveChat(messages) {
  localStorage.setItem(CHAT_STORAGE, JSON.stringify(messages.slice(-30)))
}

// Chat layout after the Richting E Figma mockup: glowing coach orb,
// bubbles, quick-reply pills and a pill input pinned above the tab bar.
// The coach's personality is picked in Settings → AI Coach.
export default function Coach({ setView }) {
  const { data } = useApp()
  const { t } = useT()
  const coachSettings = getCoachSettings()
  const [messages, setMessages] = useState(loadChat)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [replanOpen, setReplanOpen] = useState(false)
  const scrollRef = useRef(null)

  const keyPresent = hasApiKey()

  useEffect(() => { saveChat(messages) }, [messages])
  // A message handed over from the Vandaag voice sheet ("Praat met de
  // coach") — sent once, then cleared.
  useEffect(() => {
    const prefill = sessionStorage.getItem(COACH_PREFILL)
    if (prefill === null) return
    sessionStorage.removeItem(COACH_PREFILL)
    if (prefill.trim() && keyPresent) sendText(prefill)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const send = () => sendText(input)

  const sendText = async (raw) => {
    const text = raw.trim()
    if (!text || sending) return
    setInput('')
    setError('')
    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setSending(true)
    try {
      const system = buildSystemPrompt(coachSettings.personality, data)
      const reply = await sendToClaude({
        system,
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        maxTokens: 700,
      })
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setError(e instanceof ClaudeApiError ? e.message : 'Something went wrong sending that.')
    } finally {
      setSending(false)
    }
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

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - var(--tabbar-height) - 40px)' }}>
      {header}

      <div ref={scrollRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0 14px' }}>
        {messages.length === 0 && (
          <Bubble role="assistant">{t('coach.hello')}</Bubble>
        )}
        {messages.map((m, i) => <Bubble key={i} role={m.role}>{m.content}</Bubble>)}
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
          <button className="btn btn-primary btn-sm" disabled={sending || !input.trim()} onClick={send}>{t('coach.send')}</button>
        </div>
      </div>

      <DayReplanSheet open={replanOpen} onClose={() => setReplanOpen(false)} />
    </div>
  )
}

function Bubble({ role, children }) {
  const mine = role === 'user'
  return (
    <div
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: mine ? '78%' : '86%',
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
  )
}
