import { todayKey, addDaysToKey } from './dates'
import { getComebackStatus } from './comeback'

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

  const todaysMood = [...data.mood].reverse().find((m) => m.date === today)
  if (todaysMood && MOOD_LOW.includes(todaysMood.emoji)) {
    return { tier: 'short', reason: 'today felt heavier — a lighter session still counts' }
  }

  if (data.workouts.completions[yesterday]) {
    return { tier: 'short', reason: 'trained yesterday — keeping it lighter today' }
  }

  return { tier: 'full', reason: 'no flags today — go for it' }
}
