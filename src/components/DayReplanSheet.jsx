import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayKey } from '../utils/dates'
import { getTasksForDate, getAppointmentsForDate } from '../utils/taskSchedule'
import { replanDay, parseAppointmentText, toMin, toHHMM } from '../utils/dayReplan'
import { hasApiKey } from '../utils/claudeApi'
import { aiReplanDay } from '../utils/smartDay'
import Sheet from './Sheet'
import DictateButton, { DICTATION_SUPPORTED } from './DictateButton'

function emptyForm() {
  return { title: '', start: '', end: '', location: '', travelBefore: '', travelAfter: '' }
}

function ManualForm({ form, setField, formValid, onAdd }) {
  return (
    <>
      <div className="field">
        <label>Wat</label>
        <input className="input" value={form.title} onChange={setField('title')} placeholder="Afspraak" />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Van</label>
          <input className="input" type="time" value={form.start} onChange={setField('start')} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Tot</label>
          <input className="input" type="time" value={form.end} onChange={setField('end')} />
        </div>
      </div>
      <div className="field">
        <label>Waar</label>
        <input className="input" value={form.location} onChange={setField('location')} placeholder="optioneel" />
      </div>
      <div className="row" style={{ gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Reistijd heen (min)</label>
          <input className="input" type="number" min={0} inputMode="numeric" value={form.travelBefore} onChange={setField('travelBefore')} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Terug (min)</label>
          <input className="input" type="number" min={0} inputMode="numeric" value={form.travelAfter} onChange={setField('travelAfter')} />
        </div>
      </div>
      <button className="btn btn-secondary btn-block" disabled={!formValid} onClick={onAdd}>+ Afspraak toevoegen</button>
    </>
  )
}

let apptCounter = 0
const newApptId = () => `appt-${Date.now().toString(36)}-${++apptCounter}`

const KIND_TEXT = { moved: 'verschoven', shortened: 'ingekort', dropped: 'vervalt', takeAlong: 'meenemen' }

// "Last-minute afspraak" flow: say or type an appointment, optionally pull
// today's real agenda items in, preview how the day's tasks shift around
// them (dayReplan.js), tweak any time, then apply — stored as today's
// dayOverrides only, the weekly template is never touched. The replan is
// always computed from the *template* tasks, so removing an appointment
// and re-applying cleanly restores what it had moved.
//
// With a Claude key, "Plan mijn dag met AI" sends the free-form sentence
// plus the template and known appointments to aiReplanDay (smartDay.js),
// which also estimates travel time. Its proposal replaces the rule-based
// one until the user edits the appointments by hand — then the rule-based
// planner takes over again, so the preview always matches what's listed.
export default function DayReplanSheet({ open, onClose }) {
  const {
    data, calendarStatus, applyDayReplan, resetDayPlan,
    fetchCalendarEventsForDate, syncTasksToGoogleCalendar, setHomeLocation,
  } = useApp()
  const aiAvailable = hasApiKey()
  const dateKey = todayKey()

  const [spoken, setSpoken] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [appointments, setAppointments] = useState([])
  const [timeEdits, setTimeEdits] = useState({}) // { [taskId]: 'HH:MM' }
  const [agendaStatus, setAgendaStatus] = useState(null)
  const [applied, setApplied] = useState(false)
  const [calSyncStatus, setCalSyncStatus] = useState(null)
  const [aiResult, setAiResult] = useState(null) // { tasks, changes, summary }
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)
  const [home, setHome] = useState(data.settings.homeLocation || '')

  const hasOverride = !!data.dayOverrides?.[dateKey]?.tasks

  useEffect(() => {
    if (!open) return
    setAppointments(getAppointmentsForDate(data.dayOverrides, dateKey))
    setSpoken('')
    setForm(emptyForm())
    setTimeEdits({})
    setAgendaStatus(null)
    setApplied(false)
    setCalSyncStatus(null)
    setAiResult(null)
    setAiError(null)
    setHome(data.settings.homeLocation || '')
    // Only on open — re-running on every data change would wipe the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const templateTasks = useMemo(() => getTasksForDate(data.taskSchedule, dateKey), [data.taskSchedule, dateKey])
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const ruleProposal = useMemo(
    () => replanDay(templateTasks, appointments, { completed: data.taskCompletions[dateKey] || {}, nowMin }),
    // nowMin deliberately left out — recomputing every minute would jump
    // the preview under the user's finger while they're editing it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templateTasks, appointments, data.taskCompletions, dateKey]
  )

  const proposal = aiResult || ruleProposal

  const finalTasks = proposal.tasks
    .map((t) => (timeEdits[t.id] ? { ...t, time: timeEdits[t.id] } : t))
    .sort((a, b) => a.time.localeCompare(b.time))

  const fillFromText = (text) => {
    if (!text.trim()) return
    const parsed = parseAppointmentText(text)
    setForm((f) => ({
      title: parsed.title || f.title,
      start: parsed.start || f.start,
      end: parsed.end || f.end,
      location: parsed.location || f.location,
      travelBefore: parsed.travelBefore || f.travelBefore,
      travelAfter: parsed.travelAfter || f.travelAfter,
    }))
  }

  const formValid = form.start && form.end && toMin(form.end) > toMin(form.start)

  const runAi = async (text) => {
    setAiError(null)
    setAiBusy(true)
    try {
      if (home !== (data.settings.homeLocation || '')) setHomeLocation(home.trim())
      const result = await aiReplanDay({
        text,
        templateTasks,
        appointments,
        completed: data.taskCompletions[dateKey] || {},
        nowHHMM: toHHMM(nowMin),
        home: home.trim(),
        targets: data.settings.calorieTargets,
      })
      setAppointments(result.appointments)
      setAiResult({ tasks: result.tasks, changes: result.changes, summary: result.summary })
      setTimeEdits({})
      setSpoken('')
    } catch (e) {
      setAiError(e.message)
    } finally {
      setAiBusy(false)
    }
  }

  const addAppointment = () => {
    if (!formValid) return
    setAiResult(null)
    setAppointments((list) => [...list, { id: newApptId(), ...form, title: form.title.trim() || 'Afspraak' }])
    setForm(emptyForm())
    setSpoken('')
    setTimeEdits({})
  }

  const removeAppointment = (id) => {
    setAiResult(null)
    setAppointments((list) => list.filter((a) => a.id !== id))
    setTimeEdits({})
  }

  const updateTravel = (id, field, value) => {
    setAiResult(null)
    setAppointments((list) => list.map((a) => (a.id === id ? { ...a, [field]: value } : a)))
  }

  const importAgenda = async () => {
    setAgendaStatus('Agenda ophalen…')
    try {
      const events = await fetchCalendarEventsForDate(dateKey)
      if (!events) { setAgendaStatus('Google Agenda is niet verbonden (Meer → Settings).'); return }
      const known = new Set(appointments.map((a) => a.calendarEventId).filter(Boolean))
      const fresh = events.filter((e) => !known.has(e.calendarEventId))
      setAiResult(null)
      setAppointments((list) => [...list, ...fresh.map((e) => ({ id: newApptId(), travelBefore: '', travelAfter: '', ...e }))])
      setTimeEdits({})
      setAgendaStatus(fresh.length ? `${fresh.length} afspra${fresh.length === 1 ? 'ak' : 'ken'} toegevoegd — vul de reistijd in.` : 'Geen nieuwe afspraken in je agenda vandaag.')
    } catch (e) {
      setAgendaStatus(e.message)
    }
  }

  const apply = () => {
    applyDayReplan(dateKey, finalTasks, appointments)
    setApplied(true)
  }

  const reset = () => {
    resetDayPlan(dateKey)
    setAppointments([])
    setTimeEdits({})
    onClose()
  }

  const syncCalendar = async () => {
    setCalSyncStatus('Bijwerken…')
    try {
      const errors = await syncTasksToGoogleCalendar()
      setCalSyncStatus(errors.length ? `Deels gelukt: ${errors[0]}` : 'Google Agenda bijgewerkt.')
    } catch (e) {
      setCalSyncStatus(e.message)
    }
  }

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  if (applied) {
    return (
      <Sheet open={open} onClose={onClose} title="Dag aangepast">
        <p className="text-sm">Je planning voor vandaag is bijgewerkt. Je vaste weekschema blijft ongewijzigd.</p>
        {calendarStatus.connected && (
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-secondary btn-block" onClick={syncCalendar}>Ook in Google Agenda bijwerken</button>
            {calSyncStatus && <p className="text-sm faint" style={{ marginTop: 8 }}>{calSyncStatus}</p>}
          </div>
        )}
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={onClose}>Klaar</button>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Afspraak & dag aanpassen">
      <div className="field">
        <label>Vertel je afspraak</label>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder="bv. om 14:00 tandarts in Utrecht tot 15:00, 20 min fietsen"
            value={spoken}
            onChange={(e) => setSpoken(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') fillFromText(spoken) }}
          />
          <DictateButton onText={setSpoken} onDone={aiAvailable ? runAi : fillFromText} />
        </div>
        {aiAvailable ? (
          <>
            <button className="btn btn-primary btn-block" style={{ marginTop: 8 }} disabled={aiBusy || (!spoken.trim() && !appointments.length)} onClick={() => runAi(spoken)}>
              {aiBusy ? 'Dag wordt gepland…' : 'Plan mijn dag met AI'}
            </button>
            <p className="text-sm faint" style={{ marginTop: 6 }}>
              Vertel het gewoon, bv. "ik moet om 3 uur naar de tandarts in Utrecht en vanavond eet ik bij mijn moeder". Reistijd wordt geschat als je die niet noemt.
              {!DICTATION_SUPPORTED && ' Inspreken kan via de microfoon van je toetsenbord.'}
            </p>
            <div className="field" style={{ marginTop: 8 }}>
              <label>Vertrekpunt (voor reistijd)</label>
              <input className="input" placeholder="bv. je woonplaats of adres" value={home} onChange={(e) => setHome(e.target.value)} onBlur={() => setHomeLocation(home.trim())} />
            </div>
            {aiError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{aiError}</p>}
            <details style={{ marginTop: 4 }}>
              <summary className="text-sm faint" style={{ cursor: 'pointer' }}>Of vul een afspraak zelf in</summary>
              <div className="row" style={{ marginTop: 8, gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" disabled={!spoken.trim()} onClick={() => fillFromText(spoken)}>Tekst invullen in formulier</button>
              </div>
              <ManualForm form={form} setField={setField} formValid={formValid} onAdd={addAppointment} />
            </details>
          </>
        ) : (
          <>
            <div className="row" style={{ marginTop: 6, gap: 8 }}>
              <span className="text-sm faint" style={{ flex: 1 }}>
                {DICTATION_SUPPORTED ? 'Spreek of typ, daarna "Invullen".' : 'Typ, of gebruik de microfoon van je toetsenbord.'}
              </span>
              <button className="btn btn-secondary btn-sm" disabled={!spoken.trim()} onClick={() => fillFromText(spoken)}>Invullen</button>
            </div>
            <ManualForm form={form} setField={setField} formValid={formValid} onAdd={addAppointment} />
          </>
        )}
      </div>

      {calendarStatus.connected && (
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-ghost btn-block" onClick={importAgenda}>Afspraken van vandaag uit Google Agenda halen</button>
          {agendaStatus && <p className="text-sm faint" style={{ marginTop: 6 }}>{agendaStatus}</p>}
        </div>
      )}

      {(appointments.length > 0 || aiResult) && (
        <>
          <div className="section-title">Afspraken vandaag</div>
          {appointments.length === 0 && <p className="text-sm faint">Geen afspraken.</p>}
          <div className="card" style={{ padding: '4px 14px' }}>
            {appointments.map((a, i) => (
              <div key={a.id} style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border-soft)' : 'none' }}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{a.title}</div>
                    <div className="text-sm faint">
                      <span className="mono">{a.start}–{a.end}</span>{a.location ? ` · ${a.location}` : ''}
                      {a.travelEstimated && <span> · reistijd geschat</span>}
                    </div>
                  </div>
                  <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }} onClick={() => removeAppointment(a.id)}>Verwijder</button>
                </div>
                <div className="row" style={{ gap: 8, marginTop: 6, justifyContent: 'flex-start' }}>
                  <span className="text-sm faint">Reistijd</span>
                  <input className="input" style={{ width: 64, padding: '4px 8px' }} type="number" min={0} inputMode="numeric" aria-label="Reistijd heen" value={a.travelBefore} onChange={(e) => updateTravel(a.id, 'travelBefore', e.target.value)} />
                  <span className="text-sm faint">heen /</span>
                  <input className="input" style={{ width: 64, padding: '4px 8px' }} type="number" min={0} inputMode="numeric" aria-label="Reistijd terug" value={a.travelAfter} onChange={(e) => updateTravel(a.id, 'travelAfter', e.target.value)} />
                  <span className="text-sm faint">terug (min)</span>
                </div>
              </div>
            ))}
          </div>

          <div className="row" style={{ alignItems: 'baseline' }}>
            <div className="section-title">{aiResult ? 'Voorstel (AI)' : 'Voorstel'}</div>
            {aiResult && (
              <button className="btn-ghost text-sm" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }} onClick={() => { setAiResult(null); setTimeEdits({}) }}>
                Standaardplanner gebruiken
              </button>
            )}
          </div>
          {aiResult?.summary && <p className="text-sm" style={{ marginBottom: 10 }}>{aiResult.summary}</p>}
          {proposal.changes.length === 0 ? (
            <p className="text-sm faint">Niets hoeft te verschuiven — je schema past om je afspraken heen.</p>
          ) : (
            <div className="card" style={{ padding: '4px 14px' }}>
              {proposal.changes.map((c, i) => (
                <div key={c.id} style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border-soft)' : 'none' }}>
                  <div className="row" style={{ gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{c.label}</div>
                      <div className="text-sm faint">
                        <span className="mono">{c.from}</span> → {c.to ? <span className="mono">{timeEdits[c.id] || c.to}</span> : '—'} · {KIND_TEXT[c.kind]}
                      </div>
                      {c.note && <div className="text-sm faint">{c.note}</div>}
                    </div>
                    {c.to && c.kind !== 'takeAlong' && (
                      <input
                        className="input"
                        type="time"
                        aria-label={`Nieuwe tijd voor ${c.label}`}
                        style={{ width: 110, padding: '4px 8px', flexShrink: 0 }}
                        value={timeEdits[c.id] || c.to}
                        onChange={(e) => setTimeEdits((m) => ({ ...m, [c.id]: e.target.value }))}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={apply}>Toepassen op vandaag</button>
        </>
      )}

      {hasOverride && (
        <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={reset}>Terug naar mijn standaardschema</button>
      )}
    </Sheet>
  )
}
