import { computeConsistencyScore } from './consistencyScore'

export const PHASES = [
  {
    id: 'foundation',
    label: 'Foundation',
    icon: 'leaf',
    threshold: 0,
    description: 'Just show up. Even the Survival tier counts here — the goal is building the habit of checking in daily, not doing it perfectly.',
  },
  {
    id: 'momentum',
    label: 'Momentum',
    icon: 'flame',
    threshold: 35,
    description: "You've got a rhythm going. Aim for the Short tier or better most days, and start noticing your own patterns in Insights.",
  },
  {
    id: 'strength',
    label: 'Strength',
    icon: 'dumbbell',
    threshold: 60,
    description: 'Push toward Full-tier sessions when you can, chase a PR, and lean on Habit Contracts for the harder days.',
  },
  {
    id: 'mastery',
    label: 'Mastery',
    icon: 'crown',
    threshold: 80,
    description: "This is who you are now, not something you're working toward. Maintain, refine, and let it hold through busy weeks.",
  },
]

export function getGPSStatus(data) {
  const { score, label } = computeConsistencyScore(data)
  let phaseIndex = 0
  for (let i = 0; i < PHASES.length; i++) {
    if (score >= PHASES[i].threshold) phaseIndex = i
  }
  const current = PHASES[phaseIndex]
  const next = PHASES[phaseIndex + 1] || null
  const progress = next
    ? Math.max(0, Math.min(1, (score - current.threshold) / (next.threshold - current.threshold)))
    : 1

  return { score, consistencyLabel: label, phaseIndex, current, next, progress }
}
