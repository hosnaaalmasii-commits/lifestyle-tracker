// The full Character System growth engine — one shared engine driving all
// ten archetypes, per the "same underlying growth engine, different
// weighting profile, not ten separate systems" requirement. Everything
// here is derived live from existing logs (water/sleep/workouts/nutrition/
// mood/cycle) on every call — the only thing actually stored is the
// archetype/figure choice and a one-time migration credit (data.character).
import { todayKey, addDaysToKey, lastNDayKeys, diffDays, weekdayShort } from './dates'
import { computeConsistencyScore } from './consistencyScore'

const NUTRITION_KEYS = ['breakfast', 'lunch', 'dinner', 'vegetables', 'snacks']
const POINTS_PER_DAY = 10
// Growth is a decayed rolling measure, not a lifetime cumulative total —
// like a real fire, it grows with fuel (good habits) and dies back down
// without it. GROWTH_DECAY sets roughly a 3-week half-life: a couple of
// rough weeks visibly erodes standing, a couple of rough months brings it
// most of the way back to zero, without either crashing on one bad day or
// being a permanent, unlosable achievement.
const GROWTH_WINDOW_DAYS = 90
const GROWTH_DECAY = 0.97

export const ARCHETYPES = [
  { id: 'warrior', name: 'Warrior', tagline: 'a blade being forged and sharpened', color: '#b0553f', weights: { hydration: 1, nutrition: 1, workout: 1.3, sleep: 0.9, moodCycle: 0.8 } },
  { id: 'nature', name: 'Nature creature', tagline: 'a tree filling out its canopy', color: '#4f8f5a', weights: { hydration: 1, nutrition: 1.1, workout: 0.9, sleep: 1, moodCycle: 1.3 } },
  { id: 'fire', name: 'Fire', tagline: 'embers building into a full, hot fire', color: '#d3702f', weights: { hydration: 0.9, nutrition: 1, workout: 1.4, sleep: 0.8, moodCycle: 0.9 } },
  { id: 'moon', name: 'Moon', tagline: 'waning to new, waxing back toward full', color: '#6e71a0', weights: { hydration: 1, nutrition: 0.9, workout: 0.8, sleep: 1.4, moodCycle: 1 } },
  { id: 'robot', name: 'Robot', tagline: 'a frame assembling and powering up', color: '#5c7d8a', weights: { hydration: 1, nutrition: 1, workout: 1, sleep: 1, moodCycle: 0.8, consistency: 1.3 } },
  { id: 'animal', name: 'Animal companion', tagline: 'a fox growing fuller and more alert', color: '#a8783f', weights: { hydration: 1, nutrition: 1, workout: 1, sleep: 1, moodCycle: 1.3 } },
  { id: 'plant', name: 'Plant', tagline: 'a stem coming into bloom', color: '#4f8f61', weights: { hydration: 1.3, nutrition: 1.2, workout: 0.8, sleep: 1, moodCycle: 0.9 } },
  { id: 'dragon', name: 'Dragon', tagline: 'a hatchling growing into its wingspan', color: '#8a4f9e', weights: { hydration: 0.9, nutrition: 1, workout: 1.3, sleep: 0.9, moodCycle: 0.9 } },
  { id: 'spirit', name: 'Spirit', tagline: 'a wisp brightening into a clear glow', color: '#5a7ba6', weights: { hydration: 0.9, nutrition: 0.9, workout: 0.8, sleep: 1.2, moodCycle: 1.2 } },
  { id: 'athlete', name: 'Athlete', tagline: 'a comet building a longer, brighter trail', color: '#c9932f', weights: { hydration: 1, nutrition: 1, workout: 1.3, sleep: 1.2, moodCycle: 0.8 } },
]

export function getArchetype(id) {
  return ARCHETYPES.find((a) => a.id === id) || ARCHETYPES[0]
}

// Kept for the onboarding picker's small archetype badges. The main
// character rendering (ElementalCreature) no longer uses these — each
// archetype is its own bespoke phenomenon now, not one shape + a motif.
export const ARCHETYPE_MOTIFS = {
  warrior: '<path d="M-8,-10 L8,-10 L6,4 L0,10 L-6,4 Z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  nature: '<circle cx="0" cy="0" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M0,-9 L0,-3 M0,9 L0,3 M-9,0 L-3,0 M9,0 L3,0" stroke="currentColor" stroke-width="1.4"/>',
  fire: '<path d="M0,-11 C5,-4 6,2 0,11 C-6,2 -5,-4 0,-11 Z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  moon: '<path d="M6,-9 A9,9 0 1 0 6,9 A7,7 0 1 1 6,-9 Z" fill="currentColor"/>',
  robot: '<rect x="-8" y="-6" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M0,-6 L0,-10" stroke="currentColor" stroke-width="1.6"/><circle cx="0" cy="-10" r="1.6" fill="currentColor"/>',
  animal: '<path d="M-7,-8 Q-10,-14 -4,-11 Z M7,-8 Q10,-14 4,-11 Z" fill="currentColor"/><circle cx="0" cy="2" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  plant: '<path d="M0,10 L0,-6 M0,-6 C-7,-6 -9,-13 -9,-13 C-9,-13 -2,-13 0,-6 M0,-6 C7,-6 9,-13 9,-13 C9,-13 2,-13 0,-6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  dragon: '<path d="M-9,4 Q-4,-10 0,-4 Q4,-10 9,4 Q4,0 0,3 Q-4,0 -9,4 Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  spirit: '<path d="M0,-10 C6,-6 6,4 0,10 C-6,4 -6,-6 0,-10 Z" fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.85"/>',
  athlete: '<path d="M-10,-2 L10,-2 M-10,2 L10,2" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
}

// Thresholds are calibrated against a decayed 90-day weighted sum (see
// totalFeedPoints), not a lifetime count — reaching the top stage requires
// genuinely sustaining strong habits over recent months, and it's just as
// possible to decay back down out of it as it was to climb into it. The
// five thresholds are shared by every archetype; only the display name at
// each index is archetype-specific (see ARCHETYPE_STAGE_NAMES).
export const STAGES = [
  { min: 0 },
  { min: 50 },
  { min: 110 },
  { min: 190 },
  { min: 265 },
]

// Each archetype's own name for the same five thresholds — a blade being
// forged reads nothing like a moon waxing toward full, even though both
// are stage 3 of 5.
export const ARCHETYPE_STAGE_NAMES = {
  fire: ['Spark', 'Kindle', 'Rise', 'Flourish', 'Radiant'],
  moon: ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon'],
  warrior: ['Raw Steel', 'Forged', 'Tempered', 'Honed', 'Masterwork'],
  nature: ['Seedling', 'Sapling', 'Sprouting', 'Flourishing', 'Ancient Growth'],
  robot: ['Dormant', 'Assembling', 'Calibrating', 'Online', 'Fully Charged'],
  animal: ['Kit', 'Cub', 'Yearling', 'Grown', 'Alpha'],
  plant: ['Seed', 'Sprout', 'Bud', 'Blossom', 'Full Bloom'],
  dragon: ['Egg', 'Hatchling', 'Fledgling', 'Adolescent', 'Elder Wyrm'],
  spirit: ['Flicker', 'Wisp', 'Glimmer', 'Aura', 'Luminous'],
  athlete: ['First Stride', 'Building Pace', 'Full Stride', 'Sprint', 'Peak Form'],
}

function workoutRatioFor(data, dayKey) {
  const scheduled = data.workouts.schedule.find((s) => s.day === weekdayShort(dayKey))
  const isRestDay = !scheduled || scheduled.rest
  if (isRestDay) return 1
  return data.workouts.completions[dayKey] ? 1 : 0
}

function dayMetrics(data, dayKey) {
  const water = Math.min(1, (data.water[dayKey] || 0) / data.settings.waterGoalMl)
  const sleepEntry = data.sleep[dayKey]
  const sleep = sleepEntry ? Math.min(1, sleepEntry.hours / data.settings.sleepGoalHours) : 0
  const workout = workoutRatioFor(data, dayKey)
  const nutritionDay = data.nutrition[dayKey] || {}
  const nutrition = NUTRITION_KEYS.filter((k) => nutritionDay[k]).length / NUTRITION_KEYS.length
  const moodCycle = data.mood.some((m) => m.date === dayKey) || data.cycle.some((c) => c.date === dayKey) ? 1 : 0
  return { water, sleep, workout, nutrition, moodCycle }
}

function blendedScore(metrics, weights) {
  const parts = [
    [metrics.water, weights.hydration],
    [metrics.nutrition, weights.nutrition],
    [metrics.workout, weights.workout],
    [metrics.sleep, weights.sleep],
    [metrics.moodCycle, weights.moodCycle],
  ]
  const weightedSum = parts.reduce((s, [v, w]) => s + v * w, 0)
  const weightTotal = parts.reduce((s, [, w]) => s + w, 0)
  return weightTotal > 0 ? weightedSum / weightTotal : 0
}

function dayFeedPoints(data, dayKey, archetype) {
  const metrics = dayMetrics(data, dayKey)
  const score = blendedScore(metrics, archetype.weights)
  const consistencyBoost = archetype.weights.consistency ? 1 + (archetype.weights.consistency - 1) * 0.3 : 1
  return score * POINTS_PER_DAY * consistencyBoost
}

function sumWindow(data, days, archetype) {
  return days.reduce((sum, k) => sum + dayFeedPoints(data, k, archetype), 0)
}

export function weeklyFeedPoints(data, archetype) {
  return sumWindow(data, lastNDayKeys(7), archetype)
}

export function monthlyFeedPoints(data, archetype) {
  return sumWindow(data, lastNDayKeys(30), archetype)
}

// A decayed rolling measure of standing, not a lifetime cumulative total —
// recent days count close to full weight, older days within the window
// fade out exponentially. Grows with consistent good habits; drifts back
// down toward zero over weeks to months of neglect, same as a fire needs
// ongoing fuel or it burns back down to embers.
export function totalFeedPoints(data, archetype) {
  const today = todayKey()
  const createdAt = data.character?.createdAt || today
  const daysSinceCreated = Math.max(0, diffDays(createdAt, today))
  // Never look further back than the character has actually existed —
  // otherwise a brand-new character reads days before it was created
  // (which default to a neutral/rest-day workout ratio) as real history.
  const windowDays = Math.min(GROWTH_WINDOW_DAYS, daysSinceCreated + 1)
  const days = lastNDayKeys(windowDays, today)
  let weightedSum = 0
  days.forEach((k, i) => {
    const daysAgo = days.length - 1 - i
    weightedSum += dayFeedPoints(data, k, archetype) * Math.pow(GROWTH_DECAY, daysAgo)
  })

  // The one-time migration credit from Spark's old XP is blended in the
  // same way — a fading head start rather than a permanent floor, so
  // within a couple of months it's entirely the user's own recent habits
  // driving the number.
  const credit = (data.character?.feedPointCredit || 0) * Math.pow(GROWTH_DECAY, daysSinceCreated)

  return credit + weightedSum
}

// stageIndex + progress only — archetype-specific naming is layered on by
// computeCharacter via ARCHETYPE_STAGE_NAMES, since the same thresholds
// mean something different for every archetype.
export function evolutionStage(total) {
  let stageIndex = 0
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (total >= STAGES[i].min) { stageIndex = i; break }
  }
  const stage = STAGES[stageIndex]
  const next = STAGES[stageIndex + 1]
  const progress = next ? Math.min(1, (total - stage.min) / (next.min - stage.min)) : 1
  return { stageIndex, progress }
}

// vitality (0..1) drives the elemental rendering directly — how hot the
// fire burns, how full the moon is, how bright the spirit glows, etc. —
// independent of growth stage (which drives size/complexity instead).
const CONDITION_META = {
  newbond: { name: 'New Bond', tier: 'special', vitality: 0.3, muted: false },
  depleted: { name: 'Depleted', tier: 'damage', vitality: 0.05, muted: true },
  fatigued: { name: 'Fatigued', tier: 'damage', vitality: 0.15, muted: true },
  overextended: { name: 'Overextended', tier: 'damage', vitality: 0.2, muted: true },
  roughpatch: { name: 'Weathering a Rough Patch', tier: 'damage', vitality: 0.25, muted: true },
  underhydrated: { name: 'Under-hydrated', tier: 'caution', vitality: 0.4, muted: true },
  underfueled: { name: 'Under-fueled', tier: 'caution', vitality: 0.4, muted: true },
  underrested: { name: 'Under-rested', tier: 'caution', vitality: 0.4, muted: true },
  undermoved: { name: 'Under-moved', tier: 'caution', vitality: 0.4, muted: true },
  recovering: { name: 'Recovering', tier: 'positive', vitality: 0.55, muted: false },
  balanced: { name: 'Balanced', tier: 'positive', vitality: 0.7, muted: false },
  energized: { name: 'Energized', tier: 'positive', vitality: 0.85, muted: false },
  thriving: { name: 'Thriving', tier: 'positive', vitality: 0.95, muted: false },
  radiant: { name: 'Radiant', tier: 'positive', vitality: 1, muted: false, glow: true },
}

const HEADLINES = {
  newbond: 'Just getting started.',
  depleted: 'Running low across the board — nothing broken, just needs a hand.',
  fatigued: 'Sleep has been short for weeks now.',
  overextended: "Movement's been light for a while.",
  roughpatch: "It's been a rough stretch overall.",
  underhydrated: "Water's a little behind this week.",
  underfueled: "Meals have been light this week.",
  underrested: "Sleep's a little behind this week.",
  undermoved: "Movement's a little behind this week.",
  recovering: 'Coming back steady — nice work.',
  balanced: 'A steady, on-track stretch.',
  energized: "Today's landing well.",
  thriving: 'This whole week has been strong.',
  radiant: 'Both the week and the month have been strong.',
}

function nextActionFor(key, drivers) {
  const weakest = [...drivers].sort((a, b) => a.ratio - b.ratio)[0]
  switch (key) {
    case 'newbond': return 'Log a few days and a real picture starts to form.'
    case 'depleted': return 'One good day on water, food, and sleep starts turning this around.'
    case 'fatigued': return 'An earlier night is the single biggest lever here.'
    case 'overextended': return 'A short session, even 10 minutes, starts resetting this.'
    case 'roughpatch': return 'Nothing dramatic needed — just a few steadier days in a row.'
    case 'underhydrated': return 'A bit more water today keeps this from slipping further.'
    case 'underfueled': return "Getting a full meal in today helps."
    case 'underrested': return 'An earlier night tonight would help.'
    case 'undermoved': return 'Any movement today counts.'
    case 'recovering': return weakest ? `${weakest.label} is still catching up — keep at it.` : 'Keep today going the way it started.'
    case 'thriving': case 'radiant': case 'energized': return 'Nothing to fix — enjoy it.'
    default: return 'Steady as it is — no changes needed.'
  }
}

// Checked in priority order, first match wins. Damage states require the
// pattern to hold across BOTH the 7-day and 30-day window — never from
// one bad day. All copy stays estimate-qualified and supportive.
function computeConditionKey(data, weekAvg, monthAvg, todayScore, priorAvg, loggedDays) {
  if (loggedDays < 7) return 'newbond'

  const jointLow = (metric) => weekAvg[metric] < 0.35 && monthAvg[metric] < 0.35
  if (jointLow('water') && jointLow('nutrition')) return 'depleted'
  if (weekAvg.sleep < 0.4 && monthAvg.sleep < 0.4) return 'fatigued'
  if (monthAvg.workout < 0.35) return 'overextended'
  if (monthAvg.blended < 0.35) return 'roughpatch'

  if (weekAvg.water < 0.5) return 'underhydrated'
  if (weekAvg.nutrition < 0.4) return 'underfueled'
  if (weekAvg.sleep < 0.55) return 'underrested'
  if (weekAvg.workout < 0.5) return 'undermoved'

  if (todayScore - priorAvg >= 0.2) return 'recovering'
  if (weekAvg.blended >= 0.85 && monthAvg.blended >= 0.85) return 'radiant'
  if (todayScore >= 0.85) return 'energized'
  if (weekAvg.blended >= 0.75) return 'thriving'
  return 'balanced'
}

// Full 14-state read: which condition the character is in today, plus
// which raw inputs drove it, for the tap-to-reveal breakdown.
export function computeConditionState(data) {
  const today = todayKey()
  const createdAt = data.character?.createdAt || today
  const loggedDays = Math.min(30, diffDays(createdAt, today) + 1)

  const week = lastNDayKeys(7)
  const month = lastNDayKeys(30)
  const priorWeek = lastNDayKeys(7, addDaysToKey(today, -7))

  const avgOf = (days, key) => days.reduce((s, k) => s + dayMetrics(data, k)[key], 0) / days.length
  const blendedOf = (days) => days.reduce((s, k) => s + blendedScore(dayMetrics(data, k), UNWEIGHTED), 0) / days.length

  const weekAvg = { water: avgOf(week, 'water'), nutrition: avgOf(week, 'nutrition'), sleep: avgOf(week, 'sleep'), workout: avgOf(week, 'workout'), blended: blendedOf(week) }
  const monthAvg = { water: avgOf(month, 'water'), nutrition: avgOf(month, 'nutrition'), sleep: avgOf(month, 'sleep'), workout: avgOf(month, 'workout'), blended: blendedOf(month) }
  const todayMetrics = dayMetrics(data, today)
  const todayScore = blendedScore(todayMetrics, UNWEIGHTED)
  const priorAvg = blendedOf(priorWeek)

  const key = computeConditionKey(data, weekAvg, monthAvg, todayScore, priorAvg, loggedDays)
  const meta = CONDITION_META[key]

  const waterToday = data.water[today] || 0
  const sleepToday = data.sleep[today]
  const workoutLabel = (() => {
    const scheduled = data.workouts.schedule.find((s) => s.day === weekdayShort(today))
    if (!scheduled || scheduled.rest) return 'Rest day'
    return data.workouts.completions[today] ? 'Done' : 'Not yet'
  })()

  const drivers = [
    { key: 'water', label: 'Water (7d)', ratio: weekAvg.water, valueLabel: `${waterToday}ml today` },
    { key: 'nutrition', label: 'Nutrition (7d)', ratio: weekAvg.nutrition, valueLabel: `${Math.round(weekAvg.nutrition * 5)}/5 avg` },
    { key: 'sleep', label: 'Sleep (7d)', ratio: weekAvg.sleep, valueLabel: sleepToday ? `${sleepToday.hours}h last night` : 'Not logged' },
    { key: 'workout', label: 'Workout', ratio: weekAvg.workout, valueLabel: workoutLabel },
  ]

  return {
    key,
    name: meta.name,
    tier: meta.tier,
    vitality: meta.vitality,
    muted: meta.muted,
    glow: !!meta.glow,
    headline: HEADLINES[key],
    drivers,
    nextAction: nextActionFor(key, drivers),
  }
}

const UNWEIGHTED = { hydration: 1, nutrition: 1, workout: 1, sleep: 1, moodCycle: 1 }

// Single entry point a component needs: archetype flavor + evolution +
// today's condition, all in one derived read.
export function computeCharacter(data) {
  const archetype = getArchetype(data.character?.archetype)
  const names = ARCHETYPE_STAGE_NAMES[archetype.id]
  const total = totalFeedPoints(data, archetype)
  const { stageIndex, progress } = evolutionStage(total)
  const condition = computeConditionState(data)
  return {
    archetype,
    totalFeedPoints: Math.round(total),
    weeklyFeedPoints: Math.round(weeklyFeedPoints(data, archetype)),
    stage: {
      stageIndex,
      progress,
      name: names[stageIndex],
      next: names[stageIndex + 1] || null,
    },
    // 0..1 blend of stage progress, for growth-driven rendering (size,
    // complexity) independent of today's condition (vitality/brightness).
    growth: (stageIndex + progress) / STAGES.length,
    condition,
  }
}
