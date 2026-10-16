import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { coachImage } from '../utils/coachAvatar'
import { coachName } from '../utils/coachMemory'
import Sheet from './Sheet'
import Icon from './Icon'
import CoachAvatarPicker from './CoachAvatarPicker'
import CoachVoicePicker from './CoachVoicePicker'
import CoachKeysPanel from './CoachKeysPanel'
import { getReadAloud, setReadAloud, stopSpeaking, unlockSpeech, getVoiceProvider } from '../utils/speechOutput'
import { beginSecretDraft, commitSecretDraft, discardSecretDraft } from '../utils/secretSync'
import { tx } from '../i18n/tx'

// The per-device settings this sheet can change (voice, speed, language,
// keys…). They're written as you pick — so "Beluister" plays exactly what
// you chose — but a snapshot taken on opening is put back unless you tap
// Opslaan. Keys only go to the account (secretSync) on Opslaan.
const DEVICE_KEYS = [
  'lifestyle-tracker-anthropic-key',
  'lifestyle-tracker-openai-key',
  'lifestyle-tracker-elevenlabs-key',
  'lifestyle-tracker-coach-voice-provider',
  'lifestyle-tracker-coach-voice',
  'lifestyle-tracker-coach-rate',
  'lifestyle-tracker-coach-speak',
  'lifestyle-tracker-speech-lang',
  'lifestyle-tracker-openai-voice',
  'lifestyle-tracker-openai-live-model',
  'lifestyle-tracker-elevenlabs-voice',
  'lifestyle-tracker-elevenlabs-model',
]
function snapshot() {
  const out = {}
  DEVICE_KEYS.forEach((k) => { try { out[k] = localStorage.getItem(k) } catch { out[k] = null } })
  return out
}
function restore(snap) {
  Object.entries(snap).forEach(([k, v]) => {
    try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* private mode */ }
  })
}
function sameAs(snap) {
  return DEVICE_KEYS.every((k) => { try { return localStorage.getItem(k) === snap[k] } catch { return true } })
}

// Everything about the coach in one place (Coach page → tap the coach):
// face + name, voice, keys & costs, and memory. One Opslaan button keeps
// it all; Annuleren (or closing) puts everything back.
export default function CoachSettingsSheet({ open, onClose, initialTab = 'face' }) {
  const { data, setCoachName, setCoachAvatar, deleteCoachMemoryItem, clearCoachConversation, forgetCoachEverything } = useApp()
  const [tab, setTab] = useState(initialTab)
  const [confirm, setConfirm] = useState(null) // 'chat' | 'all'
  const [closing, setClosing] = useState(false) // asking "save changes?"
  const [savedFlash, setSavedFlash] = useState(false)
  const [, setTick] = useState(0)
  const snapRef = useRef(null)
  const [draftName, setDraftName] = useState('')
  const [draftAvatar, setDraftAvatar] = useState(null)
  const [readAloud, setReadAloudState] = useState(getReadAloud)
  const [provider, setProvider] = useState(getVoiceProvider)

  // Opening: remember how things were, start holding key uploads.
  useEffect(() => {
    if (!open) return
    snapRef.current = snapshot()
    beginSecretDraft()
    setDraftName(data.settings.coachName || '')
    setDraftAvatar(data.settings.coachAvatar || null)
    setReadAloudState(getReadAloud())
    setProvider(getVoiceProvider())
    setTab(initialTab)
    setClosing(false)
    setConfirm(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const dirty = open && snapRef.current && (
    !sameAs(snapRef.current)
    || draftName !== (data.settings.coachName || '')
    || JSON.stringify(draftAvatar) !== JSON.stringify(data.settings.coachAvatar || null)
  )

  const save = () => {
    commitSecretDraft()
    if (draftName !== (data.settings.coachName || '')) setCoachName(draftName)
    if (JSON.stringify(draftAvatar) !== JSON.stringify(data.settings.coachAvatar || null)) setCoachAvatar(draftAvatar)
    snapRef.current = snapshot()
    setSavedFlash(true)
    setTimeout(() => { setSavedFlash(false); onClose() }, 700)
  }
  const discard = () => {
    stopSpeaking()
    if (snapRef.current) restore(snapRef.current)
    discardSecretDraft()
    onClose()
  }
  const requestClose = () => {
    if (dirty) setClosing(true)
    else { discardSecretDraft(); onClose() }
  }

  const toggleReadAloud = () => {
    const next = !readAloud
    setReadAloudState(next)
    setReadAloud(next)
    if (next) unlockSpeech()
    else stopSpeaking()
  }
  const presetName = coachImage(draftAvatar)?.name
  const facts = data.coach?.memory || []
  const msgCount = data.coach?.messages?.length || 0
  const name = coachName(data)

  const tabs = [
    { id: 'face', label: tx("Gezicht & naam") },
    { id: 'voice', label: tx("Stem") },
    { id: 'keys', label: tx("Sleutels & kosten") },
    { id: 'memory', label: `${tx("Geheugen")}${facts.length ? ` (${facts.length})` : ''}` },
  ]

  return (
    <Sheet open={open} onClose={requestClose} title={name ? `${tx("Coach instellen")} — ${name}` : tx("Coach instellen")}>
      {/* Any click or edit inside may have changed a setting: re-check "dirty". */}
      <div onClickCapture={() => setTimeout(() => setTick((n) => n + 1), 0)} onChangeCapture={() => setTimeout(() => setTick((n) => n + 1), 0)}>
        <div className="scroll-x" style={{ marginBottom: 16 }}>
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
                value={draftName}
                placeholder={presetName || tx("bv. Sofie")}
                onChange={(e) => setDraftName(e.target.value)}
                maxLength={30}
              />
              <p className="text-sm faint" style={{ margin: '6px 0 0' }}>{tx("Leeg laten = de naam die bij het gezicht hoort.")}</p>
            </div>
            <CoachAvatarPicker value={draftAvatar} onChange={setDraftAvatar} />
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
            <CoachVoicePicker onNeedKey={() => setTab('keys')} onProviderChange={setProvider} />
          </div>
        )}

        {tab === 'keys' && <CoachKeysPanel provider={provider} />}

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

            <div className="text-sm faint">{msgCount} {tx("berichten bewaard")} · {tx("wissen gebeurt meteen, los van Opslaan")}</div>

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

        {/* Save bar, always visible at the bottom of the sheet. */}
        <div
          style={{
            position: 'sticky', bottom: 'calc(-24px - var(--safe-bottom))', margin: '20px -20px calc(-24px - var(--safe-bottom))',
            padding: '12px 20px calc(14px + var(--safe-bottom))', background: 'var(--surface)',
            borderTop: '1px solid var(--border-soft)', zIndex: 2,
          }}
        >
          {savedFlash ? (
            <div className="row" style={{ justifyContent: 'center', gap: 8, color: 'var(--success)', fontWeight: 700, padding: '10px 0' }}>
              <Icon name="check" size={18} />{tx("Opgeslagen")}
            </div>
          ) : closing ? (
            <div className="stack" style={{ gap: 8 }}>
              <div className="text-sm" style={{ fontWeight: 600, textAlign: 'center' }}>{tx("Je wijzigingen zijn nog niet opgeslagen.")}</div>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={discard}>{tx("Niet opslaan")}</button>
                <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={save}>{tx("Opslaan")}</button>
              </div>
            </div>
          ) : (
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={dirty ? discard : requestClose}>
                {dirty ? tx("Annuleren") : tx("Sluiten")}
              </button>
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={!dirty} onClick={save}>{tx("Opslaan")}</button>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  )
}
