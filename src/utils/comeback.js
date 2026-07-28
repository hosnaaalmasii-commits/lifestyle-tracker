import { todayKey, diffDays } from './dates'

const GAP_THRESHOLD_DAYS = 4

/** Most recent date the user logged anything at all, or null for a brand-new user. */
export function getLastActiveDateKey(data) {
  const dates = [
    ...Object.keys(data.water),
    ...Object.keys(data.sleep),
    ...Object.keys(data.nutrition),
    ...data.mood.map((m) => m.date),
    ...data.weight.map((w) => w.date),
    ...data.photos.map((p) => p.date),
    ...Object.keys(data.workouts.completions).filter((k) => data.workouts.completions[k]),
  ]
  if (dates.length === 0) return null
  return dates.reduce((max, d) => (d > max ? d : max))
}

/**
 * Self-clearing by design: once the user logs anything today, the gap
 * becomes 0 and this naturally stops matching — no dismissed-flag needed.
 */
export function getComebackStatus(data) {
  const lastActive = getLastActiveDateKey(data)
  if (!lastActive) return { isComeback: false, gapDays: 0, lastActive: null }
  const gapDays = diffDays(lastActive, todayKey())
  return { isComeback: gapDays >= GAP_THRESHOLD_DAYS, gapDays, lastActive }
}
