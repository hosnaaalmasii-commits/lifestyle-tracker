import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { hasApiKey, sendToClaude, getCoachSettings, ClaudeApiError } from '../../utils/claudeApi'
import { buildSystemPrompt } from '../../utils/coachContext'
import DayReplanSheet from '../../components/DayReplanSheet'

const CHAT_STORAGE = 'lifestyle-tracker-coach-chat'

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
  const coachSettings = getCoachSettings()
  const [messages, setMessages] = useState(loadChat)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [replanOpen, setReplanOpen] = useState(false)
  const scrollRef = useRef(null)

  const keyPresent = hasApiKey()

  useEffect(() => { saveChat(messages) }, [messages])
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
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>Je coach</div>
        <div className="text-sm faint">Kent je schema, voeding en slaap</div>
      </div>
    </div>
  )

  if (!keyPresent) {
    return (
      <div className="page">
        {header}
        <Bubble role="assistant">Hoi! Om met mij te kunnen praten heb je een Claude API-key nodig. Die vul je één keer in bij Instellingen.</Bubble>
        <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setView('settings')}>Naar Instellingen</button>
      </div>
    )
  }

  const quickAsk = (text) => { setInput(''); sendText(text) }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - var(--tabbar-height) - 40px)' }}>
      {header}

      <div ref={scrollRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0 14px' }}>
        {messages.length === 0 && (
          <Bubble role="assistant">Hoi! Vraag me alles over je dag, je voeding of je training. Ik ken je schema, je voorraad en hoe je slaapt.</Bubble>
        )}
        {messages.map((m, i) => <Bubble key={i} role={m.role}>{m.content}</Bubble>)}
        {sending && <div className="text-sm faint" style={{ padding: '2px 6px' }}>Coach denkt na…</div>}
      </div>

      {error && <div className="text-sm" style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div>}

      <div
        style={{
          position: 'sticky', bottom: 'calc(var(--tabbar-height) + var(--safe-bottom) + 12px)',
          paddingTop: 8,
        }}
      >
        <div className="scroll-x" style={{ marginBottom: 10 }}>
          <button className="chip" onClick={() => setReplanOpen(true)}>Pas mijn dag aan</button>
          <button className="chip" onClick={() => quickAsk('Wat is vandaag mijn belangrijkste focus?')}>Mijn focus vandaag</button>
          <button className="chip" onClick={() => quickAsk('Hoe gaat mijn week tot nu toe?')}>Hoe gaat mijn week?</button>
          <button className="chip" onClick={() => quickAsk('Welke snack past vandaag bij mijn doel en wat ik in huis heb?')}>Snack-idee</button>
        </div>
        <div
          className="row"
          style={{ gap: 8, padding: '5px 5px 5px 18px', borderRadius: 999, background: 'var(--surface)', border: '1.2px solid color-mix(in srgb, var(--accent) 55%, transparent)' }}
        >
          <input
            style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 14.5 }}
            placeholder="Typ of spreek je bericht…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send() }}
          />
          <button className="btn btn-primary btn-sm" disabled={sending || !input.trim()} onClick={send}>Stuur</button>
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
