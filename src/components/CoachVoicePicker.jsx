import { useEffect, useState } from 'react'
import {
  isSpeechSynthesisSupported, getVoicesFor, voiceLabel, onVoicesChanged,
  getPreferredVoiceName, setPreferredVoiceName, getSpeechRate, setSpeechRate,
  getVoiceProvider, setVoiceProvider, VOICE_PROVIDERS, SPEECH_RATES, speak, unlockSpeech,
  SPEECH_LANGS, getSpeechLangSetting, setSpeechLangSetting,
} from '../utils/speechOutput'
import {
  getElevenKey, getElevenVoice, setElevenVoice, getElevenModel, setElevenModel,
  fetchElevenVoices, ELEVEN_MODELS,
} from '../utils/elevenLabs'
import { getOpenAiKey, getOpenAiVoice, setOpenAiVoice, OPENAI_VOICES } from '../utils/openaiTts'
import { LIVE_MODELS, getLiveModel, setLiveModel, REALTIME_VOICES } from '../utils/openaiRealtime'
import Icon from './Icon'
import { tx } from '../i18n/tx'
import { useT } from '../i18n/useT'

// The sample sentence, in the conversation language (so a French voice
// isn't judged on a Dutch sentence).
const SAMPLES = {
  nl: 'Hoi! Zo klink ik. Zullen we samen je dag doornemen?',
  en: "Hi! This is how I sound. Shall we go through your day together?",
  fr: 'Salut ! Voilà ma voix. On regarde ta journée ensemble ?',
  de: 'Hallo! So klinge ich. Wollen wir zusammen deinen Tag durchgehen?',
  es: '¡Hola! Así sueno yo. ¿Repasamos juntos tu día?',
  it: 'Ciao! Ecco la mia voce. Vediamo insieme la tua giornata?',
  pt: 'Olá! É assim que eu soo. Vamos rever o teu dia juntos?',
  tr: 'Merhaba! Sesim böyle. Gününü birlikte gözden geçirelim mi?',
  ar: 'مرحبًا! هذا هو صوتي. هل نراجع يومك معًا؟',
  fa: 'سلام! صدای من این‌طوری است. با هم روزت را مرور کنیم؟',
  pl: 'Cześć! Tak brzmi mój głos. Przejrzymy razem twój dzień?',
}

// Choose who speaks for the coach — the device's own voices, OpenAI or
// ElevenLabs — which voice, and how fast. Per device (own localStorage
// keys). Lives in "Coach instellen", which keeps a snapshot and only keeps
// the changes on Opslaan. The API keys themselves are entered in the
// "Sleutels & kosten" tab (CoachKeysPanel) — onNeedKey jumps there.
export default function CoachVoicePicker({ onNeedKey, onProviderChange }) {
  const { locale } = useT()
  const [provider, setProvider] = useState(getVoiceProvider)
  const [speakError, setSpeakError] = useState('')
  const [rate, setRate] = useState(getSpeechRate)
  const [langSetting, setLangSetting] = useState(getSpeechLangSetting)
  const lang = langSetting || locale

  // forLang: right after a language change, before state has caught up.
  const preview = (forLang) => {
    const l = typeof forLang === 'string' ? forLang : lang
    setSpeakError('')
    unlockSpeech()
    speak(SAMPLES[l.split('-')[0]] || SAMPLES.nl, {
      lang: l,
      onError: (e) => setSpeakError(`${e.message} ${tx("Je hoorde nu de stem van je toestel.")}`),
    })
  }
  // After picking a voice: unlock inside the tap, then play a sample.
  const previewSoon = (forLang) => { unlockSpeech(); setTimeout(() => preview(forLang), 50) }

  const chooseProvider = (id) => { setProvider(id); setVoiceProvider(id); setSpeakError(''); onProviderChange?.(id) }
  const chooseRate = (value) => { setRate(value); setSpeechRate(value); previewSoon() }
  const chooseLang = (code) => { setLangSetting(code); setSpeechLangSetting(code); previewSoon(code || locale) }

  const previewButton = (
    <button type="button" className="btn btn-secondary btn-sm" onClick={() => preview()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <Icon name="speaker" size={15} />{tx("Beluister")}
    </button>
  )

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>{tx("Taal van het gesprek")}</label>
        <select className="input" value={langSetting} onChange={(e) => chooseLang(e.target.value)}>
          <option value="">{tx("Zelfde als de app")}</option>
          {SPEECH_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <p className="text-sm faint" style={{ margin: '6px 0 0' }}>
          {tx("De taal waarin je inspreekt en waarin de coach antwoordt en praat. Niet elke stem spreekt elke taal even goed — probeer het met Beluister.")}
        </p>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <label>{tx("Wie praat er voor de coach?")}</label>
        <div className="scroll-x">
          {VOICE_PROVIDERS.map((p) => (
            <button key={p.id} type="button" className={`chip${p.id === provider ? ' selected' : ''}`} onClick={() => chooseProvider(p.id)}>
              {tx(p.label)}
            </button>
          ))}
        </div>
      </div>

      {provider === 'device' && <DeviceSection locale={lang} previewButton={previewButton} onPicked={previewSoon} />}
      {provider === 'openai' && <OpenAiSection previewButton={previewButton} onPicked={previewSoon} onNeedKey={onNeedKey} />}
      {provider === 'elevenlabs' && <ElevenSection previewButton={previewButton} onPicked={previewSoon} onNeedKey={onNeedKey} />}

      <div className="field" style={{ marginBottom: 0 }}>
        <label>{tx("Spreeksnelheid")}</label>
        <div className="scroll-x">
          {SPEECH_RATES.map((r) => (
            <button key={r.value} type="button" className={`chip${Math.abs(r.value - rate) < 0.01 ? ' selected' : ''}`} onClick={() => chooseRate(r.value)}>
              {tx(r.label)}
            </button>
          ))}
        </div>
      </div>

      {speakError && <p className="text-sm" style={{ margin: 0, color: 'var(--danger)' }}>{speakError}</p>}
      <p className="text-sm faint" style={{ margin: 0 }}>
        {tx("Stem en snelheid stel je per toestel in.")}
      </p>
    </div>
  )
}

function DeviceSection({ locale, previewButton, onPicked }) {
  const [voices, setVoices] = useState(() => getVoicesFor(locale))
  const [voice, setVoice] = useState(getPreferredVoiceName)

  useEffect(() => {
    setVoices(getVoicesFor(locale))
    return onVoicesChanged(() => setVoices(getVoicesFor(locale)))
  }, [locale])

  if (!isSpeechSynthesisSupported()) {
    return <p className="text-sm faint" style={{ margin: 0 }}>{tx("Deze browser kan niet voorlezen.")}</p>
  }
  const choose = (name) => { setVoice(name); setPreferredVoiceName(name); onPicked() }

  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label>{tx("Stem van dit toestel")}</label>
      {voices.length ? (
        <div className="row" style={{ gap: 8 }}>
          <select className="input" style={{ flex: 1, minWidth: 0 }} value={voice} onChange={(e) => choose(e.target.value)}>
            <option value="">{tx("Automatisch (beste stem)")}</option>
            {voices.map((v) => <option key={v.name} value={v.name}>{voiceLabel(v)}</option>)}
          </select>
          {previewButton}
        </div>
      ) : (
        <p className="text-sm faint" style={{ margin: 0 }}>{tx("Op dit toestel zijn geen stemmen voor deze taal gevonden.")}</p>
      )}
      <p className="text-sm faint" style={{ margin: '8px 0 0' }}>
        {tx("Gratis, geen account nodig. Op een iPhone kun je betere stemmen downloaden via Instellingen → Toegankelijkheid → Gesproken materiaal → Stemmen; in Microsoft Edge op de pc zijn de 'natuurlijke' stemmen al veel beter.")}
      </p>
    </div>
  )
}

function OpenAiSection({ previewButton, onPicked, onNeedKey }) {
  const key = getOpenAiKey()
  const [voice, setVoice] = useState(getOpenAiVoice)
  const [liveModel, setLiveModelState] = useState(getLiveModel)
  const choose = (id) => { setVoice(id); setOpenAiVoice(id); onPicked() }
  const chooseModel = (m) => { setLiveModelState(m); setLiveModel(m) }

  return (
    <>
      {!key && <NeedKey name="OpenAI" onNeedKey={onNeedKey} />}
      {key && (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{tx("Stem van de coach")}</label>
          <div className="row" style={{ gap: 8 }}>
            <select className="input" style={{ flex: 1, minWidth: 0 }} value={voice} onChange={(e) => choose(e.target.value)}>
              {OPENAI_VOICES.map((v) => <option key={v.id} value={v.id}>{v.name} — {tx(v.description)}{REALTIME_VOICES.has(v.id) ? '' : ` (${tx("niet live")})`}</option>)}
            </select>
            {previewButton}
          </div>
          <p className="text-sm faint" style={{ margin: '6px 0 0' }}>
            {tx("Live klinken Marin en Cedar het meest menselijk. Stemmen met \"niet live\" praten in een live-gesprek als Marin.")}
          </p>
        </div>
      )}
      {key && (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{tx("Live-gesprek")}</label>
          <select className="input" value={liveModel} onChange={(e) => chooseModel(e.target.value)}>
            {LIVE_MODELS.map((m) => <option key={m.value} value={m.value}>{tx(m.label)}</option>)}
          </select>
          <p className="text-sm faint" style={{ margin: '6px 0 0' }}>
            {tx("Tik op je coach en praat gewoon: hij antwoordt meteen, je kunt hem onderbreken of van onderwerp veranderen.")}
          </p>
        </div>
      )}
    </>
  )
}

function ElevenSection({ previewButton, onPicked, onNeedKey }) {
  const key = getElevenKey()
  const [voices, setVoices] = useState(null) // null = not loaded
  const [voice, setVoice] = useState(getElevenVoice)
  const [model, setModel] = useState(getElevenModel)
  const [loadError, setLoadError] = useState('')

  // Load the account's voices once a key is entered (debounced while typing).
  useEffect(() => {
    setVoices(null)
    setLoadError('')
    if (!key) return
    let cancelled = false
    const timer = setTimeout(() => {
      fetchElevenVoices()
        .then((list) => { if (!cancelled) setVoices(list) })
        .catch((e) => { if (!cancelled) setLoadError(e.message || 'Kon de stemmen niet laden.') })
    }, 500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [key])

  const choose = (id) => { setVoice(id); setElevenVoice(id); onPicked() }
  const chooseModel = (value) => { setModel(value); setElevenModel(value) }

  return (
    <>
      {!key && <NeedKey name="ElevenLabs" onNeedKey={onNeedKey} />}
      {key && voices && <p className="text-sm" style={{ margin: 0, color: 'var(--success)' }}>✓ {tx("Verbonden met ElevenLabs")}</p>}
      {key && (
        <>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{tx("Stem van de coach")}</label>
            {loadError ? (
              <p className="text-sm" style={{ margin: 0, color: 'var(--danger)' }}>{loadError}</p>
            ) : !voices ? (
              <p className="text-sm faint" style={{ margin: 0 }}>{tx("Stemmen laden…")}</p>
            ) : (
              <div className="row" style={{ gap: 8 }}>
                <select className="input" style={{ flex: 1, minWidth: 0 }} value={voice} onChange={(e) => choose(e.target.value)}>
                  {!voices.some((v) => v.id === voice) && <option value={voice}>{tx("Standaard")}</option>}
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}{v.description ? ` — ${v.description}` : ''}</option>
                  ))}
                </select>
                {previewButton}
              </div>
            )}
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{tx("Kwaliteit")}</label>
            <div className="scroll-x">
              {ELEVEN_MODELS.map((m) => (
                <button key={m.value} type="button" className={`chip${m.value === model ? ' selected' : ''}`} onClick={() => chooseModel(m.value)}>
                  {tx(m.label)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}

function NeedKey({ name, onNeedKey }) {
  return (
    <div className="card stack" style={{ gap: 8, padding: 14 }}>
      <span className="text-sm">{tx("Hiervoor heb je een")} {name}{tx("-sleutel nodig.")}</span>
      {onNeedKey && <button type="button" className="btn btn-secondary btn-sm" onClick={onNeedKey}>{tx("Sleutel invullen")}</button>}
    </div>
  )
}
