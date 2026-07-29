import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayKey, currentWeekKeys, weekdayShort, isToday, humanDate } from '../utils/dates'
import { streakFromDateSet } from '../utils/streaks'
import { GOAL_OPTIONS, EXPERIENCE_OPTIONS, FOCUS_OPTIONS } from '../utils/workoutGenerator'
import { parseRestSeconds } from '../utils/time'
import { TIERS, deriveTiers, suggestTier } from '../utils/workoutTiers'
import { isExerciseFlagged, PAIN_AREAS } from '../utils/painAreas'
import StreakBadge from '../components/StreakBadge'
import Sheet from '../components/Sheet'
import RestTimer from '../components/RestTimer'
import PainCheckIn from '../components/PainCheckIn'
import Icon from '../components/Icon'

export default function Workouts() {
  const {
    data, setWorkoutProfile, toggleWorkoutDay,
    swapExercise, addCustomExercise, removeExercise,
    logExercisePR, deleteExercisePR, setPainAreas, setLowMotivation,
  } = useApp()
  const { profile, schedule, completions, exerciseLogs } = data.workouts

  if (!profile) {
    return <Questionnaire onSubmit={setWorkoutProfile} />
  }

  return (
    <WorkoutPlan
      schedule={schedule}
      completions={completions}
      exerciseLogs={exerciseLogs}
      onToggle={toggleWorkoutDay}
      profile={profile}
      setWorkoutProfile={setWorkoutProfile}
      onSwap={swapExercise}
      onAddExercise={addCustomExercise}
      onRemoveExercise={removeExercise}
      onLogPR={logExercisePR}
      onDeletePR={deleteExercisePR}
      suggestion={suggestTier(data)}
      todayPain={data.painLog[todayKey()] || []}
      onSavePain={(areas) => setPainAreas(todayKey(), areas)}
      lowMotivation={!!data.motivationFlags[todayKey()]}
      onSetLowMotivation={(on) => setLowMotivation(todayKey(), on)}
      calendarStatus={data.calendarStatus}
    />
  )
}

function TierTabs({ value, onChange, suggestedTier }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
      {TIERS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            flex: 1, padding: '8px 4px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            border: `1px solid ${value === t.id ? 'var(--accent-workout)' : 'var(--border)'}`,
            background: value === t.id ? 'color-mix(in srgb, var(--accent-workout) 14%, transparent)' : 'var(--surface-soft)',
            textAlign: 'center', position: 'relative',
          }}
        >
          <div style={{ fontSize: 12.5, fontWeight: 600, color: value === t.id ? 'var(--accent-workout)' : 'var(--text)' }}>
            {t.label}
            {t.id === suggestedTier && (
              <span style={{ marginLeft: 4, color: 'var(--accent-workout)', display: 'inline-flex', verticalAlign: -2 }} title="Suggested">
                <Icon name="sparkle" size={11} />
              </span>
            )}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>{t.minutes}</div>
        </button>
      ))}
    </div>
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

function bestPR(logs) {
  if (!logs || logs.length === 0) return null
  return logs.reduce((best, l) => (l.weight > best.weight || (l.weight === best.weight && l.reps > best.reps)) ? l : best)
}

function ExerciseRow({ day, exercise, index, exerciseLogs, onSwap, onRemove, onOpenTimer, onOpenPR, editable = true, flaggedPainAreas }) {
  const logs = exerciseLogs[exercise.name]
  const pr = bestPR(logs)
  const isFinisher = exercise.name === 'Full-body finisher'
  const isFlagged = isExerciseFlagged(exercise.name, flaggedPainAreas)
  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--border-soft)' }}>
      <div className="row">
        <span className="text-sm" style={{ fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {isFlagged && <span title="Targets an area you flagged today" style={{ color: 'var(--warning)', display: 'inline-flex' }}><Icon name="alertTriangle" size={13} /></span>}
          {exercise.name}
        </span>
        <span className="mono text-sm faint">{exercise.sets}×{exercise.reps}</span>
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <span className="text-sm faint">{pr ? `PR: ${pr.weight}×${pr.reps}` : exercise.rest}</span>
        <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
          {editable && !exercise.custom && (
            <IconButton label="Swap exercise" onClick={() => onSwap(day, index)}><Icon name="repeat" size={14} /></IconButton>
          )}
          <IconButton label="Rest timer" onClick={() => onOpenTimer(exercise)}><Icon name="timer" size={14} /></IconButton>
          {!isFinisher && <IconButton label="Log PR" onClick={() => onOpenPR(exercise)}><Icon name="dumbbell" size={14} /></IconButton>}
          {editable && exercise.custom && (
            <IconButton label="Remove exercise" onClick={() => onRemove(day, index)}><Icon name="trash" size={14} /></IconButton>
          )}
        </div>
      </div>
    </div>
  )
}

function IconButton({ children, label, onClick }) {
  return (
    <button
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{
        background: 'var(--surface-soft)', border: '1px solid var(--border)', borderRadius: '50%',
        width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function AddExerciseSheet({ open, onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [sets, setSets] = useState(3)
  const [reps, setReps] = useState('10-12')

  return (
    <Sheet open={open} onClose={onClose} title="Add exercise">
      <div className="field">
        <label>Exercise name</label>
        <input className="input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bulgarian Split Squat" />
      </div>
      <div className="field">
        <label>Sets</label>
        <div className="stepper">
          <button onClick={() => setSets((s) => Math.max(1, s - 1))}>−</button>
          <span className="value">{sets}</span>
          <button onClick={() => setSets((s) => s + 1)}>+</button>
        </div>
      </div>
      <div className="field">
        <label>Reps</label>
        <input className="input" type="text" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="e.g. 10-12" />
      </div>
      <button
        className="btn btn-primary btn-block"
        disabled={!name.trim()}
        onClick={() => { onSubmit({ name: name.trim(), sets, reps, rest: '60-90 sec' }); onClose() }}
      >
        Add to this day
      </button>
    </Sheet>
  )
}

function PRSheet({ exercise, onClose, exerciseLogs, onLogPR, onDeletePR }) {
  const [weight, setWeight] = useState(20)
  const [reps, setReps] = useState(10)
  const logs = (exercise && exerciseLogs[exercise.name]) || []
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date))
  const pr = bestPR(logs)

  return (
    <Sheet open={!!exercise} onClose={onClose} title={exercise ? `PR log — ${exercise.name}` : ''}>
      {pr && <p className="text-sm muted" style={{ marginBottom: 14 }}>Personal best: <strong style={{ color: 'var(--text)' }}>{pr.weight} × {pr.reps}</strong></p>}
      <div className="row" style={{ gap: 10, marginBottom: 16 }}>
        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <label>Weight</label>
          <input className="input" type="number" value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
        </div>
        <div className="field" style={{ flex: 1, marginBottom: 0 }}>
          <label>Reps</label>
          <input className="input" type="number" value={reps} onChange={(e) => setReps(Number(e.target.value))} />
        </div>
      </div>
      <button className="btn btn-primary btn-block" onClick={() => exercise && onLogPR(exercise.name, weight, reps)}>Log set</button>
      {sorted.length > 0 && (
        <div className="stack" style={{ marginTop: 20 }}>
          {sorted.map((l) => (
            <div key={l.id} className="row">
              <span className="text-sm faint">{humanDate(l.date)}</span>
              <div className="row" style={{ gap: 10, justifyContent: 'flex-end' }}>
                <span className="mono text-sm">{l.weight} × {l.reps}</span>
                <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }} onClick={() => onDeletePR(exercise.name, l.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}

function WorkoutPlan({
  schedule, completions, exerciseLogs, onToggle, profile, setWorkoutProfile,
  onSwap, onAddExercise, onRemoveExercise, onLogPR, onDeletePR, suggestion,
  todayPain, onSavePain, lowMotivation, onSetLowMotivation, calendarStatus,
}) {
  const [dayOpen, setDayOpen] = useState(null) // date key
  const [editing, setEditing] = useState(false)
  const [addingTo, setAddingTo] = useState(null) // day string
  const [timerFor, setTimerFor] = useState(null) // exercise
  const [prFor, setPrFor] = useState(null) // exercise
  const [todayTier, setTodayTier] = useState(suggestion.tier)
  const [sheetTier, setSheetTier] = useState(suggestion.tier)
  const [painOpen, setPainOpen] = useState(false)
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
  const todayWeekday = weekdayShort(today)

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

      <div className="card hero-card" style={{ '--hero-tint': 'var(--accent-workout)', '--hero-glow': 'var(--accent-workout)' }}>
        <div className="row">
          <div>
            <div className="text-sm muted" style={{ fontWeight: 600 }}>Today</div>
            <h3 style={{ fontSize: 19, marginTop: 4 }}>{todaysWorkout?.rest ? 'Rest day' : todaysWorkout?.label}</h3>
          </div>
          <StreakBadge days={streak} />
        </div>
        {!todaysWorkout?.rest && (
          <>
            <p className="text-sm row" style={{ marginTop: 8, marginBottom: 0, color: 'var(--text-soft)', gap: 6, justifyContent: 'flex-start' }}>
              <span aria-hidden style={{ display: 'inline-flex', color: 'var(--accent-workout)' }}><Icon name="sparkle" size={13} /></span> {suggestion.reason}
            </p>
            <button className="btn btn-ghost btn-sm row" style={{ marginTop: 4, padding: '4px 0', gap: 6, justifyContent: 'flex-start' }} onClick={() => setPainOpen(true)}>
              {todayPain.length > 0 ? (
                <>
                  <Icon name="alertTriangle" size={13} style={{ color: 'var(--warning)' }} />
                  {`Flagged today: ${todayPain.map((id) => PAIN_AREAS.find((a) => a.id === id)?.label || id).join(', ')}`}
                </>
              ) : "How's your body feeling?"}
            </button>
            <div className="row" style={{ marginTop: 6, marginBottom: 4 }}>
              <span className="text-sm muted">Not feeling motivated today</span>
              <button
                className={`switch${lowMotivation ? ' on' : ''}`}
                onClick={() => onSetLowMotivation(!lowMotivation)}
                aria-label="Low motivation today"
              />
            </div>
            {calendarStatus?.connected && (
              <p className="text-sm faint row" style={{ margin: '2px 0 4px', gap: 6, justifyContent: 'flex-start' }}>
                <Icon name="calendar" size={13} />
                Today's calendar: {calendarStatus.busyMinutesToday >= 360 ? 'packed' : calendarStatus.busyMinutesToday >= 180 ? 'busy' : 'light'}
              </p>
            )}
            <TierTabs value={todayTier} onChange={setTodayTier} suggestedTier={suggestion.tier} />
            <div>
              {deriveTiers(todaysWorkout.exercises)[todayTier].map((ex, i) => (
                <ExerciseRow
                  key={`${ex.name}-${i}`}
                  day={todayWeekday}
                  exercise={ex}
                  index={i}
                  exerciseLogs={exerciseLogs}
                  onSwap={onSwap}
                  onRemove={onRemoveExercise}
                  onOpenTimer={setTimerFor}
                  onOpenPR={setPrFor}
                  editable={todayTier === 'full'}
                  flaggedPainAreas={todayPain}
                />
              ))}
            </div>
            {todayTier === 'full' && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setAddingTo(todayWeekday)}>+ Add exercise</button>
            )}
            <button
              className={`btn btn-block ${completions[today] ? 'btn-secondary' : 'btn-primary'}`}
              style={{ marginTop: 12 }}
              onClick={() => onToggle(today)}
            >
              {completions[today] ? <span className="row" style={{ gap: 6, justifyContent: 'center' }}><Icon name="check" size={14} />Completed</span> : 'Mark complete'}
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
            <button
              key={k}
              className="card"
              style={{ textAlign: 'left', cursor: 'pointer', padding: '14px 16px' }}
              onClick={() => { setDayOpen(k); setSheetTier(k === today ? suggestion.tier : 'full') }}
            >
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
                    {done && <Icon name="check" size={13} />}
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
            {openDay.note && <p className="muted text-sm" style={{ marginBottom: 10 }}>{openDay.note}</p>}
            <TierTabs value={sheetTier} onChange={setSheetTier} suggestedTier={dayOpen === today ? suggestion.tier : null} />
            <div>
              {deriveTiers(openDay.exercises)[sheetTier].map((ex, i) => (
                <ExerciseRow
                  key={`${ex.name}-${i}`}
                  day={openDay.day}
                  exercise={ex}
                  index={i}
                  exerciseLogs={exerciseLogs}
                  onSwap={onSwap}
                  onRemove={onRemoveExercise}
                  onOpenTimer={setTimerFor}
                  onOpenPR={setPrFor}
                  editable={sheetTier === 'full'}
                  flaggedPainAreas={dayOpen === today ? todayPain : undefined}
                />
              ))}
            </div>
            {sheetTier === 'full' && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setAddingTo(openDay.day)}>+ Add exercise</button>
            )}
            <button
              className={`btn btn-block ${dayOpen && completions[dayOpen] ? 'btn-secondary' : 'btn-primary'}`}
              style={{ marginTop: 14 }}
              onClick={() => onToggle(dayOpen)}
            >
              {dayOpen && completions[dayOpen] ? <span className="row" style={{ gap: 6, justifyContent: 'center' }}><Icon name="check" size={14} />Completed</span> : 'Mark complete'}
            </button>
          </>
        )}
        {openDay?.rest && <p className="muted text-sm">Recovery day — no exercises scheduled.</p>}
      </Sheet>

      <AddExerciseSheet
        open={!!addingTo}
        onClose={() => setAddingTo(null)}
        onSubmit={(exercise) => onAddExercise(addingTo, exercise)}
      />

      <RestTimer
        open={!!timerFor}
        onClose={() => setTimerFor(null)}
        seconds={timerFor ? parseRestSeconds(timerFor.rest) : 60}
        exerciseName={timerFor?.name}
      />

      <PRSheet
        exercise={prFor}
        onClose={() => setPrFor(null)}
        exerciseLogs={exerciseLogs}
        onLogPR={onLogPR}
        onDeletePR={onDeletePR}
      />

      <PainCheckIn
        open={painOpen}
        onClose={() => setPainOpen(false)}
        current={todayPain}
        onSave={onSavePain}
      />
    </div>
  )
}
