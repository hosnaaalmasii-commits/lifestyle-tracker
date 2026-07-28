import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey } from '../../utils/dates'
import { hasApiKey, sendToClaude, getCoachSettings, setCoachSettings, ClaudeApiError } from '../../utils/claudeApi'
import { PERSONALITIES, getPersonality, buildSystemPrompt } from '../../utils/coachContext'
import BackHeader from '../../components/BackHeader'

const CHAT_STORAGE = 'lifestyle-tracker-coach-chat'
const NOTE_STORAGE_PREFIX = 'lifestyle-tracker-daily-note-'

function loadChat() {
  try { return JSON.parse(localStorage.getItem(CHAT_STORAGE) || '[]') } catch { return [] }
}
function saveChat(messages) {
  localStorage.setItem(CHAT_STORAGE, JSON.stringify(messages.slice(-30)))
}
function loadTodayNote() {
  try { return JSON.parse(localStorage.getItem(NOTE_STORAGE_PREFIX + todayKey()) || 'null') } catch { return null }
}

export default function Coach({ onBack, setView }) {
  const { data } = useApp()
  const [coachSettings, setCoachSettingsState] = useState(getCoachSettings())
  const [messages, setMessages] = useState(loadChat)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState(loadTodayNote)
  const [noteLoading, setNoteLoading] = useState(false)
  const scrollRef = useRef(null)

  const keyPresent = hasApiKey()

  useEffect(() => { saveChat(messages) }, [messages])
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, sending])

  const personality = getPersonality(coachSettings.personality)

  const changePersonality = (id) => {
    const next = setCoachSettings({ personality: id })
    setCoachSettingsState(next)
  }

  const generateNote = async () => {
    setNoteLoading(true)
    setError('')
    try {
      const system = buildSystemPrompt(coachSettings.personality, data)
      const text = await sendToClaude({
        system,
        messages: [{ role: 'user', content: 'Write today\'s focus note: 2-3 sentences on what matters most today given my data snapshot. No greeting, no sign-off, just the note itself.' }],
        maxTokens: 220,
      })
      const entry = { text, generatedAt: Date.now() }
      localStorage.setItem(NOTE_STORAGE_PREFIX + todayKey(), JSON.stringify(entry))
      setNote(entry)
    } catch (e) {
      setError(e instanceof ClaudeApiError ? e.message : 'Something went wrong generating your note.')
    } finally {
      setNoteLoading(false)
    }
  }

  const send = async () => {
    const text = input.trim()
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

  const clearChat = () => {
    setMessages([])
    localStorage.removeItem(CHAT_STORAGE)
  }

  if (!keyPresent) {
    return (
      <div className="page">
        <BackHeader eyebrow="More" title="Coach" onBack={onBack} />
        <div className="empty-state">
          <div className="icon">✨</div>
          <p>Connect your own Claude API key to talk to an AI coach that knows your actual data — nothing is sent anywhere until you add a key.</p>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setView('settings')}>Set up in Settings</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 40px)' }}>
      <BackHeader
        eyebrow="More"
        title="Coach"
        onBack={onBack}
        action={<button className="btn btn-ghost btn-sm" onClick={() => setView('settings')}>⚙️</button>}
      />

      <div className="scroll-x" style={{ marginBottom: 16 }}>
        {PERSONALITIES.map((p) => (
          <button
            key={p.id}
            className={`chip${p.id === coachSettings.personality ? ' selected' : ''}`}
            onClick={() => changePersonality(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {!note ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row">
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Today's focus</div>
              <div className="text-sm faint">A short AI note grounded in your data</div>
            </div>
            <button className="btn btn-secondary btn-sm" disabled={noteLoading} onClick={generateNote}>
              {noteLoading ? 'Thinking…' : 'Generate'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card hero-card" style={{ marginBottom: 16, '--hero-tint': 'var(--accent)', '--hero-glow': 'var(--accent-gradient-end)' }}>
          <div className="tag" style={{ background: 'transparent', color: 'var(--accent)', padding: 0, marginBottom: 8 }}>Today's focus · {personality.label}</div>
          <p style={{ margin: 0, lineHeight: 1.55 }}>{note.text}</p>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, padding: '4px 0' }} disabled={noteLoading} onClick={generateNote}>
            {noteLoading ? 'Thinking…' : 'Regenerate'}
          </button>
        </div>
      )}

      <div className="row" style={{ marginBottom: 4 }}>
        <div className="section-title" style={{ margin: 0 }}>Chat</div>
        {messages.length > 0 && <button className="btn btn-ghost btn-sm" onClick={clearChat}>Clear</button>}
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0 12px' }}>
        {messages.length === 0 && (
          <p className="muted text-sm" style={{ padding: '8px 0' }}>
            Ask anything — "how's my week going", "I feel stressed, what should I do", "plan me a light day."
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: m.role === 'user' ? 'var(--accent-fill)' : 'var(--surface-soft)',
              color: m.role === 'user' ? '#fff' : 'var(--text)',
              padding: '10px 14px',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              fontSize: 14.5,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div style={{ alignSelf: 'flex-start', color: 'var(--text-faint)', fontSize: 13, padding: '4px 6px' }}>Coach is thinking…</div>
        )}
      </div>

      {error && <div className="text-sm" style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div>}

      <div className="row" style={{ gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Message your coach…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
        />
        <button className="btn btn-primary" disabled={sending || !input.trim()} onClick={send}>Send</button>
      </div>
    </div>
  )
}
