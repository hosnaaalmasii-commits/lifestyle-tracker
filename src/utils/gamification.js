// XP and levels are fully derived from existing data — never stored — so
// they can never drift out of sync and old backups stay compatible.
const NUTRITION_KEYS = ['breakfast', 'lunch', 'dinner', 'vegetables', 'snacks']

export function computeXP(data, badgeCount) {
  const waterDays = Object.values(data.water).filter((ml) => ml >= data.settings.waterGoalMl).length
  const sleepDays = Object.values(data.sleep).filter((s) => s.hours >= data.settings.sleepGoalHours).length
  const workoutDays = Object.keys(data.workouts.completions).filter((k) => data.workouts.completions[k]).length
  const moodLogs = data.mood.length
  const nutritionItems = Object.values(data.nutrition).reduce(
    (sum, day) => sum + NUTRITION_KEYS.filter((k) => day[k]).length, 0
  )
  const weightLogs = data.weight.length
  const photoLogs = data.photos.length

  return (
    waterDays * 15 +
    sleepDays * 15 +
    workoutDays * 20 +
    moodLogs * 5 +
    nutritionItems * 5 +
    weightLogs * 8 +
    photoLogs * 10 +
    badgeCount * 25
  )
}

// Triangular thresholds: level n starts at 100 * n*(n-1)/2 XP, so each level
// costs a little more than the last.
export function levelFromXP(xp) {
  let level = 1
  while (xpForLevel(level + 1) <= xp) level += 1
  return level
}

export function xpForLevel(level) {
  return 100 * ((level - 1) * level) / 2
}

export function levelProgress(xp) {
  const level = levelFromXP(xp)
  const floor = xpForLevel(level)
  const ceil = xpForLevel(level + 1)
  const ratio = ceil > floor ? (xp - floor) / (ceil - floor) : 1
  return { level, floor, ceil, ratio, xpIntoLevel: xp - floor, xpForNext: ceil - floor }
}

const LEVEL_TITLES = [
  'Getting Started', 'Building Habits', 'Finding Rhythm', 'Staying Consistent', 'Gaining Momentum',
  'Steady Progress', 'Dedicated', 'Disciplined', 'Thriving', 'Flourishing',
  'Habit Master', 'Unstoppable',
]

export function levelTitle(level) {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)]
}
