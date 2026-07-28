import { addDaysToKey, todayKey } from './dates'

/**
 * Given a predicate that says whether a given date key "counts" as a
 * success, compute the current streak length ending at today. If today
 * hasn't been logged yet, the streak still counts through yesterday so it
 * doesn't zero out mid-day.
 */
export function computeStreak(isSuccess) {
  const today = todayKey()
  let cursor = isSuccess(today) ? today : addDaysToKey(today, -1)
  let streak = 0
  // Safety cap so a bug can't spin forever.
  for (let i = 0; i < 3650; i++) {
    if (!isSuccess(cursor)) break
    streak += 1
    cursor = addDaysToKey(cursor, -1)
  }
  return streak
}

export function streakFromDateSet(dateSet) {
  return computeStreak((key) => dateSet.has(key))
}
