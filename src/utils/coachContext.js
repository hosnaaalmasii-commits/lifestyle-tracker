import { todayKey, lastNDayKeys, currentWeekKeys } from './dates'
import { streakFromDateSet } from './streaks'
import { computeXP, levelProgress, levelTitle } from './gamification'
import { computeBadges } from './badges'
import { getWeeklyChallenge } from './challenges'

export const PERSONALITIES = [
  {
    id: 'friendly',
    label: 'Friendly',
    description: 'Warm and encouraging, like a supportive friend',
    voice: 'Warm, encouraging, conversational — like a supportive friend who happens to know a lot about health. Use "we" language occasionally. Never clinical or distant.',
  },
  {
    id: 'strict',
    label: 'Strict',
    description: 'Direct and no-nonsense, holds you accountable',
    voice: 'Direct, no-nonsense, holds the user accountable. Short sentences. Calls out excuses gently but firmly. Still respectful — never mean, shaming, or sarcastic.',
  },
  {
    id: 'scientific',
    label: 'Scientific',
    description: 'Explains the physiology behind advice',
    voice: 'Precise and explanatory — briefly grounds advice in physiology (sleep, recovery, stress response) without turning into a lecture. Cites the specific numbers from the user\'s data when relevant.',
  },
  {
    id: 'minimalist',
    label: 'Minimalist',
    description: 'As few words as possible',
    voice: 'As few words as possible. Prefers one short sentence or a tight 3-item list over paragraphs. No filler, no pleasantries, straight to the useful part.',
  },
  {
    id: 'motivational',
    label: 'Motivational',
    description: 'High energy, focused on momentum',
    voice: 'High-energy and momentum-focused, but not cheesy or over-the-top. Celebrates small wins specifically (not generic "great job!"). Forward-looking.',
  },
  {
    id: 'calm',
    label: 'Calm & therapeutic',
    description: 'Gentle, grounding, low-pressure',
    voice: 'Gentle, grounding, unhurried. Prioritizes reducing pressure over pushing action. Comfortable saying "rest is enough today." Therapeutic in tone without being clinical.',
  },
]

export function getPersonality(id) {
  return PERSONALITIES.find((p) => p.id === id) || PERSONALITIES[0]
}

const RULES = `You are the in-app coach for a personal health tracking app called Lifestyle Tracker. The user is talking to you directly inside the app.

Ground every answer in the DATA SNAPSHOT below — it's the user's real logged data from their own device. Never invent numbers, streaks, or facts not present in it.

Hard rules:
- You are a coach, not a doctor. Never diagnose conditions or give medical treatment advice. If something sounds medically concerning, gently suggest they mention it to a doctor.
- No guilt or shame language: never say "you failed," "you should have," "you missed," "cheat day," or similar. Missed days and rest are normal, not moral failures.
- Keep replies short by default — this is a small phone screen. Prefer 2-5 sentences or a short list unless the user clearly asks for depth.
- Don't suggest features that don't exist in this app (no calendar sync, no wearables, no camera, no social features — this is a private, local, single-user app).
- If the data snapshot doesn't cover what's asked, say so plainly instead of guessing.`

function fmtPct(n, d) {
  if (!d) return '—'
  return `${Math.round((n / d) * 100)}%`
}

export function summarizeUserData(data) {
  const today = todayKey()
  const week = lastNDayKeys(7)

  const waterToday = data.water[today] || 0
  const waterGoal = data.settings.waterGoalMl
  const waterHitsWeek = week.filter((k) => (data.water[k] || 0) >= waterGoal).length

  const sleepToday = data.sleep[today]
  const sleepGoal = data.settings.sleepGoalHours
  const sleepHitsWeek = week.filter((k) => (data.sleep[k]?.hours || 0) >= sleepGoal).length

  const workoutToday = data.workouts.completions[today]
  const workoutDatesSet = new Set(Object.keys(data.workouts.completions).filter((k) => data.workouts.completions[k]))
  const workoutStreak = streakFromDateSet(workoutDatesSet)
  const workoutHitsWeek = week.filter((k) => data.workouts.completions[k]).length

  const waterStreak = streakFromDateSet(new Set(Object.entries(data.water).filter(([, ml]) => ml >= waterGoal).map(([k]) => k)))
  const sleepStreak = streakFromDateSet(new Set(Object.entries(data.sleep).filter(([, s]) => s.hours >= sleepGoal).map(([k]) => k)))

  const recentMoods = [...data.mood].slice(-5).reverse().map((m) => `${m.date.slice(5)}: ${m.emoji}${m.note ? ` ("${m.note}")` : ''}`)

  const nutritionWeek = currentWeekKeys().filter((k) => k <= today)
  const nutritionKeys = ['breakfast', 'lunch', 'dinner', 'vegetables', 'snacks']
  const nutritionCounts = nutritionWeek.map((k) => {
    const d = data.nutrition[k] || {}
    return nutritionKeys.filter((n) => d[n]).length
  })
  const nutritionAvg = nutritionCounts.length ? (nutritionCounts.reduce((a, b) => a + b, 0) / nutritionCounts.length).toFixed(1) : '—'

  const latestWeight = data.weight[data.weight.length - 1]
  const weightTrend = data.weight.length >= 2
    ? `${data.weight[data.weight.length - 1].kg} ${data.settings.weightUnit} (was ${data.weight[data.weight.length - 2].kg} previously)`
    : latestWeight ? `${latestWeight.kg} ${data.settings.weightUnit} (only one entry so far)` : 'not logged'

  const badges = computeBadges(data)
  const unlockedBadges = badges.filter((b) => b.unlocked)
  const xp = computeXP(data, unlockedBadges.length)
  const { level } = levelProgress(xp)
  const challenge = getWeeklyChallenge(data)

  const workoutProfile = data.workouts.profile
    ? `Goal: ${data.workouts.profile.goal}, experience: ${data.workouts.profile.experience}, ${data.workouts.profile.daysPerWeek}x/week`
    : 'No workout plan set up yet'

  return `DATA SNAPSHOT (as of ${today}):

Water: ${waterToday}/${waterGoal} ml today. Goal met ${waterHitsWeek}/7 days this week (${fmtPct(waterHitsWeek, 7)}). Current streak: ${waterStreak} days.
Sleep: ${sleepToday ? `${sleepToday.hours}h logged last night, quality ${sleepToday.quality}/5` : 'not logged yet today'}. Goal ${sleepGoal}h. Goal met ${sleepHitsWeek}/7 days this week. Current streak: ${sleepStreak} days.
Workouts: ${workoutProfile}. Today ${workoutToday ? 'completed' : 'not completed yet'}. This week: ${workoutHitsWeek} sessions done. Current streak: ${workoutStreak} days.
Nutrition: averaging ${nutritionAvg}/5 daily checklist items this week.
Weight: ${weightTrend}.
Mood, most recent entries: ${recentMoods.length ? recentMoods.join('; ') : 'none logged yet'}.
Level ${level} (${levelTitle(level)}), ${unlockedBadges.length}/${badges.length} badges unlocked.
This week's challenge: "${challenge.title}" — ${challenge.progress}/${challenge.target} (${challenge.complete ? 'complete' : 'in progress'}).`
}

export function buildSystemPrompt(personalityId, data) {
  const personality = getPersonality(personalityId)
  return `${RULES}

Coaching voice for this conversation: ${personality.voice}

${summarizeUserData(data)}`
}
