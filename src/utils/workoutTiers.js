import { todayKey, addDaysToKey } from './dates'
import { getComebackStatus } from './comeback'
import { estimateCyclePhase, menstrualTrainingPattern } from './cyclePhase'

export const TIERS = [
  { id: 'full', label: 'Full', minutes: '30-45 min' },
  { id: 'short', label: 'Short', minutes: '~15 min' },
  { id: 'survival', label: 'Survival', minutes: '4-7 min' },
]

// Derived on the fly from the canonical exercise list — never stored, so
// swap/custom-exercise/PR tooling keeps working against the one source of
// truth (the Full tier) without any migration.
export function deriveTiers(exercises) {
  if (!exercises || exercises.length === 0) return { full: [], short: [], survival: [] }

  const shortCount = Math.max(2, Math.ceil(exercises.length / 2))
  const short = exercises.slice(0, shortCount).map((ex) => ({ ...ex, sets: Math.max(2, ex.sets - 1) }))

  const anchor = exercises[0]
  const survival = [
    { name: anchor.name, sets: 2, reps: anchor.reps, rest: '20 sec' },
    { name: 'Full-body finisher', sets: 1, reps: '3 rounds: 20s work / 10s rest', rest: '—' },
  ]

  return { full: exercises, short, survival }
}

const MOOD_LOW = ['😞', '😕']

/**
 * A lightweight, fully local readiness heuristic — not a medical or
 * physiological model, just enough signal to nudge a sensible default tier.
 */
export function suggestTier(data) {
  const today = todayKey()
  const yesterday = addDaysToKey(today, -1)

  const { isComeback, gapDays } = getComebackStatus(data)
  if (isComeback) {
    return { tier: 'survival', reason: `easing back in after ${gapDays} days away` }
  }

  const sleepToday = data.sleep[today]
  const sleepGoal = data.settings.sleepGoalHours
  if (sleepToday && sleepToday.hours < sleepGoal * 0.7) {
    return { tier: 'survival', reason: `short on sleep (${sleepToday.hours}h logged)` }
  }

  const soreAreas = data.painLog?.[today] || []
  if (soreAreas.length >= 2) {
    return { tier: 'survival', reason: `multiple sore spots flagged today (${soreAreas.join(', ')})` }
  }
  if (soreAreas.length === 1) {
    return { tier: 'short', reason: `${soreAreas[0]} flagged as sore today` }
  }

  const busyMinutes = data.calendarStatus?.busyMinutesToday
  if (typeof busyMinutes === 'number' && busyMinutes >= 360) {
    return { tier: 'survival', reason: 'packed calendar today — barely any gaps' }
  }
  if (typeof busyMinutes === 'number' && busyMinutes >= 180) {
    return { tier: 'short', reason: 'a busy calendar today — keeping it efficient' }
  }

  const todaysMood = [...data.mood].reverse().find((m) => m.date === today)
  if (todaysMood && MOOD_LOW.includes(todaysMood.emoji)) {
    return { tier: 'short', reason: 'today felt heavier — a lighter session still counts' }
  }

  if (data.motivationFlags?.[today]) {
    return { tier: 'short', reason: "low motivation today — showing up still counts" }
  }

  if (data.workouts.completions[yesterday]) {
    return { tier: 'short', reason: 'trained yesterday — keeping it lighter today' }
  }

  const phase = estimateCyclePhase(data, today)
  if (phase && phase.phase === 'menstrual') {
    const pattern = menstrualTrainingPattern(data)
    // Only skip the nudge once there's enough of the user's own history to
    // show it doesn't usually slow them down — otherwise default to easing up.
    if (!(pattern.known && pattern.rate >= 0.6)) {
      return { tier: 'short', reason: `estimated period window (day ${phase.cycleDay}) — a lighter session is a common pattern, not a rule` }
    }
  }

  return { tier: 'full', reason: 'no flags today — go for it' }
}
