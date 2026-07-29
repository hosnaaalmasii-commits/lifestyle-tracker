import { currentWeekKeys, todayKey, weekNumber } from './dates'

const NUTRITION_KEYS = ['breakfast', 'lunch', 'dinner', 'vegetables', 'snacks']

const TEMPLATES = [
  {
    id: 'hydration-week',
    icon: 'droplet',
    title: 'Hydration Week',
    target: 5,
    describe: (t) => `Hit your water goal ${t} days this week`,
    progress: (data, weekKeys) => weekKeys.filter((k) => (data.water[k] || 0) >= data.settings.waterGoalMl).length,
  },
  {
    id: 'consistent-sleeper',
    icon: 'moon',
    title: 'Consistent Sleeper',
    target: 5,
    describe: (t) => `Hit your sleep goal ${t} nights this week`,
    progress: (data, weekKeys) => weekKeys.filter((k) => (data.sleep[k]?.hours || 0) >= data.settings.sleepGoalHours).length,
  },
  {
    id: 'workout-streaker',
    icon: 'flame',
    title: 'Training Streak',
    target: 3,
    describe: (t) => `Complete ${t} workouts this week`,
    progress: (data, weekKeys) => weekKeys.filter((k) => data.workouts.completions[k]).length,
  },
  {
    id: 'mood-checkin',
    icon: 'chat',
    title: 'Check In',
    target: 4,
    describe: (t) => `Log your mood ${t} days this week`,
    progress: (data, weekKeys) => weekKeys.filter((k) => data.mood.some((m) => m.date === k)).length,
  },
  {
    id: 'full-plate-week',
    icon: 'apple',
    title: 'Full Plate',
    target: 3,
    describe: (t) => `Complete every nutrition item ${t} days this week`,
    progress: (data, weekKeys) => weekKeys.filter((k) => {
      const d = data.nutrition[k]
      return d && NUTRITION_KEYS.every((n) => d[n])
    }).length,
  },
]

export function getWeeklyChallenge(data) {
  const template = TEMPLATES[weekNumber() % TEMPLATES.length]
  const weekKeys = currentWeekKeys().filter((k) => k <= todayKey())
  const progress = template.progress(data, weekKeys)
  return {
    id: template.id,
    icon: template.icon,
    title: template.title,
    description: template.describe(template.target),
    progress: Math.min(progress, template.target),
    target: template.target,
    complete: progress >= template.target,
  }
}
