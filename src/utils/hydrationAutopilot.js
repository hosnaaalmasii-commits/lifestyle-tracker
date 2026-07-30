import { todayKey } from './dates'
import { estimateCyclePhase } from './cyclePhase'

const WORKOUT_BUMP_ML = 350
const CYCLE_BUMP_ML = 150
const WAKE_HOUR = 7
const WINDOW_HOURS = 16 // rough waking window used to pace expected intake

export const STATUS_META = {
  likely_low: { label: 'Likely low' },
  slightly_low: { label: 'Slightly low' },
  on_track: { label: 'On track' },
  well_hydrated: { label: 'Likely well hydrated' },
  overhydration: { label: 'Avoid overhydration' },
}

// Never a raw "you drank Xml" readout — just a recalculated target, a
// status label, and one concrete action. Recomputes fresh on every call
// (derived, not stored), so it's automatically current the moment a
// workout or drink is logged, or the day rolls over.
export function computeHydrationAutopilot(data, now = new Date()) {
  const today = todayKey()
  const baseline = data.settings.waterGoalMl
  const actual = data.water[today] || 0

  const bumps = []
  if (data.workouts.completions[today]) bumps.push({ label: 'Workout logged today', ml: WORKOUT_BUMP_ML })

  const phase = estimateCyclePhase(data, today)
  if (phase && (phase.phase === 'menstrual' || phase.phase === 'luteal')) {
    bumps.push({ label: `Estimated ${phase.name.toLowerCase()} window`, ml: CYCLE_BUMP_ML })
  }

  const target = baseline + bumps.reduce((s, b) => s + b.ml, 0)

  const hour = now.getHours() + now.getMinutes() / 60
  const expectedFraction = Math.min(1, Math.max(0, (hour - WAKE_HOUR) / WINDOW_HOURS))
  const expected = target * expectedFraction

  let status
  if (actual >= target * 1.5) status = 'overhydration'
  else if (actual >= target * 0.95) status = 'well_hydrated'
  else if (expectedFraction <= 0.02) status = 'on_track'
  else if (actual >= expected * 0.85) status = 'on_track'
  else if (actual >= expected * 0.5) status = 'slightly_low'
  else status = 'likely_low'

  return {
    target,
    baseline,
    bumps,
    status,
    statusLabel: STATUS_META[status].label,
    nextAction: nextActionFor(status, target, actual),
  }
}

function nextActionFor(status, target, actual) {
  const remaining = Math.max(0, target - actual)
  switch (status) {
    case 'likely_low': return `A glass now helps — roughly ${Math.round(remaining)}ml left to reach today's target.`
    case 'slightly_low': return `A bit more over the next while keeps pace with today's target.`
    case 'on_track': return "Keep it up at the current pace."
    case 'well_hydrated': return "Target met — no need to force any more right now."
    case 'overhydration': return 'Well past today\'s target — no need to keep pushing fluids for the rest of the day.'
    default: return ''
  }
}
