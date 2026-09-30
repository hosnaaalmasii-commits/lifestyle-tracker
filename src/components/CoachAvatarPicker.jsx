import { useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { COACH_PRESETS, photoFromFile, PORTRAIT_PROMPT } from '../utils/coachAvatar'
import CoachPortrait from './CoachPortrait'
import { ORB_BACKGROUND } from './CoachAvatar'
import { tx } from '../i18n/tx'

// Choose the coach: one of the preset people, your own photo, or the orb.
export default function CoachAvatarPicker() {
  const { data, setCoachAvatar } = useApp()
  const current = data.settings.coachAvatar || null
  const fileRef = useRef(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    try {
      setCoachAvatar({ type: 'photo', image: await photoFromFile(file) })
    } catch (err) {
      setError(err.message)
    }
  }
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(PORTRAIT_PROMPT)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard not allowed — the text is selectable */ }
  }

  const tile = (key, selected, onClick, body, label) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 6px 8px', cursor: 'pointer',
        borderRadius: 18, background: selected ? 'color-mix(in srgb, var(--accent) 16%, var(--surface))' : 'var(--surface)', color: 'var(--text)',
        border: selected ? '2px solid var(--accent)' : '1px solid var(--border-soft)',
      }}
    >
      {body}
      <span style={{ fontWeight: 700, fontSize: 13 }}>{label}</span>
    </button>
  )

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 }}>
        {COACH_PRESETS.map((p) => tile(
          p.id,
          current?.type === 'preset' && current.id === p.id,
          () => setCoachAvatar({ type: 'preset', id: p.id }),
          <CoachPortrait avatar={{ type: 'preset', id: p.id }} width={76} />,
          p.name,
        ))}
        {current?.type === 'photo' && tile('own', true, () => {}, <CoachPortrait avatar={current} width={76} />, tx("Eigen foto"))}
        {tile('orb', !current, () => setCoachAvatar(null),
          <span style={{ width: 76, height: 99, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ width: 52, height: 52, borderRadius: '50%', background: ORB_BACKGROUND, boxShadow: '0 0 20px color-mix(in srgb, var(--accent) 50%, transparent)' }} />
          </span>,
          tx("Bol"))}
      </div>

      <button type="button" className="btn btn-secondary btn-block" onClick={() => fileRef.current?.click()}>
        {current?.type === 'photo' ? tx("Andere eigen foto kiezen") : tx("Eigen foto uploaden")}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
      {error && <p className="text-sm" style={{ margin: 0, color: 'var(--danger)' }}>{error}</p>}

      <details>
        <summary className="text-sm muted" style={{ cursor: 'pointer' }}>{tx("Zelf een coach maken met een gratis AI-beeldmaker")}</summary>
        <div className="stack" style={{ gap: 8, paddingTop: 8 }}>
          <p className="text-sm muted" style={{ margin: 0 }}>
            {tx("Plak deze opdracht in ChatGPT, Microsoft Copilot of Google Gemini (gratis), pas hem aan naar wens (man of vrouw, leeftijd, haar) en upload het beeld hierboven. Gebruik geen foto van een echt persoon zonder diens toestemming.")}
          </p>
          <p className="text-sm" style={{ margin: 0, fontStyle: 'italic', userSelect: 'all' }}>{PORTRAIT_PROMPT}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyPrompt}>{copied ? tx("Gekopieerd") : tx("Kopieer opdracht")}</button>
        </div>
      </details>
      <p className="text-sm faint" style={{ margin: 0 }}>{tx("Coaches: AI-gegenereerde beelden van Pixabay, gratis te gebruiken — geen bestaande personen.")}</p>
    </div>
  )
}
