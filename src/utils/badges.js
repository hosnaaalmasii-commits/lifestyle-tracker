import { streakFromDateSet } from './streaks'

const NUTRITION_KEYS = ['breakfast', 'lunch', 'dinner', 'vegetables', 'snacks']

function fullNutritionDays(nutrition) {
  return Object.values(nutrition).filter((day) =>
    NUTRITION_KEYS.every((k) => day[k])
  ).length
}

export function computeBadges(data) {
  const waterGoalDates = new Set(
    Object.entries(data.water)
      .filter(([, ml]) => ml >= data.settings.waterGoalMl)
      .map(([k]) => k)
  )
  const sleepGoalDates = new Set(
    Object.entries(data.sleep)
      .filter(([, s]) => s.hours >= data.settings.sleepGoalHours)
      .map(([k]) => k)
  )
  const workoutDates = new Set(Object.keys(data.workouts.completions).filter((k) => data.workouts.completions[k]))

  const waterStreak = streakFromDateSet(waterGoalDates)
  const sleepStreak = streakFromDateSet(sleepGoalDates)
  const workoutStreak = streakFromDateSet(workoutDates)
  const workoutTotal = workoutDates.size
  const photoCount = data.photos.length
  const moodCount = data.mood.length
  const weightCount = data.weight.length
  const fullDays = fullNutritionDays(data.nutrition)

  const list = [
    {
      id: 'first-drop',
      name: 'First Drop',
      description: 'Log water for the first time',
      icon: '💧',
      unlocked: Object.keys(data.water).length >= 1,
    },
    {
      id: 'hydrated-week',
      name: 'Hydrated Week',
      description: 'Hit your water goal 7 days in a row',
      icon: '🌊',
      unlocked: waterStreak >= 7,
    },
    {
      id: 'hydration-habit',
      name: 'Hydration Habit',
      description: 'Hit your water goal 30 days in a row',
      icon: '🏔️',
      unlocked: waterStreak >= 30,
    },
    {
      id: 'well-rested',
      name: 'Well Rested',
      description: 'Hit your sleep goal 7 nights in a row',
      icon: '🌙',
      unlocked: sleepStreak >= 7,
    },
    {
      id: 'dream-team',
      name: 'Dream Log',
      description: 'Log sleep on 30 different nights',
      icon: '⭐',
      unlocked: Object.keys(data.sleep).length >= 30,
    },
    {
      id: 'workout-warrior',
      name: 'Workout Warrior',
      description: 'Complete workouts 7 days in a row',
      icon: '🔥',
      unlocked: workoutStreak >= 7,
    },
    {
      id: 'iron-will',
      name: 'Iron Will',
      description: 'Complete 30 workouts in total',
      icon: '🏆',
      unlocked: workoutTotal >= 30,
    },
    {
      id: 'snapshot',
      name: 'Snapshot',
      description: 'Add your first progress photo',
      icon: '📸',
      unlocked: photoCount >= 1,
    },
    {
      id: 'timeline',
      name: 'Timeline',
      description: 'Add 5 progress photos',
      icon: '🎞️',
      unlocked: photoCount >= 5,
    },
    {
      id: 'mood-tracker',
      name: 'Mood Tracker',
      description: 'Log your mood 7 times',
      icon: '🙂',
      unlocked: moodCount >= 7,
    },
    {
      id: 'full-plate',
      name: 'Full Plate',
      description: 'Complete every nutrition item in a day, 7 times',
      icon: '🥗',
      unlocked: fullDays >= 7,
    },
    {
      id: 'on-track',
      name: 'On Track',
      description: 'Log your weight 10 times',
      icon: '📈',
      unlocked: weightCount >= 10,
    },
  ]

  return list
}
