import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayKey, currentWeekKeys, weekdayShort, isToday, humanDate } from '../utils/dates'
import { streakFromDateSet } from '../utils/streaks'
import { GOAL_OPTIONS, EXPERIENCE_OPTIONS, FOCUS_OPTIONS } from '../utils/workoutGenerator'
import StreakBadge from '../components/StreakBadge'
import Sheet from '../components/Sheet'

export default function Workouts() {
  const { data, setWorkoutProfile, toggleWorkoutDay } = useApp()
  const { profile, schedule, completions } = data.workouts

  if (!profile) {
    return <Questionnaire onSubmit={setWorkoutProfile} />
  }

  return (
    <WorkoutPlan
      schedule={schedule}
      completions={completions}
      onToggle={toggleWorkoutDay}
      onEditPlan={() => setWorkoutProfile(null)}
      profile={profile}
      setWorkoutProfile={setWorkoutProfile}
    />
  )
}

function Questionnaire({ onSubmit, initial }) {
  const [goal, setGoal] = useState(initial?.goal || 'muscle')
  const [experience, setExperience] = useState(initial?.experience || 'beginner')
  const [focusAreas, setFocusAreas] = useState(initial?.focusAreas || ['chest', 'back', 'legs'])
  const [daysPerWeek, setDaysPerWeek] = useState(initial?.daysPerWeek || 3)

  const toggleFocus = (v) => {
    setFocusAreas((prev) => prev.includes(v) ? prev.filter((f) => f !== v) : [...prev, v])
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">Workouts</div>
        <h1>Build your plan</h1>
        <p className="muted text-sm" style={{ marginTop: 6 }}>Answer a few questions and we'll put together a weekly schedule.</p>
      </div>

      <div className="section-title">Primary goal</div>
      <div className="scroll-x">
        {GOAL_OPTIONS.map((o) => (
          <button key={o.value} className={`chip${goal === o.value ? ' selected' : ''}`} onClick={() => setGoal(o.value)}>{o.label}</button>
        ))}
      </div>

      <div className="section-title">Experience level</div>
      <div className="scroll-x">
        {EXPERIENCE_OPTIONS.map((o) => (
          <button key={o.value} className={`chip${experience === o.value ? ' selected' : ''}`} onClick={() => setExperience(o.value)}>{o.label}</button>
        ))}
      </div>

      <div className="section-title">Focus areas</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {FOCUS_OPTIONS.map((o) => (
          <button key={o.value} className={`chip${focusAreas.includes(o.value) ? ' selected' : ''}`} onClick={() => toggleFocus(o.value)}>{o.label}</button>
        ))}
      </div>

      <div className="section-title">Days per week</div>
      <div className="stepper">
        <button onClick={() => setDaysPerWeek((d) => Math.max(2, d - 1))}>−</button>
        <span className="value">{daysPerWeek}</span>
        <button onClick={() => setDaysPerWeek((d) => Math.min(6, d + 1))}>+</button>
      </div>

      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 28 }}
        disabled={focusAreas.length === 0}
        onClick={() => onSubmit({ goal, experience, focusAreas, daysPerWeek })}
      >
        Generate my schedule
      </button>
    </div>
  )
}

function WorkoutPlan({ schedule, completions, onToggle, onEditPlan, profile, setWorkoutProfile }) {
  const [dayOpen, setDayOpen] = useState(null) // date key
  const [editing, setEditing] = useState(false)
  const today = todayKey()
  const weekKeys = currentWeekKeys()

  const doneDates = new Set(Object.keys(completions).filter((k) => completions[k]))
  const streak = streakFromDateSet(doneDates)

  const dayFor = (dateKey) => {
    const wd = weekdayShort(dateKey)
    return schedule.find((s) => s.day === wd)
  }

  const todaysWorkout = dayFor(today)
  const openDay = dayOpen ? dayFor(dayOpen) : null

  if (editing) {
    return <Questionnaire initial={profile} onSubmit={(p) => { setWorkoutProfile(p); setEditing(false) }} />
  }

  return (
    <div className="page">
      <div className="page-header row" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="eyebrow">Workouts</div>
          <h1>This week</h1>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit plan</button>
      </div>

      <div className="card">
        <div className="row">
          <div>
            <div className="text-sm muted" style={{ fontWeight: 600 }}>Today</div>
            <h3 style={{ fontSize: 19, marginTop: 4 }}>{todaysWorkout?.rest ? 'Rest day' : todaysWorkout?.label}</h3>
          </div>
          <StreakBadge days={streak} />
        </div>
        {!todaysWorkout?.rest && (
          <>
            <div style={{ marginTop: 14 }}>
              {todaysWorkout?.exercises.map((ex) => (
                <div key={ex.name} className="row" style={{ padding: '7px 0', borderTop: '1px solid var(--border-soft)' }}>
                  <span className="text-sm">{ex.name}</span>
                  <span className="mono text-sm faint">{ex.sets}×{ex.reps}</span>
                </div>
              ))}
            </div>
            <button
              className={`btn btn-block ${completions[today] ? 'btn-secondary' : 'btn-primary'}`}
              style={{ marginTop: 16 }}
              onClick={() => onToggle(today)}
            >
              {completions[today] ? '✓ Completed' : 'Mark complete'}
            </button>
          </>
        )}
        {todaysWorkout?.rest && <p className="muted text-sm" style={{ marginTop: 8 }}>No training scheduled — recovery is part of the plan too.</p>}
      </div>

      <div className="section-title">Weekly schedule</div>
      <div className="stack">
        {weekKeys.map((k) => {
          const w = dayFor(k)
          const done = !!completions[k]
          return (
            <button key={k} className="card" style={{ textAlign: 'left', cursor: 'pointer', padding: '14px 16px' }} onClick={() => setDayOpen(k)}>
              <div className="row">
                <div className="row" style={{ gap: 12, justifyContent: 'flex-start' }}>
                  <div style={{
                    width: 38, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12,
                    color: isToday(k) ? 'var(--accent-workout)' : 'var(--text-faint)', fontWeight: 700,
                  }}>
                    {weekdayShort(k)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{w?.rest ? 'Rest' : w?.label}</div>
                    <div className="text-sm faint">{humanDate(k)}</div>
                  </div>
                </div>
                {!w?.rest && (
                  <span
                    role="checkbox"
                    aria-checked={done}
                    onClick={(e) => { e.stopPropagation(); onToggle(k) }}
                    style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${done ? 'var(--accent-workout)' : 'var(--border)'}`,
                      background: done ? 'var(--accent-workout)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 13, transition: 'all 0.15s ease',
                    }}
                  >
                    {done ? '✓' : ''}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <Sheet open={!!dayOpen} onClose={() => setDayOpen(null)} title={openDay ? `${openDay.rest ? 'Rest' : openDay.label} — ${dayOpen && humanDate(dayOpen)}` : ''}>
        {openDay && !openDay.rest && (
          <>
            {openDay.note && <p className="muted text-sm" style={{ marginBottom: 14 }}>{openDay.note}</p>}
            <div className="stack">
              {openDay.exercises.map((ex) => (
                <div key={ex.name} className="row">
                  <span className="text-sm">{ex.name}</span>
                  <span className="mono text-sm faint">{ex.sets}×{ex.reps} · {ex.rest}</span>
                </div>
              ))}
            </div>
            <button
              className={`btn btn-block ${dayOpen && completions[dayOpen] ? 'btn-secondary' : 'btn-primary'}`}
              style={{ marginTop: 18 }}
              onClick={() => onToggle(dayOpen)}
            >
              {dayOpen && completions[dayOpen] ? '✓ Completed' : 'Mark complete'}
            </button>
          </>
        )}
        {openDay?.rest && <p className="muted text-sm">Recovery day — no exercises scheduled.</p>}
      </Sheet>
    </div>
  )
}
