import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayKey, addDaysToKey } from '../utils/dates'
import { streakFromDateSet } from '../utils/streaks'
import { getTasksForDate, getMealsForDate, getAppointmentsForDate, computeDayScore, dayMeetsThreshold } from '../utils/taskSchedule'
import { MEAL_SLOTS, MEAL_SLOT_LABELS } from '../utils/pantry'
import Ring from './Ring'
import StreakBadge from './StreakBadge'
import Icon from './Icon'
import DayReplanSheet from './DayReplanSheet'

const CATEGORY_ICON = {
  eten: 'utensils',
  'eten+supplement': 'utensils',
  training: 'dumbbell',
  supplement: 'apple',
  herstel: 'moon',
  werk: 'timer',
  zelfzorg: 'heart',
}

// Streak over the last year of local calendar days that clear the
// threshold — bounded lookback so a fresh install (no history yet) doesn't
// walk back to year 1 checking increasingly-empty days.
function computeTaskStreak(taskSchedule, taskCompletions, thresholdPct, dayOverrides) {
  const dateSet = new Set()
  let key = todayKey()
  for (let i = 0; i < 365; i++) {
    if (dayMeetsThreshold(taskSchedule, taskCompletions, key, thresholdPct, dayOverrides)) dateSet.add(key)
    key = addDaysToKey(key, -1)
  }
  return streakFromDateSet(dateSet)
}

const linkButtonStyle = { background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 13.5, fontWeight: 600 }

export default function TodayTasks({ onOpenSchedule, onOpenPantry }) {
  const { data, toggleTask } = useApp()
  const [replanOpen, setReplanOpen] = useState(false)
  const today = todayKey()
  const tasks = getTasksForDate(data.taskSchedule, today, data.dayOverrides)
  const appointments = getAppointmentsForDate(data.dayOverrides, today)
  const isReplanned = !!data.dayOverrides?.[today]?.tasks
  const completionsToday = data.taskCompletions[today] || {}
  const score = computeDayScore(tasks, completionsToday)
  const threshold = data.settings.streakThresholdPct
  const streak = computeTaskStreak(data.taskSchedule, data.taskCompletions, threshold, data.dayOverrides)
  const mealInfo = getMealsForDate(data.mealRotation, today, data.dayOverrides)

  const { sleepScore, readinessScore, activeCalories } = data.ouraStatus || {}
  const hasOuraData = sleepScore != null || readinessScore != null || activeCalories != null
  const heavyTrainingToday = tasks.some((t) => t.category === 'training')
  const lowReadinessWarning = typeof readinessScore === 'number' && readinessScore < 60 && heavyTrainingToday

  if (!tasks.length) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <div>
            <div className="section-title" style={{ marginTop: 0 }}>Vandaag</div>
            <p className="text-sm faint">Nog geen taken ingesteld voor vandaag.</p>
          </div>
          {onOpenSchedule && (
            <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }} onClick={onOpenSchedule}>
              Schema instellen
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="section-title" style={{ marginTop: 0 }}>Vandaag</div>
          <StreakBadge days={streak} label={`dagen boven ${threshold}%`} />
        </div>
        <Ring value={score / 100} size={64} stroke={7}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{score}%</span>
        </Ring>
      </div>

      {mealInfo?.meals && (
        <div className="text-sm faint" style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 8, rowGap: 2 }}>
          {MEAL_SLOTS.filter((slot) => mealInfo.meals[slot]).map((slot) => (
            <span key={slot} style={{ display: 'contents' }}>
              <span>{MEAL_SLOT_LABELS[slot]}</span>
              <span style={{ color: mealInfo.swapped.includes(slot) ? 'var(--text)' : undefined }}>
                {mealInfo.meals[slot]}{mealInfo.swapped.includes(slot) ? ' (gewisseld)' : ''}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="row" style={{ gap: 16, marginTop: 10, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <button style={linkButtonStyle} onClick={() => setReplanOpen(true)}>
          {isReplanned ? 'Aangepaste dag bewerken' : '+ Afspraak / dag aanpassen'}
        </button>
        {onOpenPantry && <button style={linkButtonStyle} onClick={onOpenPantry}>Niet naar de winkel? Menu aanpassen</button>}
      </div>
      <DayReplanSheet open={replanOpen} onClose={() => setReplanOpen(false)} />

      {hasOuraData && (
        <div className="row" style={{ gap: 14, marginTop: 10, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          {sleepScore != null && <span className="text-sm faint">Slaap {sleepScore}</span>}
          {readinessScore != null && <span className="text-sm faint">Readiness {readinessScore}</span>}
          {activeCalories != null && <span className="text-sm faint">{activeCalories} kcal actief</span>}
        </div>
      )}
      {lowReadinessWarning && (
        <div className="text-sm" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)' }}>
          Lage readiness ({readinessScore}) + training gepland vandaag — overweeg lichter te trainen.
        </div>
      )}

      {/* A divided list, not a stack of individually-boxed pills — the
          same "wall of same-weight boxes" fix already used on Overview's
          hero card and the More page, applied here too since a daily
          checklist repeats this pattern the most (8+ rows, every day). A
          thin gold left-accent marks a completed row instead of filling
          the whole row with color, which reads calmer/more considered
          than a solid-block "done" state. */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column' }}>
        {[...tasks.map((t) => ({ kind: 'task', time: t.time, item: t })), ...appointments.map((a) => ({ kind: 'appt', time: a.start, item: a }))]
          .sort((a, b) => a.time.localeCompare(b.time) || (a.kind === 'appt' ? -1 : 1))
          .map(({ kind, item: t }, i) => {
          if (kind === 'appt') {
            return (
              <div
                key={t.id}
                className="row"
                style={{ gap: 10, padding: '12px 4px 12px 11px', borderTop: i > 0 ? '1px solid var(--border-soft)' : 'none', borderLeft: '2px solid transparent', justifyContent: 'flex-start' }}
              >
                <span aria-hidden className="faint" style={{ width: 18, flexShrink: 0 }} />
                <span aria-hidden className="faint" style={{ flexShrink: 0 }}><Icon name="calendar" size={16} /></span>
                <span className="mono faint" style={{ fontSize: 12.5 }}>{t.start}–{t.end}</span>
                <span style={{ flex: 1, fontStyle: 'italic' }}>
                  {t.title}{t.location ? ` · ${t.location}` : ''}
                  {(Number(t.travelBefore) > 0 || Number(t.travelAfter) > 0) && <span className="faint text-sm"> (reistijd {t.travelBefore || 0}/{t.travelAfter || 0} min)</span>}
                </span>
              </div>
            )
          }
          const done = !!completionsToday[t.id]
          return (
            <label
              key={t.id}
              className={`row${done ? ' task-row-done' : ''}`}
              style={{
                gap: 10, padding: '12px 4px 12px 11px', cursor: 'pointer',
                borderTop: i > 0 ? '1px solid var(--border-soft)' : 'none',
                borderLeft: `2px solid ${done ? 'var(--accent-ring)' : 'transparent'}`,
                justifyContent: 'flex-start',
              }}
            >
              <input
                type="checkbox"
                checked={done}
                onChange={() => toggleTask(today, t.id)}
                style={{ width: 18, height: 18, accentColor: 'var(--accent-ring)', flexShrink: 0 }}
              />
              <span aria-hidden className="faint" style={{ flexShrink: 0 }}>
                <Icon name={CATEGORY_ICON[t.category] || 'check'} size={16} />
              </span>
              <span className="mono faint" style={{ fontSize: 12.5 }}>{t.time}</span>
              <span style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.55 : 1, flex: 1, fontWeight: done ? 500 : 600 }}>{t.label}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
