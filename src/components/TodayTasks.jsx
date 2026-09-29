import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayKey } from '../utils/dates'
import { getTasksForDate, getAppointmentsForDate } from '../utils/taskSchedule'
import Icon from './Icon'
import { useT } from '../i18n/useT'

const VISIBLE_ROWS = 5

// Today's checklist exactly as in the Richting E mockup: a dot, the time,
// the task — nothing else per row. Shows the few rows around "now" by
// default (one done task for context, then what's next); "Toon alles"
// expands the full day.
export default function TodayTasks({ onOpenSchedule }) {
  const { data, toggleTask } = useApp()
  const [expanded, setExpanded] = useState(false)
  const { t } = useT()
  const today = todayKey()
  const tasks = getTasksForDate(data.taskSchedule, today, data.dayOverrides)
  const appointments = getAppointmentsForDate(data.dayOverrides, today)
  const completionsToday = data.taskCompletions[today] || {}

  if (!tasks.length) {
    return (
      <div className="card">
        <div className="row">
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{t('tasks.title')}</div>
            <p className="text-sm faint">{t('tasks.none')}</p>
          </div>
          {onOpenSchedule && <button className="btn btn-secondary btn-sm" onClick={onOpenSchedule}>{t('tasks.setup')}</button>}
        </div>
      </div>
    )
  }

  const rows = [
    ...tasks.map((x) => ({ kind: "task", time: x.time, item: x })),
    ...appointments.map((a) => ({ kind: 'appt', time: a.start, item: a })),
  ].sort((a, b) => a.time.localeCompare(b.time) || (a.kind === 'appt' ? -1 : 1))

  const firstOpen = rows.findIndex((r) => r.kind === 'task' && !completionsToday[r.item.id])
  const start = expanded || firstOpen < 0 ? 0 : Math.max(0, Math.min(firstOpen - 1, rows.length - VISIBLE_ROWS))
  const shown = expanded ? rows : rows.slice(start, start + VISIBLE_ROWS)
  const hidden = rows.length - shown.length

  return (
    <div className="card" style={{ padding: '18px 18px 8px' }}>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 2 }}>{t('tasks.title')}</div>

      {shown.map(({ kind, item }) => {
        const task = item
        if (kind === 'appt') {
          return (
            <div key={task.id} className="row" style={{ gap: 12, padding: '10px 0', justifyContent: 'flex-start' }}>
              <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: '1.5px solid var(--second)' }} />
              <span className="faint" style={{ fontSize: 13, fontWeight: 500 }}>{task.start}</span>
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{task.title}{task.location ? <span className="faint" style={{ fontWeight: 400 }}> · {task.location}</span> : null}</span>
            </div>
          )
        }
        const done = !!completionsToday[task.id]
        return (
          <button
            key={task.id}
            className={`row${done ? ' task-row-done' : ''}`}
            onClick={() => toggleTask(today, task.id)}
            style={{ width: '100%', gap: 12, padding: '10px 0', justifyContent: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <span
              aria-hidden
              style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--accent)' : 'transparent',
                border: done ? 'none' : '1.5px solid color-mix(in srgb, var(--text) 28%, transparent)',
                color: 'var(--accent-contrast)',
              }}
            >
              {done && <Icon name="check" size={12} />}
            </span>
            <span className="faint" style={{ fontSize: 13, fontWeight: 500 }}>{task.time}</span>
            <span style={{ flex: 1, fontSize: 15, fontWeight: done ? 400 : 600, color: done ? 'var(--text-faint)' : 'var(--text)', textDecoration: done ? 'line-through' : 'none' }}>
              {task.label}
            </span>
          </button>
        )
      })}

      {(hidden > 0 || expanded) && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '8px 0 10px' }}
        >
          {expanded ? t('tasks.showLess') : t('tasks.showAll', { n: rows.length })}
        </button>
      )}
    </div>
  )
}
