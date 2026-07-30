import { diffDays, addDaysToKey, weekdayShort } from './dates'

const DEFAULT_LENGTH = 28
const DEFAULT_PERIOD_LENGTH = 5
const MIN_LENGTH = 21
const MAX_LENGTH = 35

export const PHASE_META = {
  menstrual: {
    name: 'Menstrual',
    line: (day) => `Pattern suggests you're around day ${day} of your period.`,
  },
  follicular: {
    name: 'Follicular',
    line: () => "Pattern suggests you're likely in the follicular window — energy often trends up here.",
  },
  ovulatory: {
    name: 'Ovulatory',
    line: () => "Pattern suggests you're likely near your estimated ovulation window.",
  },
  luteal: {
    name: 'Luteal',
    line: () => "Pattern suggests you're likely in the luteal window, heading toward your next period.",
  },
}

const NUTRITION_TIPS = {
  menstrual: 'Some find iron-rich foods (leafy greens, beans, lean protein) a helpful pattern during a period — worth noting if it works for you.',
  follicular: "Energy commonly trends up in this window — often a good stretch to try a new meal or recipe.",
  ovulatory: 'Appetite sometimes ticks up around ovulation for some people — nothing to correct, just a pattern.',
  luteal: 'Cravings can run higher in this window for some — a balanced snack on hand is a common strategy.',
}

// Groups dated cycle entries with a logged flow into contiguous-day runs —
// each run's first day is treated as an estimated period start. Gaps of
// more than a day break a run, so sparse/irregular logging degrades
// gracefully into shorter or fewer detected periods rather than crashing.
export function detectPeriods(cycleEntries) {
  const flowDays = [...new Set(cycleEntries.filter((c) => c.flow).map((c) => c.date))].sort()
  const periods = []
  let run = null
  for (const day of flowDays) {
    if (run && diffDays(run.end, day) === 1) {
      run.end = day
    } else {
      if (run) periods.push(run)
      run = { start: day, end: day }
    }
  }
  if (run) periods.push(run)
  return periods
}

// Once 3+ periods have been logged, the user's own average cycle length
// outweighs the generic 28-day template — otherwise fall back to it.
export function estimateCycleLength(periods) {
  if (periods.length < 3) return { value: DEFAULT_LENGTH, source: 'template', cycleCount: Math.max(0, periods.length - 1) }
  const gaps = []
  for (let i = 1; i < periods.length; i++) gaps.push(diffDays(periods[i - 1].start, periods[i].start))
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
  const clamped = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(avg)))
  return { value: clamped, source: 'observed', cycleCount: gaps.length }
}

function periodLengthOf(period) {
  return diffDays(period.start, period.end) + 1
}

// Estimated only — never diagnostic. Returns null once there's no cycle
// data to estimate from at all, or the most recent logged period is old
// enough (2x the estimated length) that a guess would be unreliable.
export function estimateCyclePhase(data, dateKey) {
  const periods = detectPeriods(data.cycle)
  if (periods.length === 0) return null

  const current = [...periods].reverse().find((p) => p.start <= dateKey)
  if (!current) return null

  const length = estimateCycleLength(periods)
  const cycleDay = diffDays(current.start, dateKey) + 1
  if (cycleDay > length.value * 2) return null // too stale to guess responsibly

  const periodLength = periods.length >= 2 ? periodLengthOf(current) || DEFAULT_PERIOD_LENGTH : DEFAULT_PERIOD_LENGTH
  const ovulationCenter = Math.round(length.value / 2)
  const ovulationStart = ovulationCenter - 1
  const ovulationEnd = ovulationCenter + 2

  let phase
  if (cycleDay <= periodLength) phase = 'menstrual'
  else if (cycleDay < ovulationStart) phase = 'follicular'
  else if (cycleDay <= ovulationEnd) phase = 'ovulatory'
  else phase = 'luteal'

  return {
    phase,
    cycleDay,
    estimatedLength: length.value,
    lengthSource: length.source,
    cycleCount: length.cycleCount,
    name: PHASE_META[phase].name,
    line: PHASE_META[phase].line(cycleDay),
  }
}

export function nutritionTipForPhase(phase) {
  return phase ? NUTRITION_TIPS[phase] || null : null
}

// Has the user's own logged history shown they train through their period
// about as normal? Only trusted once at least 2 full past periods are
// available to check against — otherwise there's nothing to weight yet,
// and the generic template nudge in suggestTier applies instead.
export function menstrualTrainingPattern(data) {
  const periods = detectPeriods(data.cycle)
  const pastPeriods = periods.slice(0, -1) // exclude the current/most recent, still in progress
  if (pastPeriods.length < 2) return { known: false }

  let scheduled = 0
  let completed = 0
  for (const p of pastPeriods) {
    let d = p.start
    while (d <= p.end) {
      const wd = data.workouts.schedule.find((s) => s.day === weekdayShort(d))
      if (wd && !wd.rest) {
        scheduled += 1
        if (data.workouts.completions[d]) completed += 1
      }
      d = addDaysToKey(d, 1)
    }
  }
  if (scheduled < 2) return { known: false }
  return { known: true, rate: completed / scheduled }
}
