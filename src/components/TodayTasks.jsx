import { useApp } from '../context/AppContext'
import { todayKey } from '../utils/dates'
import { getTasksForDate, getMealsForDate, getAppointmentsForDate } from '../utils/taskSchedule'
import { MEAL_SLOTS, MEAL_SLOT_LABELS } from '../utils/pantry'
import Icon from './Icon'

const CATEGORY_ICON = {
  eten: 'utensils',
  'eten+supplement': 'utensils',
  training: 'dumbbell',
  supplement: 'apple',
  herstel: 'moon',
  werk: 'timer',
  zelfzorg: 'heart',
}

// Today's checklist (tasks + appointments interleaved) and menu. The day
// score ring and streak live in Overview's hero card above this; the
// replan sheet is owned by Overview too, so its "+ Afspraak" chip and the
// link here open the same sheet.
export default function TodayTasks({ onOpenSchedule, onOpenPantry, onOpenReplan }) {
  const { data, toggleTask } = useApp()
  const today = todayKey()
  const tasks = getTasksForDate(data.taskSchedule, today, data.dayOverrides)
  const appointments = getAppointmentsForDate(data.dayOverrides, today)
  const isReplanned = !!data.dayOverrides?.[today]?.tasks
  const completionsToday = data.taskCompletions[today] || {}
  const mealInfo = getMealsForDate(data.mealRotation, today, data.dayOverrides)

  const { sleepScore, readinessScore, activeCalories } = data.ouraStatus || {}
  const hasOuraData = sleepScore != null || readinessScore != null || activeCalories != null
  const heavyTrainingToday = tasks.some((t) => t.category === 'training')
  const lowReadinessWarning = typeof readinessScore === 'number' && readinessScore < 60 && heavyTrainingToday

  if (!tasks.length) {
    return (
      <div className="card">
        <div className="row">
          <div>
            <div className="section-title" style={{ marginTop: 0, marginBottom: 4 }}>Vandaag</div>
            <p className="text-sm faint">Nog geen taken ingesteld voor vandaag.</p>
          </div>
          {onOpenSchedule && <button className="btn btn-secondary btn-sm" onClick={onOpenSchedule}>Schema instellen</button>}
        </div>
      </div>
    )
  }

  const rows = [
    ...tasks.map((t) => ({ kind: 'task', time: t.time, item: t })),
    ...appointments.map((a) => ({ kind: 'appt', time: a.start, item: a })),
  ].sort((a, b) => a.time.localeCompare(b.time) || (a.kind === 'appt' ? -1 : 1))

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 4 }}>
        <div className="section-title" style={{ margin: 0 }}>Vandaag</div>
        {onOpenReplan && (
          <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13.5, fontWeight: 700 }} onClick={onOpenReplan}>
            {isReplanned ? 'Aangepast · bewerk' : '+ Afspraak'}
          </button>
        )}
      </div>

      {hasOuraData && (
        <div className="row" style={{ gap: 14, marginTop: 6, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          {sleepScore != null && <span className="text-sm faint">Slaap {sleepScore}</span>}
          {readinessScore != null && <span className="text-sm faint">Readiness {readinessScore}</span>}
          {activeCalories != null && <span className="text-sm faint">{activeCalories} kcal actief</span>}
        </div>
      )}
      {lowReadinessWarning && (
        <div className="text-sm" style={{ marginTop: 8, padding: '8px 12px', borderRadius: 12, background: 'color-mix(in srgb, var(--danger) 14%, transparent)', color: 'var(--danger)' }}>
          Lage readiness ({readinessScore}) + training gepland vandaag — overweeg lichter te trainen.
        </div>
      )}

      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column' }}>
        {rows.map(({ kind, item: t }, i) => {
          const divider = i > 0 ? '1px solid var(--border-soft)' : 'none'
          if (kind === 'appt') {
            return (
              <div key={t.id} className="row" style={{ gap: 12, padding: '12px 0', borderTop: divider, justifyContent: 'flex-start' }}>
                <span aria-hidden style={{ width: 22, display: 'flex', justifyContent: 'center', color: 'var(--second)', flexShrink: 0 }}><Icon name="calendar" size={16} /></span>
                <span className="text-sm faint" style={{ minWidth: 44 }}>{t.start}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600 }}>{t.title}</span>
                  <span className="text-sm faint"> · tot {t.end}{t.location ? ` · ${t.location}` : ''}</span>
                </span>
              </div>
            )
          }
          const done = !!completionsToday[t.id]
          return (
            <label
              key={t.id}
              className={`row${done ? ' task-row-done' : ''}`}
              style={{ gap: 12, padding: '12px 0', cursor: 'pointer', borderTop: divider, justifyContent: 'flex-start' }}
            >
              <input type="checkbox" checked={done} onChange={() => toggleTask(today, t.id)} style={{ display: 'none' }} />
              <span
                aria-hidden
                style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? 'var(--accent)' : 'transparent',
                  border: done ? 'none' : '1.5px solid color-mix(in srgb, var(--text) 30%, transparent)',
                  color: 'var(--accent-contrast)',
                }}
              >
                {done && <Icon name="check" size={13} />}
              </span>
              <span className="text-sm faint" style={{ minWidth: 44 }}>{t.time}</span>
              <span style={{ flex: 1, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text-faint)' : 'var(--text)', fontWeight: done ? 500 : 600 }}>{t.label}</span>
              <span aria-hidden className="faint" style={{ flexShrink: 0 }}><Icon name={CATEGORY_ICON[t.category] || 'check'} size={15} /></span>
            </label>
          )
        })}
      </div>

      {mealInfo?.meals && (
        <div style={{ marginTop: 10, paddingTop: 12, borderTop: '1px solid var(--border-soft)' }}>
          <div className="row" style={{ marginBottom: 6 }}>
            <span className="text-sm faint" style={{ fontWeight: 600 }}>Menu week {mealInfo.letter}</span>
            {onOpenPantry && <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }} onClick={onOpenPantry}>Aanpassen</button>}
          </div>
          <div className="text-sm" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 10, rowGap: 3 }}>
            {MEAL_SLOTS.filter((slot) => mealInfo.meals[slot]).map((slot) => (
              <span key={slot} style={{ display: 'contents' }}>
                <span className="faint">{MEAL_SLOT_LABELS[slot]}</span>
                <span style={{ color: mealInfo.swapped.includes(slot) ? 'var(--second)' : 'var(--text-soft)' }}>
                  {mealInfo.meals[slot]}{mealInfo.swapped.includes(slot) ? ' (gewisseld)' : ''}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
