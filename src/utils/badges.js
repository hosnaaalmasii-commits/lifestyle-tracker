import { streakFromDateSet, longestStreakFromDateSet } from './streaks'

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
  const moodDates = new Set(data.mood.map((m) => m.date))
  const moodStreak = streakFromDateSet(moodDates)
  const longestWaterStreak = longestStreakFromDateSet(waterGoalDates)
  const longestWorkoutStreak = longestStreakFromDateSet(workoutDates)
  const prCount = Object.values(data.workouts.exerciseLogs || {}).reduce((sum, logs) => sum + logs.length, 0)
  const usedAllSections = ['water', 'sleep', 'workouts', 'weight', 'mood', 'nutrition', 'photos'].every((k) => {
    if (k === 'water') return Object.keys(data.water).length > 0
    if (k === 'sleep') return Object.keys(data.sleep).length > 0
    if (k === 'workouts') return workoutTotal > 0
    if (k === 'weight') return weightCount > 0
    if (k === 'mood') return moodCount > 0
    if (k === 'nutrition') return fullDays > 0 || Object.keys(data.nutrition).length > 0
    if (k === 'photos') return photoCount > 0
    return false
  })

  const list = [
    {
      id: 'first-drop',
      name: 'First Drop',
      description: 'Log water for the first time',
      icon: 'droplet',
      unlocked: Object.keys(data.water).length >= 1,
    },
    {
      id: 'hydrated-week',
      name: 'Hydrated Week',
      description: 'Hit your water goal 7 days in a row',
      icon: 'droplet',
      unlocked: waterStreak >= 7,
    },
    {
      id: 'hydration-habit',
      name: 'Hydration Habit',
      description: 'Hit your water goal 30 days in a row',
      icon: 'mountain',
      unlocked: waterStreak >= 30,
    },
    {
      id: 'well-rested',
      name: 'Well Rested',
      description: 'Hit your sleep goal 7 nights in a row',
      icon: 'moon',
      unlocked: sleepStreak >= 7,
    },
    {
      id: 'dream-team',
      name: 'Dream Log',
      description: 'Log sleep on 30 different nights',
      icon: 'star',
      unlocked: Object.keys(data.sleep).length >= 30,
    },
    {
      id: 'workout-warrior',
      name: 'Workout Warrior',
      description: 'Complete workouts 7 days in a row',
      icon: 'flame',
      unlocked: workoutStreak >= 7,
    },
    {
      id: 'iron-will',
      name: 'Iron Will',
      description: 'Complete 30 workouts in total',
      icon: 'trophy',
      unlocked: workoutTotal >= 30,
    },
    {
      id: 'snapshot',
      name: 'Snapshot',
      description: 'Add your first progress photo',
      icon: 'camera',
      unlocked: photoCount >= 1,
    },
    {
      id: 'timeline',
      name: 'Timeline',
      description: 'Add 5 progress photos',
      icon: 'images',
      unlocked: photoCount >= 5,
    },
    {
      id: 'mood-tracker',
      name: 'Mood Tracker',
      description: 'Log your mood 7 times',
      icon: 'chat',
      unlocked: moodCount >= 7,
    },
    {
      id: 'full-plate',
      name: 'Full Plate',
      description: 'Complete every nutrition item in a day, 7 times',
      icon: 'apple',
      unlocked: fullDays >= 7,
    },
    {
      id: 'on-track',
      name: 'On Track',
      description: 'Log your weight 10 times',
      icon: 'trendUp',
      unlocked: weightCount >= 10,
    },
    {
      id: 'checked-in',
      name: 'Checked In',
      description: 'Log your mood 5 days in a row',
      icon: 'heart',
      unlocked: moodStreak >= 5,
    },
    {
      id: 'century-water',
      name: 'Century Club',
      description: 'Hit your water goal on 100 different days',
      icon: 'gem',
      unlocked: waterGoalDates.size >= 100,
    },
    {
      id: 'unbreakable-water',
      name: 'Unbreakable',
      description: 'Reach a 60-day water streak',
      icon: 'shield',
      unlocked: longestWaterStreak >= 60,
    },
    {
      id: 'century-workout',
      name: 'Centurion',
      description: 'Complete 100 workouts in total',
      icon: 'crown',
      unlocked: workoutTotal >= 100,
    },
    {
      id: 'personal-best',
      name: 'Personal Best',
      description: 'Log your first exercise PR',
      icon: 'dumbbell',
      unlocked: prCount >= 1,
    },
    {
      id: 'well-rounded',
      name: 'Well Rounded',
      description: 'Use every section of the app at least once',
      icon: 'compass',
      unlocked: usedAllSections,
    },
    {
      id: 'marathon-workout',
      name: 'Marathon',
      description: 'Reach a 30-day workout streak',
      icon: 'medal',
      unlocked: longestWorkoutStreak >= 30,
    },
  ]

  return list
}
