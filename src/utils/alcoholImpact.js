import { addDaysToKey } from './dates.js'

// Below this many drinks, nothing is worth flagging — matches this
// app's existing restraint (e.g. cycle notes only surface when a
// symptom was actually logged, not on every phase day).
const NOTABLE_THRESHOLD = 3

// Caps so a large logged/hypothetical count never produces an absurd
// bump — same bounds-checking instinct as hydration's own overhydration
// ceiling.
const MAX_HYDRATION_BUMP_ML = 1000
const HYDRATION_BUMP_PER_DRINK_ML = 150

// Pure function of a number — no `data`, no side effects. This is the
// exact call shape a future Damage Control Mode will use with a
// hypothetical count from voice ("I'm going out tonight"), so it must
// never depend on real logged data.
export function computeAlcoholImpact(drinkCount) {
  if (!drinkCount || drinkCount < NOTABLE_THRESHOLD) return null

  const hydrationBumpMl = Math.min(MAX_HYDRATION_BUMP_ML, drinkCount * HYDRATION_BUMP_PER_DRINK_ML)

  return {
    hydrationBumpMl,
    workoutNote: `${drinkCount} drinks logged last night — a lighter session is a common pattern, not a rule`,
    recoveryTip: 'Extra water and an easier pace today can help — no need to push through.',
  }
}

// Reads yesterday's real logged total (relative to dateKey) and calls
// the pure function above. Returns null if nothing was logged or the
// total wasn't notable.
export function estimateAlcoholImpactForDate(data, dateKey) {
  const yesterday = addDaysToKey(dateKey, -1)
  const total = data.alcohol
    .filter((a) => a.date === yesterday)
    .reduce((sum, a) => sum + (a.count || 0), 0)
  return computeAlcoholImpact(total)
}
