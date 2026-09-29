import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayKey, currentWeekKeys, weekdayShort, isToday, humanDate, diffDays } from '../utils/dates'
import { streakFromDateSet } from '../utils/streaks'
import { getTasksForDate } from '../utils/taskSchedule'
import transformatieplan from '../data/transformatieplan-data.json'
import { GOAL_OPTIONS, EXPERIENCE_OPTIONS, FOCUS_OPTIONS } from '../utils/workoutGenerator'
import { parseRestSeconds } from '../utils/time'
import { TIERS, deriveTiers, suggestTier } from '../utils/workoutTiers'
import { isExerciseFlagged, PAIN_AREAS } from '../utils/painAreas'
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
      weekLabel={trainingWeekLabel()}
      planTrainingFor={(dateKey) => getTasksForDate(data.taskSchedule, dateKey, data.dayOverrides).find((t) => t.category === 'training') || null}
      activeCalories={data.ouraStatus?.activeCalories ?? null}
    />
  )
}

// "WEEK 3 · FASE 1" — counted from the transformation plan's start date.
function trainingWeekLabel() {
  const phases = transformatieplan.training_phases || {}
  const start = phases.fase_1?.start
  if (!start) return 'DEZE WEEK'
  const week = Math.floor(diffDays(start, todayKey()) / 7) + 1
  if (week < 1) return 'VOORBEREIDING'
  const phaseIndex = Object.values(phases).findIndex((p) => {
    const [a, b] = (p.weken || '').split('-').map(Number)
    return week >= a && week <= b
  })
  return `WEEK ${week}${phaseIndex >= 0 ? ` · FASE ${phaseIndex + 1}` : ''}`
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
    <div className="row" style={{ padding: '10px 0', borderTop: '1px solid var(--border-soft)', gap: 12 }}>
      <span
        aria-hidden
        style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 30%, #120f18), var(--accent))', color: 'rgba(255,255,255,0.85)',
        }}
      >
        <Icon name="dumbbell" size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
          {isFlagged && <span title="Targets an area you flagged today" style={{ color: 'var(--warning)', display: 'inline-flex' }}><Icon name="alertTriangle" size={13} /></span>}
          {exercise.name}
        </div>
        <div className="faint" style={{ fontSize: 12 }}>
          {exercise.sets} × {exercise.reps}{pr ? ` · PR ${pr.weight} × ${pr.reps}` : exercise.rest ? ` · rust ${exercise.rest}` : ''}
        </div>
      </div>
      <div>
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
  weekLabel, planTrainingFor, activeCalories,
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

  // The transformation plan's daily schedule is the source of truth for
  // *whether and when* you train; the generated workout (if its day has
  // one) supplies the exercise list.
  const planTask = planTrainingFor(today)
  const trainingTime = planTask?.time
  const hasGenerated = !!todaysWorkout && !todaysWorkout.rest
  const isRestToday = !hasGenerated && !planTask
  // "Training: Upper Body & Core + 15min cardio" → title + extra line.
  const [planTitle, ...planExtras] = (planTask?.label.replace(/^Training:\s*/i, '') || '').split(/\s*\+\s*/)
  const title = hasGenerated ? todaysWorkout.label : planTitle
  const exercisesToday = hasGenerated ? deriveTiers(todaysWorkout.exercises)[todayTier] : []
  const setsToday = exercisesToday.reduce((s, e) => s + (Number(e.sets) || 0), 0)
  const planMinutes = [...(planTask?.label || '').matchAll(/(\d+)\s*min/gi)].reduce((s, m) => s + Number(m[1]), 45)
  const minutesToday = hasGenerated ? Math.round(setsToday * 2.5) : planMinutes // ~2.5 min per set incl. rest
  const isPlannedDay = (k) => (dayFor(k) && !dayFor(k).rest) || !!planTrainingFor(k)
  const plannedThisWeek = weekKeys.filter(isPlannedDay)
  const doneThisWeek = plannedThisWeek.filter((k) => completions[k]).length
  const DOT_LETTER = ['M', 'D', 'W', 'D', 'V', 'Z', 'Z']
  const exercisesRef = { current: null }

  return (
    <div className="page">
      <div className="page-header row" style={{ alignItems: 'flex-end', marginBottom: 16, paddingRight: 52 }}>
        <div>
          <div className="eyebrow">{weekLabel}</div>
          <h1>Training</h1>
        </div>
      </div>

      {/* Hero: today's session, photo-card style from the design (a
          gradient stands in for the sport photo). */}
      <div
        style={{
          position: 'relative', overflow: 'hidden', borderRadius: 26, minHeight: 236, padding: 20,
          display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8,
          background: 'linear-gradient(160deg, color-mix(in srgb, var(--accent) 18%, #0d0b12) 0%, color-mix(in srgb, var(--accent) 70%, #1a1026) 100%)',
          border: '1px solid var(--border-soft)',
        }}
      >
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.45) 100%)' }} />
        <div aria-hidden style={{ position: 'absolute', right: -30, top: -30, color: 'rgba(255,255,255,0.07)' }}><Icon name="dumbbell" size={190} /></div>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="chip" style={{ alignSelf: 'flex-start', padding: '4px 11px', fontSize: 11.5, cursor: 'default' }}>
            {isRestToday ? 'Vandaag · rustdag' : `Vandaag${trainingTime ? ` · ${trainingTime}` : ''}${completions[today] ? ' · gedaan ✓' : ''}`}
          </span>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15, color: '#fff' }}>
            {isRestToday ? 'Herstel' : title}
          </div>
          <div className="row" style={{ gap: 10 }}>
            <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.8)' }}>
              {isRestToday ? 'Herstel hoort ook bij het plan.' : [`${minutesToday} min`, hasGenerated && `${exercisesToday.length} oefeningen`, ...planExtras.map((x) => `+ ${x}`)].filter(Boolean).join(' · ')}
            </span>
            {!isRestToday && (hasGenerated ? (
              <button className="btn btn-primary btn-sm" onClick={() => exercisesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                {completions[today] ? 'Bekijk' : 'Start'}
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => onToggle(today)}>
                {completions[today] ? 'Gedaan ✓' : 'Afronden'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card-row" style={{ marginTop: 14, gap: 10 }}>
        {[
          [isRestToday ? '0' : String(minutesToday), 'minuten'],
          [activeCalories != null ? String(activeCalories) : '—', 'kcal'],
          [`${doneThisWeek}/${plannedThisWeek.length}`, 'deze week'],
        ].map(([v, l]) => (
          <div key={l} className="card" style={{ padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{v}</div>
            <div className="faint" style={{ fontSize: 11.5 }}>{l}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 14, padding: 16 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Deze week</span>
          {streak > 0 && <span className="text-sm faint">{streak} op rij</span>}
        </div>
        <div className="row">
          {weekKeys.map((k, i) => {
            const done = !!completions[k]
            const isNow = isToday(k)
            const rest = !isPlannedDay(k)
            return (
              <button
                key={k}
                onClick={() => { setDayOpen(k); setSheetTier(k === today ? suggestion.tier : 'full') }}
                aria-label={`${weekdayShort(k)}${rest ? ' rust' : done ? ' gedaan' : ''}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: 0 }}
              >
                <span
                  style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? 'var(--second)' : isNow && !rest ? 'var(--accent)' : 'transparent',
                    border: done || (isNow && !rest) ? 'none' : `1.5px ${rest ? 'dashed' : 'solid'} color-mix(in srgb, var(--text) ${rest ? 14 : 22}%, transparent)`,
                    color: done ? '#10231a' : 'var(--accent-contrast)',
                  }}
                >
                  {done && <Icon name="check" size={14} />}
                </span>
                <span className="faint" style={{ fontSize: 11, fontWeight: 600, color: isNow ? 'var(--text)' : undefined }}>{DOT_LETTER[i]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {!todaysWorkout?.rest && todaysWorkout && (
        <div className="card" ref={(el) => { exercisesRef.current = el }} style={{ marginTop: 14, padding: 16, scrollMarginTop: 20 }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Oefeningen</span>
            <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 700 }} onClick={() => setEditing(true)}>Plan aanpassen</button>
          </div>
          <TierTabs value={todayTier} onChange={setTodayTier} suggestedTier={suggestion.tier} />
          <div>
            {exercisesToday.map((ex, i) => (
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
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => setAddingTo(todayWeekday)}>+ Oefening toevoegen</button>
          )}
          <button
            className={`btn btn-block ${completions[today] ? 'btn-secondary' : 'btn-primary'}`}
            style={{ marginTop: 12 }}
            onClick={() => onToggle(today)}
          >
            {completions[today] ? <span className="row" style={{ gap: 6, justifyContent: 'center' }}><Icon name="check" size={14} />Afgerond</span> : 'Training afronden'}
          </button>
        </div>
      )}

      {!isRestToday && (
        <div className="card" style={{ marginTop: 14, padding: '6px 16px' }}>
          <p className="text-sm row" style={{ margin: 0, padding: '10px 0', color: 'var(--text-soft)', gap: 8, justifyContent: 'flex-start' }}>
            <span aria-hidden style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="sparkle" size={14} /></span> {suggestion.reason}
          </p>
          <button className="row" style={{ width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border-soft)', cursor: 'pointer', padding: '12px 0', color: 'var(--text)', justifyContent: 'flex-start', gap: 8, fontSize: 14 }} onClick={() => setPainOpen(true)}>
            {todayPain.length > 0 ? (
              <>
                <span style={{ color: 'var(--warning)', display: 'inline-flex' }}><Icon name="alertTriangle" size={14} /></span>
                {`Aangegeven: ${todayPain.map((id) => PAIN_AREAS.find((a) => a.id === id)?.label || id).join(', ')}`}
              </>
            ) : 'Hoe voelt je lichaam vandaag?'}
          </button>
          <div className="row" style={{ borderTop: '1px solid var(--border-soft)', padding: '10px 0' }}>
            <span className="text-sm muted">Weinig motivatie vandaag</span>
            <button className={`switch${lowMotivation ? ' on' : ''}`} onClick={() => onSetLowMotivation(!lowMotivation)} aria-label="Weinig motivatie vandaag" />
          </div>
          {calendarStatus?.connected && (
            <p className="text-sm faint row" style={{ margin: 0, padding: '10px 0', borderTop: '1px solid var(--border-soft)', gap: 6, justifyContent: 'flex-start' }}>
              <Icon name="calendar" size={13} />
              Agenda vandaag: {calendarStatus.busyMinutesToday >= 360 ? 'vol' : calendarStatus.busyMinutesToday >= 180 ? 'druk' : 'rustig'}
            </p>
          )}
        </div>
      )}

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
