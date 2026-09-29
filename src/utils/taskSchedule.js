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

// dayOverrides (data.dayOverrides) is a per-date replacement for the weekly
// template: { [dateKey]: { tasks?, appointments?, meals? } }. A replanned
// day (dayReplan.js) stores its full adjusted task list under `tasks` —
// moved tasks keep their original ids, so completions and Calendar event
// ids carry over. The weekly template itself is never touched by a replan.
export function getTasksForDate(taskSchedule, dateKey, dayOverrides) {
  const override = dayOverrides?.[dateKey]?.tasks
  const day = weekdayKeyForDate(dateKey)
  return [...(override || taskSchedule?.[day] || [])].sort((a, b) => a.time.localeCompare(b.time))
}

export function getAppointmentsForDate(dayOverrides, dateKey) {
  return [...(dayOverrides?.[dateKey]?.appointments || [])].sort((a, b) => a.start.localeCompare(b.start))
}

// `swapped` lists which meal slots were replaced for this date (e.g. by
// the pantry "cook with what you have" flow) so the UI can mark them.
export function getMealsForDate(mealRotation, dateKey, dayOverrides) {
  if (!mealRotation) return null
  const day = weekdayKeyForDate(dateKey)
  const letter = mealCycleLetterForDate(dateKey, mealRotation)
  const planned = (letter && mealRotation.meals_by_week?.[letter]?.[day]) || null
  const swaps = dayOverrides?.[dateKey]?.meals || {}
  const meals = planned || Object.keys(swaps).length ? { ...planned, ...swaps } : null
  return { letter, meals, planned, swapped: Object.keys(swaps) }
}

export function computeDayScore(tasks, completionsForDay) {
  if (!tasks.length) return 100
  const done = tasks.filter((t) => completionsForDay?.[t.id]).length
  return Math.round((done / tasks.length) * 100)
}

// A day "counts" toward the streak once its score clears the threshold —
// mirrors the isSuccess-predicate shape computeStreak() (streaks.js) expects.
export function dayMeetsThreshold(taskSchedule, taskCompletions, dateKey, thresholdPct, dayOverrides) {
  const tasks = getTasksForDate(taskSchedule, dateKey, dayOverrides)
  if (!tasks.length) return false
  return computeDayScore(tasks, taskCompletions[dateKey]) >= thresholdPct
}

export const TASK_CATEGORIES = ['eten', 'training', 'supplement', 'herstel', 'werk', 'zelfzorg']
