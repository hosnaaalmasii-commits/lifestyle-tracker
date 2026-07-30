import { lastNDayKeys, weekdayShort, todayKey, addDaysToKey } from './dates'

export const STATES = ['dehydrated', 'tired', 'recovering', 'energized', 'balanced']

export const STATE_META = {
  dehydrated: {
    name: 'Dehydrated',
    blurb: "Water's fallen behind — the one state named after a real number.",
  },
  tired: {
    name: 'Tired',
    blurb: "Sleep's been thin lately — running slower, not running down.",
  },
  recovering: {
    name: 'Recovering',
    blurb: 'Trending up from a rough stretch — the arrow is the point.',
  },
  energized: {
    name: 'Energized',
    blurb: "Everything's landing today — water, rest and movement all on pace.",
  },
  balanced: {
    name: 'Balanced',
    blurb: 'Steady day. Nothing urgent, nothing to fix — just on track.',
  },
}

function workoutRatioFor(data, dayKey) {
  const scheduled = data.workouts.schedule.find((s) => s.day === weekdayShort(dayKey))
  const isRestDay = !scheduled || scheduled.rest
  if (isRestDay) return 1
  return data.workouts.completions[dayKey] ? 1 : 0
}

function moodLoggedFor(data, dayKey) {
  return data.mood.some((m) => m.date === dayKey)
}

// One day's raw component ratios (0-1 each) plus a blended average — mood
// only enters the blend on days it was actually logged, same treatment
// nutrition gets in computeConsistencyScore, so an unlogged mood never
// reads as a bad mood.
function dayRatios(data, dayKey) {
  const water = Math.min(1, (data.water[dayKey] || 0) / data.settings.waterGoalMl)
  const sleepEntry = data.sleep[dayKey]
  const sleep = sleepEntry ? Math.min(1, sleepEntry.hours / data.settings.sleepGoalHours) : 0
  const workout = workoutRatioFor(data, dayKey)
  const moodLogged = moodLoggedFor(data, dayKey)
  const parts = moodLogged ? [water, sleep, workout, 1] : [water, sleep, workout]
  const blended = parts.reduce((a, b) => a + b, 0) / parts.length
  return { water, sleep, workout, moodLogged, blended }
}

// Derived, not stored — recomputed on every render straight from the raw
// water/sleep/workout/mood logs, same rule the rest of the app follows
// (see gamification.js / consistencyScore.js). Checked in priority order,
// first match wins: dehydrated > tired > recovering > energized > balanced.
export function computeCompanionState(data) {
  const today = todayKey()
  const last3 = lastNDayKeys(3, today) // [2 days ago, yesterday, today]
  const priorDays = lastNDayKeys(3, addDaysToKey(today, -1)) // the 3 days before today

  const ratiosByDay = last3.map((k) => dayRatios(data, k))
  const todayRatios = ratiosByDay[ratiosByDay.length - 1]

  const avgWater3 = ratiosByDay.reduce((s, r) => s + r.water, 0) / ratiosByDay.length
  const avgSleep3 = ratiosByDay.reduce((s, r) => s + r.sleep, 0) / ratiosByDay.length
  const avgBlended3 = ratiosByDay.reduce((s, r) => s + r.blended, 0) / ratiosByDay.length

  const priorRatios = priorDays.map((k) => dayRatios(data, k))
  const avgBlendedPrior = priorRatios.reduce((s, r) => s + r.blended, 0) / priorRatios.length

  let state
  if (avgWater3 < 0.4) state = 'dehydrated'
  else if (avgSleep3 < 0.5) state = 'tired'
  else if (todayRatios.blended - avgBlendedPrior >= 0.2) state = 'recovering'
  else if (avgBlended3 >= 0.8) state = 'energized'
  else state = 'balanced'

  const meta = STATE_META[state]

  const waterToday = data.water[today] || 0
  const sleepToday = data.sleep[today]
  const workoutDoneLabel = (() => {
    const scheduled = data.workouts.schedule.find((s) => s.day === weekdayShort(today))
    if (!scheduled || scheduled.rest) return { label: 'Rest day', ratio: 1 }
    return data.workouts.completions[today] ? { label: 'Done', ratio: 1 } : { label: 'Not yet', ratio: 0 }
  })()

  const drivers = [
    { key: 'water', label: 'Water', ratio: todayRatios.water, valueLabel: `${waterToday} / ${data.settings.waterGoalMl}ml` },
    { key: 'sleep', label: 'Sleep', ratio: todayRatios.sleep, valueLabel: sleepToday ? `${sleepToday.hours} / ${data.settings.sleepGoalHours}h` : 'Not logged' },
    { key: 'workout', label: 'Workout', ratio: workoutDoneLabel.ratio, valueLabel: workoutDoneLabel.label },
    { key: 'mood', label: 'Mood', ratio: todayRatios.moodLogged ? 1 : 0, valueLabel: todayRatios.moodLogged ? 'Logged' : 'Not logged' },
  ]

  const nextAction = nextActionFor(state, drivers)

  return {
    state,
    name: meta.name,
    blurb: meta.blurb,
    headline: headlineFor(state),
    drivers,
    nextAction,
  }
}

function headlineFor(state) {
  switch (state) {
    case 'dehydrated': return "Water's the gap today."
    case 'tired': return 'Running on low sleep.'
    case 'recovering': return 'Coming back steady — nice work.'
    case 'energized': return 'Everything is landing today.'
    default: return 'A steady, on-track day.'
  }
}

function nextActionFor(state, drivers) {
  if (state === 'dehydrated') return 'A glass of water now gets today back on track.'
  if (state === 'tired') return 'An earlier lights-out tonight would help the most.'
  if (state === 'energized') return 'Nothing to fix — enjoy it.'
  if (state === 'balanced') return 'Steady as it is — no changes needed.'
  // recovering — point at whichever core driver is still weakest
  const weakest = [...drivers]
    .filter((d) => d.key !== 'mood')
    .sort((a, b) => a.ratio - b.ratio)[0]
  if (weakest.key === 'sleep') return 'Sleep is still catching up — an earlier night keeps this climbing.'
  if (weakest.key === 'water') return 'Water is still catching up — a bit more today keeps this climbing.'
  return 'Keep today going the way it started.'
}
