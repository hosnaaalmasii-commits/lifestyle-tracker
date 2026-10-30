import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { WEEKDAY_KEYS, TASK_CATEGORIES, weekdayKeyForDate } from '../../utils/taskSchedule'
import { todayKey } from '../../utils/dates'
import { isPushSupported, isThisDeviceSubscribed, showTestNotification } from '../../utils/push'
import BackHeader from '../../components/BackHeader'
import Sheet from '../../components/Sheet'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'
import { tx } from '../../i18n/tx'

const DAY_SHORT = { mon: 'Ma', tue: 'Di', wed: 'Wo', thu: 'Do', fri: 'Vr', sat: 'Za', sun: 'Zo' }
const DAY_LABELS = { mon: 'Maandag', tue: 'Dinsdag', wed: 'Woensdag', thu: 'Donderdag', fri: 'Vrijdag', sat: 'Zaterdag', sun: 'Zondag' }
const MEAL_KEYS = ['ontbijt', 'lunch', 'diner', 'snack']
const MEAL_LABELS = { ontbijt: 'Ontbijt', lunch: 'Lunch', diner: 'Diner', snack: 'Snack' }
const CAT_LABELS = { eten: 'Eten', training: 'Training', supplement: 'Supplement', herstel: 'Herstel', werk: 'Werk', zelfzorg: 'Zelfzorg' }
const CAT_COLORS = {
  eten: 'var(--second)', training: 'var(--accent-workout)', supplement: 'var(--accent-sleep)',
  herstel: 'var(--accent-water)', werk: 'var(--text-faint)', zelfzorg: 'var(--warning)',
}
const THRESHOLDS = [60, 70, 80, 90, 100]

function emptyTaskForm() {
  return { time: '07:00', label: '', category: 'eten', notify: true }
}

// Richting E layout (2026-10-16 cleanup): pick a day, see its tasks as one
// calm list (tap one to change it), that day's menu below, and the
// reminder/streak settings last — they used to sit on top.
export default function DailySchedule({ onBack }) {
  const {
    data, sync, addTaskToDay, updateTaskInDay, removeTaskFromDay,
    setMealForDay, setStreakThreshold, setNotifyCategory,
    enablePushNotifications, disablePushNotifications,
  } = useApp()

  const [day, setDay] = useState(() => weekdayKeyForDate(todayKey()))
  const [mealWeek, setMealWeek] = useState(data.mealRotation?.cycle?.[0] || 'A')
  const [taskSheet, setTaskSheet] = useState(null) // { task | null }
  const [form, setForm] = useState(emptyTaskForm())
  const [toDelete, setToDelete] = useState(null) // task id
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState(null)
  const [testMsg, setTestMsg] = useState(null)
  // Whether THIS device is signed up — not the synced pushEnabled setting,
  // which follows whichever device last changed it (see push.js).
  const [deviceOn, setDeviceOn] = useState(false)
  useEffect(() => { isThisDeviceSubscribed().then(setDeviceOn) }, [])

  const handlePushToggle = async () => {
    setPushError(null)
    setPushBusy(true)
    try {
      if (deviceOn) await disablePushNotifications()
      else await enablePushNotifications()
    } catch (e) {
      setPushError(e.message)
    } finally {
      setDeviceOn(await isThisDeviceSubscribed())
      setPushBusy(false)
    }
  }

  const sendTest = async () => {
    setTestMsg(null)
    try {
      await showTestNotification()
      setTestMsg({ ok: true, text: tx("Testmelding verstuurd — zie je hem bovenaan je scherm? Dan kan dit toestel meldingen tonen.") })
    } catch (e) {
      setTestMsg({ ok: false, text: e.message })
    }
  }

  const openAddTask = () => { setForm(emptyTaskForm()); setTaskSheet({ task: null }) }
  const openEditTask = (task) => {
    setForm({ time: task.time, label: task.label, category: task.category, notify: task.notify })
    setTaskSheet({ task })
  }
  const saveTask = () => {
    if (!form.label.trim()) return
    if (taskSheet.task) updateTaskInDay(day, taskSheet.task.id, { ...form, label: form.label.trim() })
    else addTaskToDay(day, { ...form, label: form.label.trim() })
    setTaskSheet(null)
  }

  const tasks = [...(data.taskSchedule[day] || [])].sort((a, b) => a.time.localeCompare(b.time))
  const mealRotation = data.mealRotation
  const cycle = mealRotation?.cycle || []

  return (
    <div className="page">
      <BackHeader title={tx("Dagschema & menu")} onBack={onBack} />

      {/* Day picker, shared by tasks and menu */}
      <div className="scroll-x" style={{ marginBottom: 18 }}>
        {WEEKDAY_KEYS.map((d) => (
          <button key={d} type="button" className={`chip${d === day ? ' selected' : ''}`} onClick={() => setDay(d)} style={{ minWidth: 46, justifyContent: 'center' }}>
            {tx(DAY_SHORT[d])}
          </button>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{tx(DAY_LABELS[day])}</div>
        <span className="text-sm faint">{tasks.length} {tx("taken")}</span>
      </div>
      <div className="card list-card">
        {tasks.length === 0 && <div className="list-row text-sm muted">{tx("Nog geen taken op deze dag.")}</div>}
        {tasks.map((t) => (
          <button key={t.id} type="button" className="list-row" onClick={() => openEditTask(t)}>
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: CAT_COLORS[t.category] || 'var(--text-faint)', flexShrink: 0 }} />
            <span className="faint" style={{ fontSize: 13, fontWeight: 500, width: 40, flexShrink: 0 }}>{t.time}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600 }}>{tx(t.label)}</span>
            {!t.notify && <span className="faint" title={tx("Geen melding")} style={{ fontSize: 12 }}>{tx("stil")}</span>}
            <Icon name="chevronRight" size={16} />
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 10 }} onClick={openAddTask}>
        + {tx("Taak toevoegen")}
      </button>

      {mealRotation && (
        <>
          <div className="section-title">{tx("Menu")}</div>
          <div className="scroll-x" style={{ marginBottom: 12 }}>
            {cycle.map((w) => (
              <button key={w} type="button" className={`chip${mealWeek === w ? ' selected' : ''}`} onClick={() => setMealWeek(w)}>
                {tx("Week")} {w}
              </button>
            ))}
          </div>
          <div className="card stack" style={{ gap: 12 }}>
            <div className="text-sm faint">{tx(DAY_LABELS[day])} · {tx("week")} {mealWeek}</div>
            {MEAL_KEYS.map((mealKey) => (
              <div key={mealKey} className="field" style={{ marginBottom: 0 }}>
                <label>{tx(MEAL_LABELS[mealKey])}</label>
                <input
                  className="input"
                  value={mealRotation.meals_by_week?.[mealWeek]?.[day]?.[mealKey] || ''}
                  placeholder={tx("Nog niets ingevuld")}
                  onChange={(e) => setMealForDay(mealWeek, day, mealKey, e.target.value)}
                />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-title">{tx("Meldingen & reeks")}</div>
      <div className="card list-card">
        <div className="list-row">
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{tx("Meldingen op dit toestel")}</div>
            <div className="text-sm faint">
              {!isPushSupported()
                ? tx("Deze browser kan geen meldingen ontvangen. Op iPhone: open de app via het icoon op je beginscherm.")
                : !sync.signedIn
                  ? tx("Log eerst in bij Cloud Sync (menu → Instellingen).")
                  : tx("Een melding op het tijdstip van elke taak.")}
            </div>
            {pushError && <div className="text-sm" style={{ color: 'var(--danger)', marginTop: 4 }}>{pushError}</div>}
          </div>
          <button
            type="button"
            className={`switch${deviceOn ? ' on' : ''}`}
            aria-pressed={deviceOn}
            aria-label={tx("Meldingen op dit toestel")}
            disabled={!isPushSupported() || !sync.signedIn || pushBusy}
            onClick={handlePushToggle}
          />
        </div>
        {deviceOn && (
          <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={sendTest}>{tx("Stuur een testmelding")}</button>
            {testMsg && <div className="text-sm" style={{ color: testMsg.ok ? 'var(--success)' : 'var(--danger)' }}>{testMsg.text}</div>}
          </div>
        )}
        <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{tx("Waarvoor wil je een melding?")}</div>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' }}>
            {TASK_CATEGORIES.map((cat) => {
              const on = !!data.settings.notifyCategories[cat]
              return (
                <button key={cat} type="button" className={`chip${on ? ' selected' : ''}`} aria-pressed={on} onClick={() => setNotifyCategory(cat, !on)}>
                  {tx(CAT_LABELS[cat] || cat)}
                </button>
              )
            })}
          </div>
        </div>
        <div className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{tx("Wanneer telt een dag voor je reeks?")}</div>
            <div className="text-sm faint">{tx("Als je minstens dit deel van je taken hebt afgevinkt.")}</div>
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' }}>
            {THRESHOLDS.map((p) => (
              <button key={p} type="button" className={`chip${data.settings.streakThresholdPct === p ? ' selected' : ''}`} onClick={() => setStreakThreshold(p)}>
                {p}%
              </button>
            ))}
          </div>
        </div>
      </div>

      <Sheet open={!!taskSheet} onClose={() => setTaskSheet(null)} title={taskSheet?.task ? tx("Taak bewerken") : `${tx("Taak toevoegen")} · ${tx(DAY_LABELS[day])}`}>
        <div className="field">
          <label>{tx("Tijdstip")}</label>
          <input className="input" type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
        </div>
        <div className="field">
          <label>{tx("Omschrijving")}</label>
          <input className="input" type="text" placeholder={tx("bv. Ontbijt")} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
        </div>
        <div className="field">
          <label>{tx("Soort")}</label>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' }}>
            {TASK_CATEGORIES.map((c) => (
              <button key={c} type="button" className={`chip${form.category === c ? ' selected' : ''}`} onClick={() => setForm((f) => ({ ...f, category: c }))}>
                {tx(CAT_LABELS[c] || c)}
              </button>
            ))}
          </div>
        </div>
        <div className="row" style={{ gap: 12, marginBottom: 18 }}>
          <span style={{ flex: 1, fontWeight: 600 }}>{tx("Melding op dit tijdstip")}</span>
          <button type="button" className={`switch${form.notify ? ' on' : ''}`} aria-pressed={form.notify} aria-label={tx("Melding op dit tijdstip")} onClick={() => setForm((f) => ({ ...f, notify: !f.notify }))} />
        </div>
        <button className="btn btn-primary btn-block" disabled={!form.label.trim()} onClick={saveTask}>{tx("Opslaan")}</button>
        {taskSheet?.task && (
          <button type="button" className="btn btn-ghost btn-block" style={{ marginTop: 8, color: 'var(--danger)' }} onClick={() => { setToDelete(taskSheet.task.id); setTaskSheet(null) }}>
            {tx("Taak verwijderen")}
          </button>
        )}
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        title={tx("Taak verwijderen?")}
        message={tx("Deze taak verdwijnt elke week van deze dag.")}
        confirmLabel={tx("Verwijderen")}
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { removeTaskFromDay(day, toDelete); setToDelete(null) }}
      />
    </div>
  )
}
