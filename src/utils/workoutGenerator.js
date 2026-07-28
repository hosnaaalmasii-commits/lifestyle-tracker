// Rule-based weekly workout schedule generator. Deterministic, no AI —
// just a curated exercise pool assembled according to the questionnaire.

const REP_SCHEMES = {
  strength: { sets: 5, reps: '3-5', rest: '2-3 min' },
  muscle: { sets: 4, reps: '8-12', rest: '60-90 sec' },
  fat_loss: { sets: 3, reps: '12-15', rest: '30-45 sec' },
  endurance: { sets: 3, reps: '15-20', rest: '30 sec' },
}

const EXERCISES = {
  chest: ['Barbell Bench Press', 'Incline Dumbbell Press', 'Push-Ups', 'Cable Fly', 'Dips'],
  back: ['Deadlift', 'Pull-Ups / Lat Pulldown', 'Barbell Row', 'Seated Cable Row', 'Face Pulls'],
  legs: ['Back Squat', 'Romanian Deadlift', 'Walking Lunges', 'Leg Press', 'Calf Raises'],
  shoulders: ['Overhead Press', 'Lateral Raises', 'Rear Delt Fly', 'Arnold Press'],
  arms: ['Barbell Curl', 'Skull Crushers', 'Hammer Curl', 'Tricep Pushdown'],
  core: ['Plank', 'Hanging Leg Raise', 'Cable Woodchop', 'Dead Bug'],
  cardio: ['Incline Treadmill Walk', 'Rowing Intervals', 'Cycling', 'Jump Rope'],
  fullBody: ['Goblet Squat', 'Kettlebell Swing', 'Push-Ups', 'Barbell Row', 'Plank'],
}

function pick(list, n, seedOffset = 0) {
  const out = []
  for (let i = 0; i < n; i++) out.push(list[(i + seedOffset) % list.length])
  return [...new Set(out)]
}

function buildExerciseList(regions, scheme, seedOffset) {
  const perRegion = regions.length <= 2 ? 3 : 2
  const list = []
  regions.forEach((region, i) => {
    const pool = EXERCISES[region] || EXERCISES.fullBody
    pick(pool, perRegion, seedOffset + i).forEach((name) =>
      list.push({ name, sets: scheme.sets, reps: scheme.reps, rest: scheme.rest })
    )
  })
  return list
}

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function trainingDaySlots(daysPerWeek) {
  // Spread training days across the week, keeping rest days separated where possible.
  const templates = {
    2: [0, 3],
    3: [0, 2, 4],
    4: [0, 1, 3, 4],
    5: [0, 1, 2, 3, 4],
    6: [0, 1, 2, 3, 4, 5],
  }
  return templates[daysPerWeek] || templates[3]
}

function splitForDays(n, focusAreas) {
  const wantsCore = focusAreas.includes('core')
  const wantsCardio = focusAreas.includes('cardio')
  if (n <= 3) {
    return Array.from({ length: n }, () => ({ label: 'Full Body', regions: ['fullBody'] }))
  }
  if (n === 4) {
    return [
      { label: 'Upper Body', regions: ['chest', 'back', 'shoulders'] },
      { label: 'Lower Body', regions: ['legs', 'core'] },
      { label: 'Upper Body', regions: ['back', 'chest', 'arms'] },
      { label: 'Lower Body', regions: ['legs', wantsCore ? 'core' : 'legs'] },
    ]
  }
  const days = [
    { label: 'Push (Chest / Shoulders / Triceps)', regions: ['chest', 'shoulders', 'arms'] },
    { label: 'Pull (Back / Biceps)', regions: ['back', 'arms'] },
    { label: 'Legs', regions: ['legs'] },
    { label: 'Push (Chest / Shoulders / Triceps)', regions: ['chest', 'shoulders'] },
    { label: 'Pull (Back / Biceps)', regions: ['back', 'arms'] },
    { label: wantsCardio ? 'Conditioning' : wantsCore ? 'Core & Mobility' : 'Legs & Core', regions: wantsCardio ? ['cardio', 'core'] : ['legs', 'core'] },
  ]
  return days.slice(0, n)
}

export function generateWorkoutSchedule({ goal, experience, focusAreas, daysPerWeek }) {
  const scheme = REP_SCHEMES[goal] || REP_SCHEMES.muscle
  const slots = trainingDaySlots(daysPerWeek)
  const splits = splitForDays(daysPerWeek, focusAreas)

  const experienceNote = {
    beginner: 'Focus on clean form and controlled tempo.',
    intermediate: 'Push close to failure on the last set of each exercise.',
    advanced: 'Add intensity techniques (drop sets / rest-pause) where it makes sense.',
  }[experience] || ''

  const schedule = DAY_ORDER.map((day, i) => {
    const slotIndex = slots.indexOf(i)
    if (slotIndex === -1) {
      return { day, rest: true, label: 'Rest', exercises: [] }
    }
    const split = splits[slotIndex]
    const regions = split.regions.length ? split.regions : ['fullBody']
    return {
      day,
      rest: false,
      label: split.label,
      note: experienceNote,
      exercises: buildExerciseList(regions, scheme, slotIndex),
    }
  })

  return schedule
}

export const GOAL_OPTIONS = [
  { value: 'strength', label: 'Strength' },
  { value: 'muscle', label: 'Muscle Gain' },
  { value: 'fat_loss', label: 'Fat Loss' },
  { value: 'endurance', label: 'Endurance' },
]

export const EXPERIENCE_OPTIONS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export const FOCUS_OPTIONS = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'legs', label: 'Legs' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'arms', label: 'Arms' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
]
