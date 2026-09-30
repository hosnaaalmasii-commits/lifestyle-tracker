import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { COLOR_THEMES } from '../../utils/colorThemes'
import { LANGUAGES } from '../../i18n'
import { useT } from '../../i18n/useT'
import CoachVoicePicker from '../../components/CoachVoicePicker'
import CoachAvatarPicker from '../../components/CoachAvatarPicker'
import UsageLimitsCard from '../../components/UsageLimitsCard'
import { getApiKey, setApiKey, getCoachSettings, setCoachSettings, sendToClaude, ClaudeApiError, MODEL_OPTIONS } from '../../utils/claudeApi'
import { getOuraApiKey, setOuraApiKey } from '../../utils/ouraApi'
import { isValidGoogleClientId } from '../../utils/googleCalendar'
import { PERSONALITIES } from '../../utils/coachContext'
import { isCloudSyncConfigured } from '../../utils/supabaseClient'
import BackHeader from '../../components/BackHeader'
import SegmentedControl from '../../components/SegmentedControl'
import ConfirmDialog from '../../components/ConfirmDialog'
import { tx } from '../../i18n/tx'

export default function Settings({ onBack }) {
  const {
    data, sync, setColorTheme, setDisplayName, setGentleMode, setLanguage,
    setWeightUnit, exportData, importData, clearAll,
    connectGoogleCalendar, disconnectGoogleCalendar, syncTasksToGoogleCalendar,
    enableCalendarAutoSync, disableCalendarAutoSync,
    setSupabaseConfig, disconnectSupabase, cloudSignUp, cloudSignIn, cloudSignOut, syncNow,
    backfillNormalizedTables,
    refreshOura,
  } = useApp()
  const importRef = useRef(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [importError, setImportError] = useState('')
  const [importedOk, setImportedOk] = useState(false)

  const [nameInput, setNameInput] = useState(data.settings.displayName || '')
  const { t } = useT()

  const [backfillBusy, setBackfillBusy] = useState(false)
  const [backfillStage, setBackfillStage] = useState('')
  const [backfillResult, setBackfillResult] = useState(null)
  const [backfillError, setBackfillError] = useState('')

  const runBackfill = async () => {
    setBackfillBusy(true)
    setBackfillError('')
    setBackfillResult(null)
    try {
      const results = await backfillNormalizedTables((label) => setBackfillStage(label))
      setBackfillResult(results)
    } catch (err) {
      setBackfillError(err?.message || 'Backfill failed.')
    } finally {
      setBackfillBusy(false)
      setBackfillStage('')
    }
  }

  const [apiKeyInput, setApiKeyInput] = useState(getApiKey())
  const [showKey, setShowKey] = useState(false)
  const [coachSettings, setCoachSettingsState] = useState(getCoachSettings())
  const [testStatus, setTestStatus] = useState('idle') // idle | testing | ok | error
  const [testMessage, setTestMessage] = useState('')

  const [clientIdInput, setClientIdInput] = useState(data.settings.googleClientId)
  const [calendarConnecting, setCalendarConnecting] = useState(false)
  const [calendarError, setCalendarError] = useState('')
  const [calendarSyncing, setCalendarSyncing] = useState(false)
  const [calendarSyncResult, setCalendarSyncResult] = useState(null)
  const [autoSyncBusy, setAutoSyncBusy] = useState(false)
  const [autoSyncError, setAutoSyncError] = useState('')

  const [ouraKeyInput, setOuraKeyInput] = useState(getOuraApiKey())
  const [ouraStatus, setOuraStatusMsg] = useState('idle') // idle | testing | ok | error
  const [ouraMessage, setOuraMessage] = useState('')

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

  const handleToggleAutoSync = async () => {
    setAutoSyncBusy(true)
    setAutoSyncError('')
    try {
      if (data.settings.googleAutoSyncEnabled) {
        await disableCalendarAutoSync()
      } else {
        await enableCalendarAutoSync()
      }
    } catch (e) {
      setAutoSyncError(e.message || 'Something went wrong.')
    } finally {
      setAutoSyncBusy(false)
    }
  }

  const handleSyncCalendar = async () => {
    setCalendarSyncing(true)
    setCalendarSyncResult(null)
    try {
      const errors = await syncTasksToGoogleCalendar()
      setCalendarSyncResult(errors.length ? `Gesynct met ${errors.length} fout(en).` : 'Volgende 7 dagen gesynct.')
    } catch (e) {
      setCalendarSyncResult(e.message)
    } finally {
      setCalendarSyncing(false)
    }
  }

  const saveOuraKey = (value) => {
    setOuraKeyInput(value)
    setOuraApiKey(value)
    setOuraStatusMsg('idle')
  }

  const testOuraConnection = async () => {
    setOuraStatusMsg('testing')
    setOuraMessage('')
    try {
      await refreshOura()
      setOuraStatusMsg('ok')
    } catch (e) {
      setOuraStatusMsg('error')
      setOuraMessage(e.message)
    }
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
      <BackHeader eyebrow="" title={t('set.title')} onBack={onBack} />

      <div className="section-title">{t('set.language')}</div>
      <div className="card">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={`chip${(data.settings.language || 'nl') === l.code ? ' selected' : ''}`}
              onClick={() => setLanguage(l.code)}
            >
              {tx(l.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="section-title">{t('set.color')}</div>
      <div className="card">
        <div className="row" style={{ gap: 10 }}>
          {COLOR_THEMES.map((theme) => {
            const selected = data.settings.colorTheme === theme.key
            return (
              <button
                key={theme.key}
                onClick={() => setColorTheme(theme.key)}
                aria-pressed={selected}
                style={{
                  flex: 1, cursor: 'pointer', padding: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden',
                  border: selected ? `2px solid ${theme.accent}` : '2px solid var(--border-soft)',
                  background: theme.bg, color: theme.text, textAlign: 'left',
                }}
              >
                <div style={{ height: 62, position: 'relative', background: `radial-gradient(ellipse at 50% 120%, ${theme.glow}88 0%, transparent 70%)` }}>
                  <span style={{ position: 'absolute', left: 10, bottom: 10, width: 34, height: 16, borderRadius: 99, background: theme.accent }} />
                  <span style={{ position: 'absolute', left: 50, bottom: 10, width: 34, height: 16, borderRadius: 99, border: `1.5px solid ${theme.second}` }} />
                </div>
                <div style={{ padding: '8px 10px', fontSize: 13, fontWeight: 700 }}>{t(`theme.${theme.key}`)}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="section-title">{t('set.name')}</div>
      <div className="card">
        <input
          className="input"
          placeholder={t('set.namePh')}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onBlur={() => setDisplayName(nameInput.trim())}
        />
      </div>

      <div className="section-title">{tx("Wellbeing")}</div>
      <div className="card">
        <div className="row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{tx("Gentle mode")}</div>
            <div className="text-sm faint" style={{ maxWidth: 240 }}>
              {tx("Hide exact weight numbers on Overview and the Weight page — shows a trend direction instead")}
            </div>
          </div>
          <button
            className={`switch${data.settings.gentleMode ? ' on' : ''}`}
            onClick={() => setGentleMode(!data.settings.gentleMode)}
            aria-label={tx("Gentle mode")}
          />
        </div>
      </div>

      <div className="section-title">{tx("Units")}</div>
      <div className="card">
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{tx("Weight unit")}</label>
          <SegmentedControl
            options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]}
            value={data.settings.weightUnit}
            onChange={setWeightUnit}
          />
        </div>
      </div>

      <div className="section-title">{tx("AI Coach")}</div>
      <div className="card stack">
        <p className="text-sm muted" style={{ margin: 0 }}>
          {tx("Bring your own Claude API key to unlock the in-app coach. Requests go straight from this browser to Anthropic — never through any server of ours, and your key is stored only in this browser's local storage (it's excluded from data export/backup).")}
        </p>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{tx("Anthropic API key")}</label>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              type={showKey ? 'text' : 'password'}
              placeholder={tx("sk-ant-…")}
              value={apiKeyInput}
              onChange={(e) => saveKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => setShowKey((s) => !s)}>{showKey ? tx("Hide") : tx("Show")}</button>
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{tx("Model")}</label>
          <select className="input" value={coachSettings.model} onChange={(e) => updateCoachSetting({ model: e.target.value })}>
            {MODEL_OPTIONS.map((m) => <option key={m.value} value={m.value}>{tx(m.label)}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{tx("Coach personality")}</label>
          <div className="scroll-x">
            {PERSONALITIES.map((p) => (
              <button
                key={p.id}
                className={`chip${p.id === coachSettings.personality ? ' selected' : ''}`}
                onClick={() => updateCoachSetting({ personality: p.id })}
              >
                {tx(p.label)}
              </button>
            ))}
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{tx("Gezicht van de coach")}</label>
          <CoachAvatarPicker />
        </div>
        <CoachVoicePicker />
        <div className="row">
          <button className="btn btn-secondary btn-sm" disabled={!apiKeyInput || testStatus === 'testing'} onClick={testConnection}>
            {testStatus === 'testing' ? tx("Testing…") : tx("Test connection")}
          </button>
          {apiKeyInput && <button className="btn btn-ghost btn-sm" onClick={() => saveKey('')}>{tx("Remove key")}</button>}
        </div>
        {testStatus === 'ok' && <div className="text-sm" style={{ color: 'var(--success)' }}>{tx("Connected — your coach is ready.")}</div>}
        {testStatus === 'error' && <div className="text-sm" style={{ color: 'var(--danger)' }}>{testMessage}</div>}
      </div>

      <div className="section-title">{tx("Kostenlimieten")}</div>
      <UsageLimitsCard />

      <div className="section-title">{tx("Google Calendar")}</div>
      <div className="card stack">
        <p className="text-sm muted" style={{ margin: 0 }}>
          {tx("Connect your Google Calendar so the day planner can plan around today's appointments and your tasks can be added as calendar events. This uses Google's own sign-in — your calendar data goes straight from Google to this browser, never through any server of ours. Just tap Connect and sign in with your Google account.")}
        </p>
        {data.calendarStatus?.connected ? (
          <>
            <div className="row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{tx("Connected")}</div>
                <div className="text-sm faint">
                  {tx("Today:")} {data.calendarStatus.busyMinutesToday >= 60
                    ? `${Math.round(data.calendarStatus.busyMinutesToday / 60 * 10) / 10}h busy`
                    : `${data.calendarStatus.busyMinutesToday || 0}m busy`}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={disconnectGoogleCalendar}>{tx("Disconnect")}</button>
            </div>
            <div className="row" style={{ marginTop: 4 }}>
              <button className="btn btn-secondary btn-sm" onClick={handleSyncCalendar} disabled={calendarSyncing}>
                {calendarSyncing ? tx("Bezig…") : tx("Taken syncen naar agenda (7 dagen)")}
              </button>
            </div>
            {calendarSyncResult && <div className="text-sm faint">{calendarSyncResult}</div>}

            <div className="row" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{tx("Automatic sync")}</div>
                <div className="text-sm faint" style={{ maxWidth: 260 }}>
                  {data.settings.googleAutoSyncEnabled
                    ? tx("Runs once a day on our server, even with the app closed.")
                    : sync.signedIn
                      ? tx("Requires re-approving Google access once — needed so a daily server job can sync without the app open.")
                      : tx("Sign in to Cloud Sync above first — a daily server job needs your account to store this under.")}
                </div>
              </div>
              <button
                className={`switch${data.settings.googleAutoSyncEnabled ? ' on' : ''}`}
                onClick={handleToggleAutoSync}
                disabled={autoSyncBusy || (!sync.signedIn && !data.settings.googleAutoSyncEnabled)}
                aria-label={tx("Automatic sync")}
              />
            </div>
            {autoSyncError && <div className="text-sm" style={{ color: 'var(--danger)' }}>{autoSyncError}</div>}
          </>
        ) : (
          <>
            <button className="btn btn-secondary btn-block" disabled={calendarConnecting} onClick={handleConnectCalendar}>
              {calendarConnecting ? tx("Connecting…") : tx("Connect Google Calendar")}
            </button>
            {calendarError && <div className="text-sm" style={{ color: 'var(--danger)' }}>{calendarError}</div>}
            <details>
              <summary className="text-sm faint" style={{ cursor: 'pointer' }}>{tx("Advanced: OAuth Client ID")}</summary>
              <div className="field" style={{ marginBottom: 0, marginTop: 8 }}>
                <label>{tx("Google OAuth Client ID (already filled in — only change for your own Google Cloud project)")}</label>
                <input
                  className="input"
                  type="text"
                  placeholder={tx("xxxxx.apps.googleusercontent.com")}
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                {clientIdInput.trim() && !isValidGoogleClientId(clientIdInput) && (
                  <div className="text-sm" style={{ color: 'var(--danger)', marginTop: 6 }}>
                    {tx("This isn't a Client ID (it should end in .apps.googleusercontent.com) — the built-in one will be used instead. Your calendar's own web address doesn't go here.")}
                  </div>
                )}
              </div>
            </details>
          </>
        )}
      </div>

      <div className="section-title">{tx("Oura Ring")}</div>
      <div className="card stack">
        <p className="text-sm muted" style={{ margin: 0 }}>
          {tx("Bring your own Oura Personal Access Token to pull today's sleep score, readiness, and active calories in next to your day score. Get one at cloud.ouraring.com/personal-access-tokens — it goes straight from this browser to Oura, never through any server of ours, and is never included in export/backup.")}
        </p>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>{tx("Oura Personal Access Token")}</label>
          <input
            className="input"
            type="password"
            placeholder={tx("Paste your token")}
            value={ouraKeyInput}
            onChange={(e) => saveOuraKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="row">
          <button className="btn btn-secondary btn-sm" disabled={!ouraKeyInput || ouraStatus === 'testing'} onClick={testOuraConnection}>
            {ouraStatus === 'testing' ? tx("Testing…") : tx("Test connection")}
          </button>
          {ouraKeyInput && <button className="btn btn-ghost btn-sm" onClick={() => saveOuraKey('')}>{tx("Remove token")}</button>}
        </div>
        {ouraStatus === 'ok' && <div className="text-sm" style={{ color: 'var(--success)' }}>{tx("Connected — today's data is in.")}</div>}
        {ouraStatus === 'error' && <div className="text-sm" style={{ color: 'var(--danger)' }}>{ouraMessage}</div>}
      </div>

      <div className="section-title">{tx("Cloud Sync")}</div>
      <div className="card stack">
        <p className="text-sm muted" style={{ margin: 0 }}>
          {tx("Keep this data in sync across your own devices, using your own free Supabase project — a database service, not a server of ours. Requires a one-time setup: create a free account at supabase.com, create a project, paste its URL and \"anon public\" key below (neither is a secret), then run the SQL in this project's")} <span className="mono">{tx("supabase/schema.sql")}</span> {tx("once in Supabase's SQL Editor. After that, sign in with the same email on each device.")}
        </p>
        {!isCloudSyncConfigured(data.settings) ? (
          <>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{tx("Supabase project URL")}</label>
              <input
                className="input"
                type="text"
                placeholder={tx("https://xxxxx.supabase.co")}
                value={supaUrlInput}
                onChange={(e) => setSupaUrlInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{tx("Anon public key")}</label>
              <input
                className="input"
                type="text"
                placeholder={tx("eyJ…")}
                value={supaKeyInput}
                onChange={(e) => setSupaKeyInput(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button className="btn btn-secondary btn-block" disabled={!supaUrlInput.trim() || !supaKeyInput.trim()} onClick={handleSaveSupabaseConfig}>
              {tx("Save connection")}
            </button>
          </>
        ) : !sync.signedIn ? (
          <>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{tx("Email")}</label>
              <input className="input" type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>{tx("Password")}</label>
              <input className="input" type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-secondary btn-sm" disabled={!authEmail || !authPassword || authBusy} onClick={() => handleAuth('signin')}>
                {authBusy ? tx("Working…") : tx("Sign in")}
              </button>
              <button className="btn btn-ghost btn-sm" disabled={!authEmail || !authPassword || authBusy} onClick={() => handleAuth('signup')}>
                {tx("First time — create account")}
              </button>
            </div>
            {authNotice && <div className="text-sm" style={{ color: 'var(--success)' }}>{authNotice}</div>}
            {authError && <div className="text-sm" style={{ color: 'var(--danger)' }}>{authError}</div>}
            <button className="btn btn-ghost btn-sm" onClick={disconnectSupabase}>{tx("Disconnect Supabase")}</button>
          </>
        ) : (
          <>
            <div className="row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{tx("Signed in as")} {sync.email}</div>
                <div className="text-sm faint">
                  {sync.status === 'syncing' ? tx("Syncing…") : sync.status === 'error' ? `Sync error: ${sync.error}` : sync.lastSyncedAt ? `Last synced ${new Date(sync.lastSyncedAt).toLocaleTimeString()}` : tx("Not synced yet")}
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={syncNow} disabled={sync.status === 'syncing'}>{tx("Sync now")}</button>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={cloudSignOut}>{tx("Sign out")}</button>
              <button className="btn btn-ghost btn-sm" onClick={disconnectSupabase}>{tx("Disconnect Supabase")}</button>
            </div>

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-soft)' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{tx("Backfill existing data")}</div>
              <p className="text-sm faint" style={{ margin: '2px 0 10px' }}>
                {tx("New entries already mirror to individual Supabase tables (water_logs, sleep_logs, weight_logs, etc.) alongside the usual whole-app backup. This pushes everything logged before that was wired up. Safe to run more than once — it won't create duplicates.")}
              </p>
              <button className="btn btn-secondary btn-sm" disabled={backfillBusy} onClick={runBackfill}>
                {backfillBusy ? `Backfilling ${backfillStage || '…'}` : tx("Backfill existing data")}
              </button>
              {backfillError && <div className="text-sm" style={{ color: 'var(--danger)', marginTop: 8 }}>{backfillError}</div>}
              {backfillResult && (
                <div className="text-sm" style={{ marginTop: 8 }}>
                  {Object.entries(backfillResult).map(([label, r]) => (
                    <div key={label} className="row" style={{ padding: '2px 0' }}>
                      <span className="muted">{label}</span>
                      <span className={r.errors.length ? '' : 'muted'} style={r.errors.length ? { color: 'var(--danger)' } : undefined}>
                        {r.ok} {tx("synced")}{r.errors.length ? `, ${r.errors.length} failed` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="section-title">{tx("Your data")}</div>
      <div className="card stack">
        <div className="row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{tx("Export backup")}</div>
            <div className="text-sm faint">{tx("Save everything as a JSON file")}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={exportData}>{tx("Export")}</button>
        </div>
        <div className="row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{tx("Import backup")}</div>
            <div className="text-sm faint">{tx("Replace current data from a file")}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => importRef.current?.click()}>{tx("Import")}</button>
          <input ref={importRef} type="file" accept="application/json" hidden onChange={handleImportFile} />
        </div>
        {importedOk && <div className="text-sm" style={{ color: 'var(--success)' }}>{tx("Backup imported successfully.")}</div>}
        {importError && <div className="text-sm" style={{ color: 'var(--danger)' }}>{importError}</div>}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{tx("Clear everything")}</div>
            <div className="text-sm faint">{tx("Erase all local data, including your API key")}</div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmClear(true)}>{tx("Clear")}</button>
        </div>
      </div>

      <p className="text-sm faint" style={{ textAlign: 'center', margin: '28px 0 8px' }}>
        {tx("Lifestyle Tracker · data stays on this device")}
      </p>

      <ConfirmDialog
        open={confirmClear}
        title={tx("Clear everything?")}
        message={tx("This permanently deletes all water, sleep, workout, weight, mood, nutrition and photo data, plus your saved API key and coach chat history, on this device, and disconnects Cloud Sync (your Supabase account and its data are untouched). This can't be undone.")}
        confirmLabel={tx("Clear everything")}
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearAll()
          saveKey('')
          Object.keys(localStorage)
            .filter((k) => k.startsWith('lifestyle-tracker-daily-note-')
              || k === 'lifestyle-tracker-coach-chat'
              || k.startsWith('lifestyle-tracker-coach-')
              || k.startsWith('lifestyle-tracker-elevenlabs-')
              || k.startsWith('lifestyle-tracker-openai-')
              || k === 'lifestyle-tracker-eod-report-cache')
            .forEach((k) => localStorage.removeItem(k))
          setConfirmClear(false)
        }}
      />
    </div>
  )
}
