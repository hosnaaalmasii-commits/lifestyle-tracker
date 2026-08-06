import { todayKey, currentWeekKeys, previousWeekKeys } from './dates'
import { computeHydrationAutopilot } from './hydrationAutopilot'
import { estimateCyclePhase } from './cyclePhase'
import { getComebackStatus } from './comeback'
import { summarizeUserData } from './coachContext'
import { sendToClaude } from './claudeApi'

const CACHE_KEY = 'lifestyle-tracker-eod-report-cache'
const EVENING_HOUR = 18
const NUTRITION_KEYS = ['breakfast', 'lunch', 'dinner', 'vegetables', 'snacks']
const LOW_MOOD_EMOJI = ['😞', '😕']

// Evening, and at least one thing logged today — otherwise there's
// nothing to report.
export function shouldShowEodReport(data, now = new Date()) {
  if (now.getHours() < EVENING_HOUR) return false
  const today = todayKey()
  const hasWater = (data.water[today] || 0) > 0
  const hasSleep = !!data.sleep[today]
  const hasNutrition = NUTRITION_KEYS.some((k) => data.nutrition[today]?.[k])
  const hasWorkout = today in data.workouts.completions
  const hasMood = data.mood.some((m) => m.date === today)
  const hasCycle = data.cycle.some((c) => c.date === today)
  return hasWater || hasSleep || hasNutrition || hasWorkout || hasMood || hasCycle
}

// Cache is regenerable UI state, not a log — deliberately NOT part of
// data/DEFAULT_DATA, so it never round-trips through export/import or
// cloud sync (same treatment as claudeApi.js's own dedicated keys).
export function getCachedReport() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw)
    return cached.date === todayKey() ? cached : null
  } catch {
    return null
  }
}

export function setCachedReport(text, source) {
  const cached = { date: todayKey(), text, source }
  localStorage.setItem(CACHE_KEY, JSON.stringify(cached))
  return cached
}

export function clearCachedReport() {
  localStorage.removeItem(CACHE_KEY)
}

const RULES = `You are writing a short end-of-day recap for a personal health tracking app called Lifestyle Tracker. The user will read this in the evening, on their phone.

Ground everything in the DATA SNAPSHOT below — never invent numbers, streaks, or facts not present in it.

Hard rules:
- You are not a doctor: never diagnose or suggest treatment. If something sounds medically concerning, gently suggest mentioning it to a doctor.
- No guilt or shame language: never say "you failed," "you should have," "cheat day," or similar. Missed days and rest are normal, not moral failures.
- If a cycle phase estimate is present in the snapshot, treat it as exactly that — an estimate, never a diagnosis or a hormonal certainty. Use pattern-based language.
- Structure the reply as two short parts, plain paragraphs, no headers and no markdown: first "today" specifically (2-4 sentences), then a week-in-review comparing this week's pattern to last week's — what's going well, what isn't, one likely effect of the pattern, and one concrete thing to try tomorrow (2-4 sentences).
- Keep the whole reply under 150 words.`

export function buildEodSystemPrompt(data) {
  return `${RULES}\n\n${summarizeUserData(data)}`
}

export async function generateAiReport(data) {
  const system = buildEodSystemPrompt(data)
  const text = await sendToClaude({
    system,
    messages: [{ role: 'user', content: 'Write my end-of-day recap.' }],
    maxTokens: 400,
  })
  return setCachedReport(text.trim(), 'ai')
}

// ---- Fallback (no API key) path — structured data, not prose, since
// it needs to be formatted as bullet lines rather than sent to an LLM. ----

export function gatherFallbackReportData(data, now = new Date()) {
  const today = todayKey()
  const thisWeek = currentWeekKeys().filter((k) => k <= today)
  const lastWeek = previousWeekKeys()

  const hydration = computeHydrationAutopilot(data, now)

  const nutritionToday = data.nutrition[today] || {}
  const nutritionCountToday = NUTRITION_KEYS.filter((k) => nutritionToday[k]).length

  const workoutToday = !!data.workouts.completions[today]
  const workoutThisWeek = thisWeek.filter((k) => data.workouts.completions[k]).length
  const workoutLastWeek = lastWeek.filter((k) => data.workouts.completions[k]).length

  const moodToday = data.mood.filter((m) => m.date === today)
  const lowMoodThisWeek = data.mood.filter((m) => thisWeek.includes(m.date) && LOW_MOOD_EMOJI.includes(m.emoji)).length

  const phase = estimateCyclePhase(data, today)
  const cycleToday = data.cycle.find((c) => c.date === today)
  const cycleNote = phase && cycleToday?.symptoms?.length > 0 ? phase.line : null

  const comeback = getComebackStatus(data)

  return {
    hydration, nutritionCountToday, workoutToday, workoutThisWeek, workoutLastWeek,
    moodToday, lowMoodThisWeek, cycleNote, comeback,
  }
}

function weekCompareLine(label, thisWeekCount, lastWeekCount, unit) {
  if (thisWeekCount === lastWeekCount) return `${label}: ${thisWeekCount} ${unit} this week, same as last week.`
  const trend = thisWeekCount > lastWeekCount ? 'up from' : 'down from'
  return `${label}: ${thisWeekCount} ${unit} this week, ${trend} ${lastWeekCount} last week.`
}

export function buildFallbackReportText(fb) {
  const lines = []
  lines.push(`Hydration: ${fb.hydration.statusLabel.toLowerCase()}.`)
  if (fb.nutritionCountToday > 0) lines.push(`Nutrition: ${fb.nutritionCountToday}/5 checks today.`)
  lines.push(fb.workoutToday ? 'Workout: trained today.' : 'Workout: rest day.')
  lines.push(weekCompareLine('This week', fb.workoutThisWeek, fb.workoutLastWeek, 'workouts'))
  if (fb.moodToday.length > 0) lines.push(`Mood: ${fb.moodToday.map((m) => m.emoji).join(' ')}`)
  if (fb.cycleNote) lines.push(fb.cycleNote)

  const actions = []
  if (fb.hydration.status === 'likely_low' || fb.hydration.status === 'slightly_low') {
    actions.push('Start tomorrow with a glass of water before anything else.')
  }
  if (!fb.workoutToday && fb.workoutThisWeek < fb.workoutLastWeek && !fb.comeback.isComeback) {
    actions.push("Get one session in tomorrow to keep the week's pace up.")
  }
  if (fb.lowMoodThisWeek >= 3) {
    actions.push('Consider a lighter, lower-pressure day tomorrow if you need it.')
  }
  const cappedActions = actions.slice(0, 3)
  if (cappedActions.length === 0) cappedActions.push('Steady day — keep it up tomorrow.')

  return [...lines, '', 'Tomorrow:', ...cappedActions.map((a) => `- ${a}`)].join('\n')
}
