import { useEffect, useState } from 'react'
import { getApiKey, setApiKey } from '../utils/claudeApi'
import { getOpenAiKey, setOpenAiKey } from '../utils/openaiTts'
import { getElevenKey, setElevenKey } from '../utils/elevenLabs'
import { getVoiceProvider } from '../utils/speechOutput'
import { getLiveModel } from '../utils/openaiRealtime'
import { isSecretSyncActive, isSecretSynced, onSyncedSecretsChanged } from '../utils/secretSync'
import { getUsage, onUsageChanged } from '../utils/usageGuard'
import { tx } from '../i18n/tx'

// All the coach's keys in one place, each with where it's kept, and a plain
// overview of which service is used for what (and what it costs).
// Key fields save right away — on this device and (signed in) to the
// account — and closing the sheet never puts an old key back.
const KEYS = [
  {
    id: 'anthropic', name: 'Claude (Anthropic)', placeholder: 'sk-ant-…', get: getApiKey, set: setApiKey,
    how: 'console.anthropic.com → API Keys → Create Key. Nodig om met je coach te chatten.',
  },
  {
    id: 'openai', name: 'OpenAI', placeholder: 'sk-…', get: getOpenAiKey, set: setOpenAiKey,
    how: 'platform.openai.com → zet tegoed op je account (Billing, vanaf $5) → API keys. Alleen nodig als je coach met OpenAI praat.',
  },
  {
    id: 'elevenlabs', name: 'ElevenLabs', placeholder: 'sk_…', get: getElevenKey, set: setElevenKey,
    how: 'elevenlabs.io → je profiel → API Keys, met rechten voor Text to Speech, Voices en Conversational AI (Agents). Alleen nodig als je coach met ElevenLabs praat.',
  },
]

export default function CoachKeysPanel({ provider = getVoiceProvider() }) {
  const [, setTick] = useState(0)
  useEffect(() => onSyncedSecretsChanged(() => setTick((n) => n + 1)), [])
  useEffect(() => onUsageChanged(() => setTick((n) => n + 1)), [])
  const usage = getUsage()
  const syncOn = isSecretSyncActive()

  return (
    <div className="stack" style={{ gap: 16 }}>
      {!syncOn && (
        <p className="text-sm" style={{ margin: 0, padding: '10px 12px', borderRadius: 12, background: 'color-mix(in srgb, var(--warning, #f5a524) 14%, transparent)' }}>
          {tx("Je bent niet ingelogd bij Cloud Sync. Je sleutels staan dan alleen op dit toestel, en een iPhone kan die na een tijd wissen. Log in via Instellingen → Cloud Sync, dan worden ze versleuteld in je account bewaard en komen ze vanzelf terug.")}
        </p>
      )}

      {KEYS.map((k) => <KeyRow key={k.id} k={k} syncOn={syncOn} />)}

      <div className="stack" style={{ gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{tx("Wat gebruikt wat")}</div>
        <div className="card" style={{ padding: '4px 14px' }}>
          {usageRows(provider).map((r, i) => (
            <div key={r.what} style={{ padding: '10px 0', borderTop: i ? '1px solid var(--border-soft)' : 'none' }}>
              <div className="row" style={{ gap: 8, justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{tx(r.what)}</span>
                <span className="text-sm" style={{ color: 'var(--accent)', fontWeight: 700, textAlign: 'right' }}>{r.service}</span>
              </div>
              <div className="text-sm faint">{tx(r.cost)}</div>
            </div>
          ))}
        </div>
        <div className="text-sm muted">
          {tx("Deze maand op dit toestel")}: Claude ${usage.claudeUsd.toFixed(2)} · OpenAI-stemmen ${usage.openaiUsd.toFixed(2)} · ElevenLabs {Math.round(usage.elevenChars).toLocaleString('nl-NL')} {tx("tekens")}.
          {' '}{tx("Live-gesprekken zie je in je eigen OpenAI- of ElevenLabs-overzicht. Limieten stel je in bij Instellingen → Kostenlimieten.")}
        </div>
      </div>
    </div>
  )
}

function usageRows(provider) {
  const talk = {
    device: { service: 'Claude + stem van je toestel', cost: 'Claude per antwoord (een fractie van een cent); de stem is gratis.' },
    openai: { service: `OpenAI live (${getLiveModel()})`, cost: 'OpenAI hoort, denkt en praat zelf — ongeveer 3–8 cent per minuut (snel) of 10–25 cent (slimste).' },
    elevenlabs: { service: 'ElevenLabs live', cost: 'Gaat van je ElevenLabs-tegoed (minuten van je abonnement); het denkwerk doet ElevenLabs zelf, niet je Claude-sleutel.' },
  }[provider] || { service: 'Claude + stem van je toestel', cost: '' }
  const readAloud = {
    device: { service: 'Stem van je toestel', cost: 'Gratis.' },
    openai: { service: 'OpenAI-stem', cost: 'Ongeveer 1,5 cent per minuut voorlezen.' },
    elevenlabs: { service: 'ElevenLabs-stem', cost: 'Gaat van je ElevenLabs-tegoed (tekens).' },
  }[provider] || { service: 'Stem van je toestel', cost: 'Gratis.' }
  return [
    { what: 'Typen met je coach', service: 'Claude', cost: 'Per bericht, meestal minder dan een cent.' },
    { what: 'Praten met je coach', ...talk },
    { what: 'Antwoorden voorlezen', ...readAloud },
    { what: 'Geheugen van je coach', service: 'Claude Haiku', cost: 'Af en toe een kleine, goedkope aanvraag.' },
    { what: 'Inspreken op Vandaag, vertalingen, dagplanning', service: 'Claude', cost: 'Alleen als je het gebruikt.' },
  ]
}

function KeyRow({ k, syncOn }) {
  const [value, setValue] = useState(k.get)
  const [show, setShow] = useState(false)
  const saved = k.get()
  const inAccount = isSecretSynced(k.id) && !!saved
  const status = !value
    ? { color: 'var(--text-soft)', text: tx("Nog geen sleutel.") }
    : inAccount
      ? { color: 'var(--success)', text: `✓ ${tx("Op dit toestel én versleuteld in je account")}` }
      : syncOn
        ? { color: 'var(--text-soft)', text: tx("Op dit toestel — wordt bij Opslaan ook in je account bewaard") }
        : { color: 'var(--text-soft)', text: tx("Alleen op dit toestel") }

  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label>{tx("Sleutel")} {k.name}</label>
      <div className="row" style={{ gap: 8 }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 0 }}
          type={show ? 'text' : 'password'}
          placeholder={k.placeholder}
          value={value}
          onChange={(e) => { const v = e.target.value.trim(); setValue(v); k.set(v) }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          // Tell password managers this isn't a login password to fill or replace.
          data-1p-ignore=""
          data-lpignore="true"
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShow((s) => !s)}>{show ? tx("Verberg") : tx("Toon")}</button>
      </div>
      <p className="text-sm" style={{ margin: '6px 0 0', color: status.color }}>{status.text}</p>
      {!value && <p className="text-sm faint" style={{ margin: '4px 0 0' }}>{tx(k.how)}</p>}
    </div>
  )
}
