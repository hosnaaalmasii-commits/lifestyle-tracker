import { lastNDayKeys, weekdayShort } from './dates'

const NUTRITION_KEYS = ['breakfast', 'lunch', 'dinner', 'vegetables', 'snacks']
const WINDOW_DAYS = 30
const DECAY = 0.95 // yesterday matters slightly more than 30 days ago, not a cliff

/**
 * A rolling, weighted score (0-100) instead of a streak counter — recent
 * days count more, but one missed day barely moves it and a deliberate
 * rest day contributes positively rather than nothing. This is designed
 * to reward "coming back," which a raw streak actively punishes.
 */
export function computeConsistencyScore(data) {
  const days = lastNDayKeys(WINDOW_DAYS)
  let weightedSum = 0
  let weightTotal = 0

  days.forEach((key, i) => {
    const daysAgo = days.length - 1 - i // 0 = today
    const weight = Math.pow(DECAY, daysAgo)

    let earned = 0
    const max = 12

    if ((data.water[key] || 0) >= data.settings.waterGoalMl) earned += 3
    if ((data.sleep[key]?.hours || 0) >= data.settings.sleepGoalHours) earned += 3

    const scheduledDay = data.workouts.schedule.find((s) => s.day === weekdayShort(key))
    if (!scheduledDay || scheduledDay.rest) earned += 4 // a planned rest day, taken, counts fully
    else if (data.workouts.completions[key]) earned += 4

    if (data.mood.some((m) => m.date === key)) earned += 1

    const nutritionDay = data.nutrition[key]
    if (nutritionDay && NUTRITION_KEYS.some((n) => nutritionDay[n])) earned += 1

    const ratio = Math.min(1, earned / max)
    weightedSum += ratio * weight
    weightTotal += weight
  })

  const score = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 100) : 0
  return { score, label: labelFor(score) }
}

function labelFor(score) {
  if (score >= 61) return 'Strong'
  if (score >= 31) return 'Steady'
  return 'Rebuilding'
}
