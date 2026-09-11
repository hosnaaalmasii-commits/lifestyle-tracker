import { useApp } from '../context/AppContext'
import { todayKey, addDaysToKey } from '../utils/dates'
import { streakFromDateSet } from '../utils/streaks'
import { getTasksForDate, getMealsForDate, computeDayScore, dayMeetsThreshold } from '../utils/taskSchedule'
import Ring from './Ring'
import StreakBadge from './StreakBadge'
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

// Streak over the last year of local calendar days that clear the
// threshold — bounded lookback so a fresh install (no history yet) doesn't
// walk back to year 1 checking increasingly-empty days.
function computeTaskStreak(taskSchedule, taskCompletions, thresholdPct) {
  const dateSet = new Set()
  let key = todayKey()
  for (let i = 0; i < 365; i++) {
    if (dayMeetsThreshold(taskSchedule, taskCompletions, key, thresholdPct)) dateSet.add(key)
    key = addDaysToKey(key, -1)
  }
  return streakFromDateSet(dateSet)
}

export default function TodayTasks({ onOpenSchedule }) {
  const { data, toggleTask } = useApp()
  const today = todayKey()
  const tasks = getTasksForDate(data.taskSchedule, today)
  const completionsToday = data.taskCompletions[today] || {}
  const score = computeDayScore(tasks, completionsToday)
  const threshold = data.settings.streakThresholdPct
  const streak = computeTaskStreak(data.taskSchedule, data.taskCompletions, threshold)
  const mealInfo = getMealsForDate(data.mealRotation, today)

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
        <div className="text-sm faint" style={{ marginTop: 8 }}>
          Menu week {mealInfo.letter}: {mealInfo.meals.ontbijt}
        </div>
      )}

      <div className="stack" style={{ marginTop: 14, gap: 8 }}>
        {tasks.map((t) => {
          const done = !!completionsToday[t.id]
          return (
            <label
              key={t.id}
              className="row"
              style={{
                gap: 10, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                background: done ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--surface-soft)',
                justifyContent: 'flex-start',
              }}
            >
              <input
                type="checkbox"
                checked={done}
                onChange={() => toggleTask(today, t.id)}
                style={{ width: 18, height: 18, accentColor: 'var(--accent)', flexShrink: 0 }}
              />
              <span aria-hidden className="faint" style={{ flexShrink: 0 }}>
                <Icon name={CATEGORY_ICON[t.category] || 'check'} size={16} />
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }} className="faint">{t.time}</span>
              <span style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1, flex: 1 }}>{t.label}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
