import { keyToDate, addDaysToKey, diffDays } from './dates'

// Monday-first order, matching the shape of daily_schedules_by_weekday /
// meal_rotation.meals_by_week in data/transformatieplan-data.json.
export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export function weekdayKeyForDate(dateKey) {
  const jsDay = keyToDate(dateKey).getDay() // 0=Sun..6=Sat
  return WEEKDAY_KEYS[(jsDay + 6) % 7]
}

// Which A/B/C/D (or however long the cycle is) rotation week a date falls
// in, counting whole weeks elapsed since meal_rotation.reference_monday.
export function mealCycleLetterForDate(dateKey, mealRotation) {
  if (!mealRotation?.cycle?.length) return null
  const jsDay = keyToDate(dateKey).getDay()
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay
  const monday = addDaysToKey(dateKey, mondayOffset)
  const weeksSince = Math.floor(diffDays(mealRotation.reference_monday, monday) / 7)
  const idx = ((weeksSince % mealRotation.cycle.length) + mealRotation.cycle.length) % mealRotation.cycle.length
  return mealRotation.cycle[idx]
}

export function getTasksForDate(taskSchedule, dateKey) {
  const day = weekdayKeyForDate(dateKey)
  return [...(taskSchedule?.[day] || [])].sort((a, b) => a.time.localeCompare(b.time))
}

export function getMealsForDate(mealRotation, dateKey) {
  if (!mealRotation) return null
  const day = weekdayKeyForDate(dateKey)
  const letter = mealCycleLetterForDate(dateKey, mealRotation)
  return { letter, meals: (letter && mealRotation.meals_by_week?.[letter]?.[day]) || null }
}

export function computeDayScore(tasks, completionsForDay) {
  if (!tasks.length) return 100
  const done = tasks.filter((t) => completionsForDay?.[t.id]).length
  return Math.round((done / tasks.length) * 100)
}

// A day "counts" toward the streak once its score clears the threshold —
// mirrors the isSuccess-predicate shape computeStreak() (streaks.js) expects.
export function dayMeetsThreshold(taskSchedule, taskCompletions, dateKey, thresholdPct) {
  const tasks = getTasksForDate(taskSchedule, dateKey)
  if (!tasks.length) return false
  return computeDayScore(tasks, taskCompletions[dateKey]) >= thresholdPct
}

export const TASK_CATEGORIES = ['eten', 'training', 'supplement', 'herstel', 'werk', 'zelfzorg']
