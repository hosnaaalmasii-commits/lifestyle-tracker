import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { THEME_PRESETS } from '../../utils/colorPresets'
import { FINTECH_GRADIENTS } from '../../utils/fintechGradients'
import { getApiKey, setApiKey, getCoachSettings, setCoachSettings, sendToClaude, ClaudeApiError, MODEL_OPTIONS } from '../../utils/claudeApi'
import { PERSONALITIES } from '../../utils/coachContext'
import { isCloudSyncConfigured } from '../../utils/supabaseClient'
import BackHeader from '../../components/BackHeader'
import SegmentedControl from '../../components/SegmentedControl'
import ColorPicker from '../../components/ColorPicker'
import ConfirmDialog from '../../components/ConfirmDialog'

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const FONT_OPTIONS = [
  { value: 'fraunces', label: 'Fraunces' },
  { value: 'playfair', label: 'Playfair' },
  { value: 'space', label: 'Modern' },
]

const DENSITY_OPTIONS = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
]

const UI_STYLE_OPTIONS = [
  { value: 'classic', label: 'Classic' },
  { value: 'fintech', label: 'Fintech' },
]

const COLOR_FIELDS = [
  { key: 'accent', label: 'Main accent' },
  { key: 'ring', label: 'Progress ring' },
  { key: 'water', label: 'Water section' },
  { key: 'sleep', label: 'Sleep section' },
  { key: 'workout', label: 'Workout section' },
]

export default function Settings({ onBack }) {
  const {
    data, sync, setThemeMode, setUiStyle, setFintechGradient, setColor, resetColors, applyThemePreset,
    setHeadingFont, setDensity, setUseGradientAccents, setGentleMode,
    setWeightUnit, exportData, importData, clearAll,
    connectGoogleCalendar, disconnectGoogleCalendar,
    setSupabaseConfig, disconnectSupabase, cloudSignUp, cloudSignIn, cloudSignOut, syncNow,
  } = useApp()
  const importRef = useRef(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [importError, setImportError] = useState('')
  const [importedOk, setImportedOk] = useState(false)

  const [apiKeyInput, setApiKeyInput] = useState(getApiKey())
  const [showKey, setShowKey] = useState(false)
  const [coachSettings, setCoachSettingsState] = useState(getCoachSettings())
  const [testStatus, setTestStatus] = useState('idle') // idle | testing | ok | error
  const [testMessage, setTestMessage] = useState('')

  const [clientIdInput, setClientIdInput] = useState(data.settings.googleClientId)
  const [calendarConnecting, setCalendarConnecting] = useState(false)
  const [calendarError, setCalendarError] = useState('')

  const [supaUrlInput, setSupaUrlInput] = useState(data.settings.supabaseUrl)
  const [supaKeyInput, setSupaKeyInput] = useState(data.settings.supabaseAnonKey)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')

  const handleSaveSupabaseConfig = () => {
    setSupabaseConfig(supaUrlInput.trim(), supaKeyInput.trim())
  }

  const handleAuth = async (mode) => {
    setAuthBusy(true)
    setAuthError('')
    setAuthNotice('')
    try {
      if (mode === 'signup') {
        const session = await cloudSignUp(authEmail.trim(), authPassword)
        setAuthNotice(session ? 'Account created and signed in.' : 'Account created — check your email to confirm, then sign in.')
      } else {
        await cloudSignIn(authEmail.trim(), authPassword)
      }
      setAuthPassword('')
    } catch (e) {
      setAuthError(e.message || 'Something went wrong.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleConnectCalendar = async () => {
    setCalendarConnecting(true)
    setCalendarError('')
    try {
      await connectGoogleCalendar(clientIdInput.trim())
    } catch (e) {
      setCalendarError(e.message || 'Could not connect.')
    } finally {
      setCalendarConnecting(false)
    }
  }

  const saveKey = (value) => {
    setApiKeyInput(value)
    setApiKey(value)
    setTestStatus('idle')
  }

  const updateCoachSetting = (partial) => {
    setCoachSettingsState(setCoachSettings(partial))
  }

  const testConnection = async () => {
    setTestStatus('testing')
    setTestMessage('')
    try {
      await sendToClaude({
        system: 'Reply with exactly one word: "Connected".',
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 10,
      })
      setTestStatus('ok')
    } catch (e) {
      setTestStatus('error')
      setTestMessage(e instanceof ClaudeApiError ? e.message : 'Something went wrong.')
    }
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError('')
    setImportedOk(false)
    try {
      const text = await file.text()
      importData(text)
      setImportedOk(true)
    } catch {
      setImportError('Could not read that file — make sure it\'s a backup exported from this app.')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div className="page">
      <BackHeader eyebrow="More" title="Settings" onBack={onBack} />

      <div className="section-title">App style</div>
      <div className="card stack">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Style</label>
          <SegmentedControl options={UI_STYLE_OPTIONS} value={data.settings.uiStyle} onChange={setUiStyle} />
        </div>
        {data.settings.uiStyle === 'fintech' && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Gradient</label>
            <div className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
              {FINTECH_GRADIENTS.map((g) => {
                const selected = data.settings.fintechGradient === g.key
                return (
                  <button
                    key={g.key}
                    onClick={() => setFintechGradient(g.key)}
                    aria-label={g.name}
                    style={{
                      width: 52, height: 52, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
                      background: `linear-gradient(135deg, ${g.from}, ${g.to})`,
                      border: selected ? '2px solid var(--text)' : '2px solid transparent',
                      boxShadow: selected ? '0 0 0 2px var(--surface)' : 'none',
                      padding: 0,
                    }}
                    title={g.name}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="section-title">Appearance</div>
      <div className="card stack">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Theme</label>
          <SegmentedControl options={THEME_OPTIONS} value={data.settings.themeMode} onChange={setThemeMode} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Heading font</label>
          <SegmentedControl options={FONT_OPTIONS} value={data.settings.headingFont} onChange={setHeadingFont} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Layout density</label>
          <SegmentedControl options={DENSITY_OPTIONS} value={data.settings.density} onChange={setDensity} />
        </div>
        <div className="row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Gradient accents</div>
            <div className="text-sm faint">Blend the ring &amp; primary buttons into a second color</div>
          </div>
          <button
            className={`switch${data.settings.useGradientAccents ? ' on' : ''}`}
            onClick={() => setUseGradientAccents(!data.settings.useGradientAccents)}
            aria-label="Gradient accents"
          />
        </div>
      </div>

      <div className="section-title">Wellbeing</div>
      <div className="card">
        <div className="row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Gentle mode</div>
            <div className="text-sm faint" style={{ maxWidth: 240 }}>
              Hide exact weight numbers on Overview and the Weight page — shows a trend direction instead
            </div>
          </div>
          <button
            className={`switch${data.settings.gentleMode ? ' on' : ''}`}
            onClick={() => setGentleMode(!data.settings.gentleMode)}
            aria-label="Gentle mode"
          />
        </div>
      </div>

      <div className="section-title">Theme presets</div>
      <div className="scroll-x">
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => applyThemePreset(preset.colors)}
            style={{
              flexShrink: 0, width: 92, background: 'var(--surface)', border: '1px solid var(--border-soft)',
              borderRadius: 'var(--radius-md)', padding: '12px 8px', cursor: 'pointer', textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', gap: -6 }}>
              {[preset.colors.accent, preset.colors.water, preset.colors.workout].map((c, i) => (
                <span
                  key={i}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', background: c,
                    border: '2px solid var(--surface)', marginLeft: i === 0 ? 0 : -8,
                  }}
                />
              ))}
            </div>
            <div className="text-sm" style={{ marginTop: 8, fontWeight: 600, lineHeight: 1.2 }}>{preset.name}</div>
          </button>
        ))}
      </div>

      <div className="section-title">Colors</div>
      <div className="card">
        {COLOR_FIELDS.map((f) => (
          <ColorPicker key={f.key} label={f.label} value={data.settings.colors[f.key]} onChange={(hex) => setColor(f.key, hex)} />
        ))}
        {data.settings.useGradientAccents && (
          <ColorPicker label="Gradient end" value={data.settings.colors.gradientEnd} onChange={(hex) => setColor('gradientEnd', hex)} />
        )}
        <button className="btn btn-ghost btn-sm" onClick={resetColors}>Reset to defaults</button>
      </div>

      <div className="section-title">Units</div>
      <div className="card">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Weight unit</label>
          <SegmentedControl
            options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]}
            value={data.settings.weightUnit}
            onChange={setWeightUnit}
          />
        </div>
      </div>

      <div className="section-title">AI Coach</div>
      <div className="card stack">
        <p className="text-sm muted" style={{ margin: 0 }}>
          Bring your own Claude API key to unlock the in-app coach. Requests go straight from this browser to Anthropic — never through any server of ours, and your key is stored only in this browser's local storage (it's excluded from data export/backup).
        </p>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Anthropic API key</label>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              type={showKey ? 'text' : 'password'}
              placeholder="sk-ant-…"
              value={apiKeyInput}
              onChange={(e) => saveKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => setShowKey((s) => !s)}>{showKey ? 'Hide' : 'Show'}</button>
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Model</label>
          <select className="input" value={coachSettings.model} onChange={(e) => updateCoachSetting({ model: e.target.value })}>
            {MODEL_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Coach personality</label>
          <div className="scroll-x">
            {PERSONALITIES.map((p) => (
              <button
                key={p.id}
                className={`chip${p.id === coachSettings.personality ? ' selected' : ''}`}
                onClick={() => updateCoachSetting({ personality: p.id })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <button className="btn btn-secondary btn-sm" disabled={!apiKeyInput || testStatus === 'testing'} onClick={testConnection}>
            {testStatus === 'testing' ? 'Testing…' : 'Test connection'}
          </button>
          {apiKeyInput && <button className="btn btn-ghost btn-sm" onClick={() => saveKey('')}>Remove key</button>}
        </div>
        {testStatus === 'ok' && <div className="text-sm" style={{ color: 'var(--success)' }}>Connected — your coach is ready.</div>}
        {testStatus === 'error' && <div className="text-sm" style={{ color: 'var(--danger)' }}>{testMessage}</div>}
      </div>

      <div className="section-title">Google Calendar</div>
      <div className="card stack">
        <p className="text-sm muted" style={{ margin: 0 }}>
          Connect a read-only, free/busy-only view of today's calendar so workout suggestions can account for how packed today is. This uses Google's own sign-in — your calendar data goes straight from Google to this browser, never through any server of ours. Requires a one-time Google Cloud setup (a Client ID, not a secret — I'll walk you through it).
        </p>
        {data.calendarStatus?.connected ? (
          <>
            <div className="row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Connected</div>
                <div className="text-sm faint">
                  Today: {data.calendarStatus.busyMinutesToday >= 60
                    ? `${Math.round(data.calendarStatus.busyMinutesToday / 60 * 10) / 10}h busy`
                    : `${data.calendarStatus.busyMinutesToday || 0}m busy`}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={disconnectGoogleCalendar}>Disconnect</button>
            </div>
          </>
        ) : (
          <>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Google OAuth Client ID</label>
              <input
                className="input"
                type="text"
                placeholder="xxxxx.apps.googleusercontent.com"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button className="btn btn-secondary btn-block" disabled={!clientIdInput.trim() || calendarConnecting} onClick={handleConnectCalendar}>
              {calendarConnecting ? 'Connecting…' : 'Connect Google Calendar'}
            </button>
            {calendarError && <div className="text-sm" style={{ color: 'var(--danger)' }}>{calendarError}</div>}
          </>
        )}
      </div>

      <div className="section-title">Cloud Sync</div>
      <div className="card stack">
        <p className="text-sm muted" style={{ margin: 0 }}>
          Keep this data in sync across your own devices, using your own free Supabase project — a database service, not a server of ours. Requires a one-time setup: create a free account at supabase.com, create a project, paste its URL and "anon public" key below (neither is a secret), then run the SQL in this project's <span className="mono">supabase/schema.sql</span> once in Supabase's SQL Editor. After that, sign in with the same email on each device.
        </p>
        {!isCloudSyncConfigured(data.settings) ? (
          <>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Supabase project URL</label>
              <input
                className="input"
                type="text"
                placeholder="https://xxxxx.supabase.co"
                value={supaUrlInput}
                onChange={(e) => setSupaUrlInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Anon public key</label>
              <input
                className="input"
                type="text"
                placeholder="eyJ…"
                value={supaKeyInput}
                onChange={(e) => setSupaKeyInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button className="btn btn-secondary btn-block" disabled={!supaUrlInput.trim() || !supaKeyInput.trim()} onClick={handleSaveSupabaseConfig}>
              Save connection
            </button>
          </>
        ) : !sync.signedIn ? (
          <>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Email</label>
              <input className="input" type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Password</label>
              <input className="input" type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-secondary btn-sm" disabled={!authEmail || !authPassword || authBusy} onClick={() => handleAuth('signin')}>
                {authBusy ? 'Working…' : 'Sign in'}
              </button>
              <button className="btn btn-ghost btn-sm" disabled={!authEmail || !authPassword || authBusy} onClick={() => handleAuth('signup')}>
                First time — create account
              </button>
            </div>
            {authNotice && <div className="text-sm" style={{ color: 'var(--success)' }}>{authNotice}</div>}
            {authError && <div className="text-sm" style={{ color: 'var(--danger)' }}>{authError}</div>}
            <button className="btn btn-ghost btn-sm" onClick={disconnectSupabase}>Disconnect Supabase</button>
          </>
        ) : (
          <>
            <div className="row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Signed in as {sync.email}</div>
                <div className="text-sm faint">
                  {sync.status === 'syncing' ? 'Syncing…' : sync.status === 'error' ? `Sync error: ${sync.error}` : sync.lastSyncedAt ? `Last synced ${new Date(sync.lastSyncedAt).toLocaleTimeString()}` : 'Not synced yet'}
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={syncNow} disabled={sync.status === 'syncing'}>Sync now</button>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={cloudSignOut}>Sign out</button>
              <button className="btn btn-ghost btn-sm" onClick={disconnectSupabase}>Disconnect Supabase</button>
            </div>
          </>
        )}
      </div>

      <div className="section-title">Your data</div>
      <div className="card stack">
        <div className="row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Export backup</div>
            <div className="text-sm faint">Save everything as a JSON file</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={exportData}>Export</button>
        </div>
        <div className="row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Import backup</div>
            <div className="text-sm faint">Replace current data from a file</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => importRef.current?.click()}>Import</button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
        </div>
        {importedOk && <div className="text-sm" style={{ color: 'var(--success)' }}>Backup imported successfully.</div>}
        {importError && <div className="text-sm" style={{ color: 'var(--danger)' }}>{importError}</div>}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Clear everything</div>
            <div className="text-sm faint">Erase all local data, including your API key</div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmClear(true)}>Clear</button>
        </div>
      </div>

      <p className="text-sm faint" style={{ textAlign: 'center', margin: '28px 0 8px' }}>
        Lifestyle Tracker · data stays on this device
      </p>

      <ConfirmDialog
        open={confirmClear}
        title="Clear everything?"
        message="This permanently deletes all water, sleep, workout, weight, mood, nutrition and photo data, plus your saved API key and coach chat history, on this device, and disconnects Cloud Sync (your Supabase account and its data are untouched). This can't be undone."
        confirmLabel="Clear everything"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearAll()
          saveKey('')
          Object.keys(localStorage)
            .filter((k) => k.startsWith('lifestyle-tracker-daily-note-') || k === 'lifestyle-tracker-coach-chat')
            .forEach((k) => localStorage.removeItem(k))
          setConfirmClear(false)
        }}
      />
    </div>
  )
}
