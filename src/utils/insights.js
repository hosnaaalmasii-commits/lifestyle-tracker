import { currentWeekKeys, previousWeekKeys, todayKey } from './dates'
import { streakFromDateSet, longestStreakFromDateSet } from './streaks'

function rate(keys, isSuccess) {
  const hits = keys.filter(isSuccess).length
  return { hits, total: keys.length }
}

function avg(nums) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}

const MOOD_VALUE = { '😞': 1, '😕': 2, '😐': 3, '🙂': 4, '😄': 5 }

/**
 * Rule-based, fully local "insights" — no AI model involved, just
 * deterministic comparisons over the user's own data. Returns an ordered
 * list of { id, icon, tone, text }, most actionable first.
 */
export function computeInsights(data) {
  const insights = []
  const today = todayKey()
  const { waterGoalMl, sleepGoalHours } = data.settings

  const waterDates = new Set(Object.entries(data.water).filter(([, ml]) => ml >= waterGoalMl).map(([k]) => k))
  const sleepDates = new Set(Object.entries(data.sleep).filter(([, s]) => s.hours >= sleepGoalHours).map(([k]) => k))
  const workoutDates = new Set(Object.keys(data.workouts.completions).filter((k) => data.workouts.completions[k]))

  // --- Streak risk (most actionable, shown first) ---
  const risks = [
    { label: 'water', color: 'var(--accent-water)', dates: waterDates, doneToday: (data.water[today] || 0) >= waterGoalMl },
    { label: 'sleep', color: 'var(--accent-sleep)', dates: sleepDates, doneToday: (data.sleep[today]?.hours || 0) >= sleepGoalHours },
    { label: 'workout', color: 'var(--accent-workout)', dates: workoutDates, doneToday: !!data.workouts.completions[today] },
  ]
  for (const r of risks) {
    const streak = streakFromDateSet(r.dates)
    if (streak >= 3 && !r.doneToday) {
      insights.push({
        id: `risk-${r.label}`,
        icon: 'alertTriangle',
        tone: 'warning',
        text: `Your ${streak}-day ${r.label} streak is on the line — log today to keep it going.`,
      })
    }
  }

  // --- Weekly recap vs last week ---
  const thisWeek = currentWeekKeys().filter((k) => k <= today)
  const lastWeek = previousWeekKeys()
  const recapFields = [
    { label: 'water', dates: waterDates, color: 'var(--accent-water)' },
    { label: 'sleep', dates: sleepDates, color: 'var(--accent-sleep)' },
    { label: 'workout', dates: workoutDates, color: 'var(--accent-workout)' },
  ]
  for (const f of recapFields) {
    const cur = rate(thisWeek, (k) => f.dates.has(k))
    const prev = rate(lastWeek, (k) => f.dates.has(k))
    if (prev.total === 0 || cur.hits === 0) continue
    if (cur.hits > prev.hits) {
      insights.push({
        id: `recap-up-${f.label}`,
        icon: 'trendUp',
        tone: 'positive',
        text: `${cap(f.label)} goal met ${cur.hits}/${cur.total} days this week, up from ${prev.hits}/${prev.total} last week.`,
      })
    } else if (cur.hits < prev.hits && thisWeek.length >= 4) {
      insights.push({
        id: `recap-down-${f.label}`,
        icon: 'trendDown',
        tone: 'neutral',
        text: `${cap(f.label)} goal met ${cur.hits}/${cur.total} days this week, down from ${prev.hits}/${prev.total} last week.`,
      })
    }
  }

  // --- Correlations ---
  const moodByDate = {}
  for (const m of data.mood) moodByDate[m.date] = MOOD_VALUE[m.emoji] ?? null

  const moodOnWorkoutDays = []
  const moodOnRestDays = []
  for (const [date, val] of Object.entries(moodByDate)) {
    if (val == null) continue
    if (data.workouts.completions[date]) moodOnWorkoutDays.push(val)
    else moodOnRestDays.push(val)
  }
  const wAvg = avg(moodOnWorkoutDays)
  const rAvg = avg(moodOnRestDays)
  if (moodOnWorkoutDays.length >= 3 && moodOnRestDays.length >= 3 && wAvg - rAvg >= 0.4) {
    insights.push({
      id: 'corr-mood-workout',
      icon: 'sparkle',
      tone: 'positive',
      text: `Your mood tends to be higher on workout days (avg ${wAvg.toFixed(1)}/5 vs ${rAvg.toFixed(1)}/5).`,
    })
  }

  const sleepQualityOnWaterGoalDays = []
  const sleepQualityOtherDays = []
  for (const [date, entry] of Object.entries(data.sleep)) {
    const metWater = (data.water[date] || 0) >= waterGoalMl
    if (metWater) sleepQualityOnWaterGoalDays.push(entry.quality)
    else sleepQualityOtherDays.push(entry.quality)
  }
  const sq1 = avg(sleepQualityOnWaterGoalDays)
  const sq2 = avg(sleepQualityOtherDays)
  if (sleepQualityOnWaterGoalDays.length >= 3 && sleepQualityOtherDays.length >= 3 && sq1 - sq2 >= 0.4) {
    insights.push({
      id: 'corr-sleep-water',
      icon: 'sparkle',
      tone: 'positive',
      text: `You sleep better on days you hit your water goal (quality ${sq1.toFixed(1)}/5 vs ${sq2.toFixed(1)}/5).`,
    })
  }

  // --- Light trigger mapping: mood vs nutrition follow-through ---
  const NUTRITION_KEYS = ['breakfast', 'lunch', 'dinner', 'vegetables', 'snacks']
  const nutritionOnLowMoodDays = []
  const nutritionOnOtherDays = []
  for (const [date, val] of Object.entries(moodByDate)) {
    const nutritionDay = data.nutrition[date]
    if (!nutritionDay) continue
    const count = NUTRITION_KEYS.filter((k) => nutritionDay[k]).length
    if (val <= 2) nutritionOnLowMoodDays.push(count)
    else nutritionOnOtherDays.push(count)
  }
  const n1 = avg(nutritionOnLowMoodDays)
  const n2 = avg(nutritionOnOtherDays)
  if (nutritionOnLowMoodDays.length >= 3 && nutritionOnOtherDays.length >= 3 && n2 - n1 >= 0.8) {
    insights.push({
      id: 'corr-mood-nutrition',
      icon: 'search',
      tone: 'neutral',
      text: `On lower-mood days, your nutrition checklist tends to slip (${n1.toFixed(1)}/5 vs ${n2.toFixed(1)}/5) — worth having an easy backup meal ready for those days.`,
    })
  }

  // --- Mood-tracking risk: a mood streak worth protecting too ---
  const moodDates = new Set(data.mood.map((m) => m.date))
  const moodStreak = streakFromDateSet(moodDates)
  if (moodStreak >= 5 && !moodDates.has(today)) {
    insights.push({
      id: 'risk-mood',
      icon: 'alertTriangle',
      tone: 'warning',
      text: `Your ${moodStreak}-day mood check-in streak is on the line — a 10-second log keeps it going.`,
    })
  }

  // --- Personal records / fun facts ---
  const waterEntries = Object.entries(data.water)
  if (waterEntries.length > 0) {
    const [bestDate, bestMl] = waterEntries.reduce((a, b) => (b[1] > a[1] ? b : a))
    insights.push({ id: 'pr-water', icon: 'medal', tone: 'neutral', text: `Best water day: ${bestMl} ml on ${bestDate.slice(5)}.` })
  }
  const longestWater = longestStreakFromDateSet(waterDates)
  if (longestWater >= 3) {
    insights.push({ id: 'pr-water-streak', icon: 'medal', tone: 'neutral', text: `Longest water streak: ${longestWater} days.` })
  }
  const longestWorkout = longestStreakFromDateSet(workoutDates)
  if (longestWorkout >= 3) {
    insights.push({ id: 'pr-workout-streak', icon: 'medal', tone: 'neutral', text: `Longest workout streak: ${longestWorkout} days.` })
  }

  return insights
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
