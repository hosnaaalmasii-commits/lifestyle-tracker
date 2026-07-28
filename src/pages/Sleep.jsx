import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayKey, lastNDayKeys, humanDate } from '../utils/dates'
import { streakFromDateSet } from '../utils/streaks'
import Ring from '../components/Ring'
import StreakBadge from '../components/StreakBadge'
import WeeklyBarChart from '../components/WeeklyBarChart'
import Sheet from '../components/Sheet'

const QUALITY_LABELS = ['Rough', 'Poor', 'Okay', 'Good', 'Great']

export default function Sleep() {
  const { data, logSleep, setSleepGoal } = useApp()
  const [logOpen, setLogOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const [hours, setHours] = useState(8)
  const [quality, setQuality] = useState(3)
  const [customGoal, setCustomGoal] = useState(data.settings.sleepGoalHours)

  const today = todayKey()
  const goal = data.settings.sleepGoalHours
  const todayEntry = data.sleep[today]
  const ratio = todayEntry ? Math.min(1, todayEntry.hours / goal) : 0

  const weekKeys = lastNDayKeys(7)
  const weekValues = weekKeys.map((k) => ({ key: k, value: data.sleep[k]?.hours || 0 }))

  const streak = streakFromDateSet(new Set(Object.entries(data.sleep).filter(([, s]) => s.hours >= goal).map(([k]) => k)))

  const openLog = () => {
    setHours(todayEntry?.hours ?? 8)
    setQuality(todayEntry?.quality ?? 3)
    setLogOpen(true)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">Sleep</div>
        <h1>Rest &amp; recovery</h1>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '26px 18px' }}>
        <Ring value={ratio} size={160} stroke={15} color="var(--accent-sleep)">
          <div className="mono" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
            {todayEntry ? todayEntry.hours : '—'}
          </div>
          <div className="text-sm muted" style={{ marginTop: 4 }}>of {goal}h goal</div>
        </Ring>

        {todayEntry && (
          <div className="text-sm muted" style={{ marginTop: 14 }}>
            Quality: <strong style={{ color: 'var(--text)' }}>{QUALITY_LABELS[todayEntry.quality - 1]}</strong>
          </div>
        )}

        <div className="row" style={{ marginTop: 16, gap: 10 }}>
          <button className="btn btn-primary btn-sm" onClick={openLog}>
            {todayEntry ? 'Edit last night' : 'Log last night'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setCustomGoal(goal); setGoalOpen(true) }}>Edit goal</button>
        </div>
      </div>

      <div className="row" style={{ marginTop: 20, marginBottom: 4 }}>
        <div className="section-title" style={{ margin: 0 }}>This week</div>
        <StreakBadge days={streak} />
      </div>
      <div className="card">
        <WeeklyBarChart values={weekValues} goal={goal} color="var(--accent-sleep)" formatValue={(v) => `${v} h`} />
      </div>

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title={`Sleep — ${humanDate(today)}`}>
        <div className="field">
          <label>Hours slept</label>
          <div className="stepper">
            <button onClick={() => setHours((h) => Math.max(0, Math.round((h - 0.5) * 2) / 2))}>−</button>
            <span className="value">{hours}</span>
            <button onClick={() => setHours((h) => Math.min(14, Math.round((h + 0.5) * 2) / 2))}>+</button>
          </div>
        </div>
        <div className="field">
          <label>Quality</label>
          <div className="row" style={{ gap: 8 }}>
            {[1, 2, 3, 4, 5].map((q) => (
              <button
                key={q}
                className="chip"
                style={{ flex: 1, justifyContent: 'center', padding: '10px 0' }}
                onClick={() => setQuality(q)}
              >
                <span style={{
                  width: 10, height: 10, borderRadius: '50%', display: 'inline-block',
                  background: q <= quality ? 'var(--accent-sleep)' : 'var(--border)',
                }} />
              </button>
            ))}
          </div>
          <div className="text-sm muted" style={{ marginTop: 8, textAlign: 'center' }}>{QUALITY_LABELS[quality - 1]}</div>
        </div>
        <button
          className="btn btn-primary btn-block"
          onClick={() => { logSleep(today, hours, quality); setLogOpen(false) }}
        >
          Save
        </button>
      </Sheet>

      <Sheet open={goalOpen} onClose={() => setGoalOpen(false)} title="Sleep goal">
        <div className="field">
          <label>Hours per night</label>
          <div className="stepper">
            <button onClick={() => setCustomGoal((h) => Math.max(4, h - 0.5))}>−</button>
            <span className="value">{customGoal}</span>
            <button onClick={() => setCustomGoal((h) => Math.min(12, h + 0.5))}>+</button>
          </div>
        </div>
        <button
          className="btn btn-primary btn-block"
          onClick={() => { setSleepGoal(customGoal); setGoalOpen(false) }}
        >
          Save goal
        </button>
      </Sheet>
    </div>
  )
}
