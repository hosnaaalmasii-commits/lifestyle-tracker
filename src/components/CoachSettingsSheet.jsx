import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { coachImage } from '../utils/coachAvatar'
import { coachName } from '../utils/coachMemory'
import Sheet from './Sheet'
import Icon from './Icon'
import CoachAvatarPicker from './CoachAvatarPicker'
import CoachVoicePicker from './CoachVoicePicker'
import { getReadAloud, setReadAloud, stopSpeaking, unlockSpeech } from '../utils/speechOutput'
import { tx } from '../i18n/tx'
import { getApiKey, setApiKey } from '../utils/claudeApi'

// Everything about the coach in one place (Coach page → gear or face):
// face + name, voice, and memory — what it remembers about you, with
// per-fact delete, "clear conversation" and "forget everything".
export default function CoachSettingsSheet({ open, onClose }) {
  const { data, setCoachName, deleteCoachMemoryItem, clearCoachConversation, forgetCoachEverything } = useApp()
  const [tab, setTab] = useState('face')
  const [confirm, setConfirm] = useState(null) // 'chat' | 'all'
  const [readAloud, setReadAloudState] = useState(getReadAloud)
  const [claudeKey, setClaudeKey] = useState(getApiKey)
  const saveClaudeKey = (v) => { const k = v.trim(); setClaudeKey(k); setApiKey(k) }
  const [showClaudeKey, setShowClaudeKey] = useState(false)
  const toggleReadAloud = () => {
    const next = !readAloud
    setReadAloudState(next)
    setReadAloud(next)
    if (next) unlockSpeech()
    else stopSpeaking()
  }
  const presetName = coachImage(data.settings.coachAvatar)?.name
  const facts = data.coach?.memory || []
  const msgCount = data.coach?.messages?.length || 0
  const name = coachName(data)

  const tabs = [
    { id: 'face', label: tx("Gezicht & naam") },
    { id: 'voice', label: tx("Stem") },
    { id: 'memory', label: `${tx("Geheugen")}${facts.length ? ` (${facts.length})` : ''}` },
  ]

  return (
    <Sheet open={open} onClose={() => { setConfirm(null); onClose() }} title={name ? `${tx("Coach instellen")} — ${name}` : tx("Coach instellen")}>
      {/* The key that makes the coach talk at all — keys stay on this device. */}
      <div className="field" style={{ marginBottom: 14 }}>
        <label>{tx("Claude-sleutel (om met je coach te praten)")}</label>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 0 }}
            type={showClaudeKey ? 'text' : 'password'}
            placeholder="sk-ant-…"
            value={claudeKey}
            onChange={(e) => saveClaudeKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowClaudeKey((x) => !x)}>{showClaudeKey ? tx("Hide") : tx("Show")}</button>
        </div>
        <p className="text-sm" style={{ margin: '6px 0 0', color: claudeKey ? 'var(--success)' : 'var(--text-soft)' }}>
          {claudeKey ? `✓ ${tx("Opgeslagen")}` : tx("Maak een sleutel op console.anthropic.com → API Keys en plak hem hier.")}
        </p>
      </div>

      <div className="scroll-x" style={{ marginBottom: 14 }}>
        {tabs.map((x) => (
          <button key={x.id} type="button" className={`chip${tab === x.id ? ' selected' : ''}`} onClick={() => setTab(x.id)}>{x.label}</button>
        ))}
      </div>

      {tab === 'face' && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{tx("Naam van je coach")}</label>
            <input
              className="input"
              value={data.settings.coachName || ''}
              placeholder={presetName || tx("bv. Sofie")}
              onChange={(e) => setCoachName(e.target.value)}
              maxLength={30}
            />
            <p className="text-sm faint" style={{ margin: '6px 0 0' }}>{tx("Leeg laten = de naam die bij het gezicht hoort. Je coach stelt zich met deze naam voor.")}</p>
          </div>
          <CoachAvatarPicker />
        </div>
      )}

      {tab === 'voice' && (
        <div className="stack" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{tx("Antwoorden voorlezen")}</div>
              <div className="text-sm faint">{tx("Ook als je typt. Als je praat, praat je coach altijd terug.")}</div>
            </div>
            <button type="button" className={`chip${readAloud ? ' selected' : ''}`} onClick={toggleReadAloud} aria-pressed={readAloud}>
              {readAloud ? tx("Aan") : tx("Uit")}
            </button>
          </div>
          <CoachVoicePicker />
        </div>
      )}

      {tab === 'memory' && (
        <div className="stack" style={{ gap: 12 }}>
          <p className="text-sm muted" style={{ margin: 0 }}>
            {tx("Je coach onthoudt jullie gesprekken en leert je zo steeds beter kennen. Hij kent ook alles wat je in de app invult: je plan, eten, water, slaap, training, stemming, gewicht, notities en je vooruitgang. Dit wordt gesynchroniseerd, dus op al je apparaten weet je coach hetzelfde.")}
          </p>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{tx("Wat je coach over je weet")}</div>
          {facts.length ? (
            <div className="card" style={{ padding: '4px 12px' }}>
              {facts.map((f, i) => (
                <div key={f.id} className="row" style={{ gap: 10, padding: '9px 0', borderTop: i ? '1px solid var(--border-soft)' : 'none', alignItems: 'flex-start' }}>
                  <span className="text-sm" style={{ flex: 1 }}>{f.text}</span>
                  <button
                    type="button"
                    onClick={() => deleteCoachMemoryItem(f.id)}
                    aria-label={tx("Vergeet dit")}
                    title={tx("Vergeet dit")}
                    style={{ background: 'none', border: 'none', color: 'var(--text-soft)', cursor: 'pointer', padding: 2, flexShrink: 0 }}
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm faint" style={{ margin: 0 }}>{tx("Nog niets — na een paar berichten begint je coach dingen over je te onthouden.")}</p>
          )}

          <div className="text-sm faint">{msgCount} {tx("berichten bewaard")}</div>

          {confirm ? (
            <div className="card stack" style={{ gap: 8, border: '1px solid color-mix(in srgb, var(--danger) 50%, transparent)' }}>
              <div className="text-sm" style={{ fontWeight: 600 }}>
                {confirm === 'chat'
                  ? tx("Het hele gesprek wissen? Wat je coach over je weet blijft bewaard.")
                  : tx("Alles vergeten? Het gesprek én alles wat je coach over je weet wordt gewist. Je ingevulde gegevens (eten, slaap, …) blijven.")}
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(null)}>{tx("Annuleren")}</button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ background: 'var(--danger)' }}
                  onClick={() => { if (confirm === 'chat') clearCoachConversation(); else forgetCoachEverything(); setConfirm(null) }}
                >
                  {confirm === 'chat' ? tx("Ja, gesprek wissen") : tx("Ja, alles vergeten")}
                </button>
              </div>
            </div>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              <button type="button" className="btn btn-secondary btn-block" disabled={!msgCount} onClick={() => setConfirm('chat')}>{tx("Gesprek wissen")}</button>
              <button type="button" className="btn btn-ghost btn-block" style={{ color: 'var(--danger)' }} disabled={!msgCount && !facts.length} onClick={() => setConfirm('all')}>{tx("Alles vergeten")}</button>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
