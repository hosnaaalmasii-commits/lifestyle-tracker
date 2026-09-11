import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { WEEKDAY_KEYS, TASK_CATEGORIES } from '../../utils/taskSchedule'
import { isPushSupported } from '../../utils/push'
import BackHeader from '../../components/BackHeader'
import Sheet from '../../components/Sheet'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'

const DAY_LABELS = { mon: 'Maandag', tue: 'Dinsdag', wed: 'Woensdag', thu: 'Donderdag', fri: 'Vrijdag', sat: 'Zaterdag', sun: 'Zondag' }
const MEAL_KEYS = ['ontbijt', 'lunch', 'diner', 'snack']
const MEAL_LABELS = { ontbijt: 'Ontbijt', lunch: 'Lunch', diner: 'Diner', snack: 'Snack' }

function emptyTaskForm() {
  return { time: '07:00', label: '', category: 'eten', notify: true }
}

export default function DailySchedule({ onBack }) {
  const {
    data, sync, addTaskToDay, updateTaskInDay, removeTaskFromDay,
    setMealForDay, setStreakThreshold, setNotifyCategory,
    enablePushNotifications, disablePushNotifications,
  } = useApp()

  const [openDay, setOpenDay] = useState('mon')
  const [mealWeek, setMealWeek] = useState(data.mealRotation?.cycle?.[0] || 'A')
  const [taskSheet, setTaskSheet] = useState(null) // { day, task | null }
  const [form, setForm] = useState(emptyTaskForm())
  const [toDelete, setToDelete] = useState(null) // { day, id }
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState(null)

  const handlePushToggle = async () => {
    setPushError(null)
    setPushBusy(true)
    try {
      if (data.settings.pushEnabled) await disablePushNotifications()
      else await enablePushNotifications()
    } catch (e) {
      setPushError(e.message)
    } finally {
      setPushBusy(false)
    }
  }

  const openAddTask = (day) => {
    setForm(emptyTaskForm())
    setTaskSheet({ day, task: null })
  }
  const openEditTask = (day, task) => {
    setForm({ time: task.time, label: task.label, category: task.category, notify: task.notify })
    setTaskSheet({ day, task })
  }
  const saveTask = () => {
    if (!form.label.trim()) return
    if (taskSheet.task) {
      updateTaskInDay(taskSheet.day, taskSheet.task.id, { ...form, label: form.label.trim() })
    } else {
      addTaskToDay(taskSheet.day, { ...form, label: form.label.trim() })
    }
    setTaskSheet(null)
  }

  const mealRotation = data.mealRotation
  const cycle = mealRotation?.cycle || []

  return (
    <div className="page">
      <BackHeader eyebrow="More" title="Dagschema & Menu" onBack={onBack} />

      <div className="section-title" style={{ marginTop: 0 }}>Streak & meldingen</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Streak-drempel (% van taken afgevinkt om te tellen)</label>
          <input
            className="input" type="number" min={0} max={100}
            value={data.settings.streakThresholdPct}
            onChange={(e) => setStreakThreshold(Math.max(0, Math.min(100, Number(e.target.value))))}
          />
        </div>
        <div className="field">
          <label>Pushmeldingen op dit apparaat</label>
          {!isPushSupported() ? (
            <p className="text-sm faint">Niet ondersteund in deze browser.</p>
          ) : !sync.signedIn ? (
            <p className="text-sm faint">Log eerst in bij Cloud Sync (More → Settings) — pushmeldingen hebben een account nodig.</p>
          ) : (
            <>
              <button className={`btn btn-sm ${data.settings.pushEnabled ? 'btn-secondary' : 'btn-primary'}`} onClick={handlePushToggle} disabled={pushBusy}>
                {pushBusy ? 'Bezig…' : data.settings.pushEnabled ? 'Meldingen uitschakelen op dit apparaat' : 'Meldingen inschakelen op dit apparaat'}
              </button>
              {pushError && <p className="text-sm" style={{ color: 'var(--danger)', marginTop: 6 }}>{pushError}</p>}
            </>
          )}
        </div>
        <div className="field">
          <label>Meldingen per categorie</label>
          <div className="stack" style={{ gap: 8 }}>
            {TASK_CATEGORIES.map((cat) => (
              <label key={cat} className="row" style={{ justifyContent: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!!data.settings.notifyCategories[cat]}
                  onChange={(e) => setNotifyCategory(cat, e.target.checked)}
                  style={{ width: 17, height: 17, accentColor: 'var(--accent)' }}
                />
                <span style={{ textTransform: 'capitalize' }}>{cat}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="section-title">Dagschema</div>
      <div className="stack" style={{ gap: 10, marginBottom: 16 }}>
        {WEEKDAY_KEYS.map((day) => {
          const tasks = [...(data.taskSchedule[day] || [])].sort((a, b) => a.time.localeCompare(b.time))
          const isOpen = openDay === day
          return (
            <div key={day} className="card">
              <button
                className="row"
                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                onClick={() => setOpenDay(isOpen ? null : day)}
              >
                <div style={{ fontWeight: 600 }}>{DAY_LABELS[day]}</div>
                <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                  <span className="text-sm faint">{tasks.length} taken</span>
                  <span style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                    <Icon name="chevronRight" size={16} />
                  </span>
                </div>
              </button>

              {isOpen && (
                <div style={{ marginTop: 12 }}>
                  <div className="stack" style={{ gap: 6 }}>
                    {tasks.map((t) => (
                      <div key={t.id} className="row" style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--surface-soft)' }}>
                        <div>
                          <span className="mono text-sm faint" style={{ marginRight: 8 }}>{t.time}</span>
                          <span>{t.label}</span>
                          <span className="text-sm faint" style={{ marginLeft: 8 }}>· {t.category}{t.notify ? '' : ' · geen melding'}</span>
                        </div>
                        <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                          <button className="btn-ghost" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)' }} onClick={() => openEditTask(day, t)}>Bewerk</button>
                          <button className="btn-ghost" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }} onClick={() => setToDelete({ day, id: t.id })}>Verwijder</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => openAddTask(day)}>+ Taak toevoegen</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {mealRotation && (
        <>
          <div className="section-title">Menurotatie</div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="row" style={{ gap: 6, marginBottom: 12, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
              {cycle.map((w) => (
                <button
                  key={w}
                  className={`btn btn-sm ${mealWeek === w ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMealWeek(w)}
                >
                  Week {w}
                </button>
              ))}
            </div>
            <div className="stack" style={{ gap: 12 }}>
              {WEEKDAY_KEYS.map((day) => (
                <div key={day}>
                  <div className="text-sm faint" style={{ marginBottom: 6, fontWeight: 600 }}>{DAY_LABELS[day]}</div>
                  <div className="stack" style={{ gap: 6 }}>
                    {MEAL_KEYS.map((mealKey) => (
                      <div key={mealKey} className="field" style={{ marginBottom: 0 }}>
                        <label className="text-sm faint">{MEAL_LABELS[mealKey]}</label>
                        <input
                          className="input"
                          value={mealRotation.meals_by_week?.[mealWeek]?.[day]?.[mealKey] || ''}
                          onChange={(e) => setMealForDay(mealWeek, day, mealKey, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Sheet open={!!taskSheet} onClose={() => setTaskSheet(null)} title={taskSheet?.task ? 'Taak bewerken' : 'Taak toevoegen'}>
        <div className="field">
          <label>Tijdstip</label>
          <input className="input" type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
        </div>
        <div className="field">
          <label>Omschrijving</label>
          <input className="input" type="text" placeholder="bv. Ontbijt" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
        </div>
        <div className="field">
          <label>Categorie</label>
          <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <label className="row" style={{ justifyContent: 'flex-start', gap: 10, cursor: 'pointer', marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={form.notify}
            onChange={(e) => setForm((f) => ({ ...f, notify: e.target.checked }))}
            style={{ width: 17, height: 17, accentColor: 'var(--accent)' }}
          />
          <span>Melding sturen op dit tijdstip</span>
        </label>
        <button className="btn btn-primary btn-block" disabled={!form.label.trim()} onClick={saveTask}>Opslaan</button>
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        title="Taak verwijderen?"
        message="Deze taak wordt permanent verwijderd uit het weekschema."
        confirmLabel="Verwijder"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { removeTaskFromDay(toDelete.day, toDelete.id); setToDelete(null) }}
      />
    </div>
  )
}
