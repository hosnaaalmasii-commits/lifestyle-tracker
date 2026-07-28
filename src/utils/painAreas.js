export const PAIN_AREAS = [
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'back', label: 'Back' },
  { id: 'knees', label: 'Knees' },
  { id: 'hips', label: 'Hips' },
  { id: 'wrists', label: 'Wrists' },
  { id: 'elbows', label: 'Elbows' },
]

// Mapped per exercise name rather than by the coarse workout "region" tag —
// a fullBody-split day tags every exercise 'fullBody', which would make
// region-based matching useless for flagging specific sore spots.
const EXERCISE_AREAS = {
  'Barbell Bench Press': ['shoulders', 'wrists'],
  'Incline Dumbbell Press': ['shoulders'],
  'Push-Ups': ['shoulders', 'wrists'],
  'Cable Fly': ['shoulders'],
  'Dips': ['shoulders', 'elbows'],
  'Deadlift': ['back', 'hips'],
  'Pull-Ups / Lat Pulldown': ['shoulders', 'elbows'],
  'Barbell Row': ['back'],
  'Seated Cable Row': ['back'],
  'Face Pulls': ['shoulders'],
  'Back Squat': ['knees', 'hips', 'back'],
  'Romanian Deadlift': ['back', 'hips'],
  'Walking Lunges': ['knees', 'hips'],
  'Leg Press': ['knees'],
  'Overhead Press': ['shoulders'],
  'Lateral Raises': ['shoulders'],
  'Rear Delt Fly': ['shoulders'],
  'Arnold Press': ['shoulders'],
  'Barbell Curl': ['elbows'],
  'Skull Crushers': ['elbows'],
  'Hammer Curl': ['elbows', 'wrists'],
  'Tricep Pushdown': ['elbows'],
  'Plank': ['back', 'wrists'],
  'Hanging Leg Raise': ['shoulders'],
  'Cable Woodchop': ['back'],
  'Dead Bug': ['back'],
  'Incline Treadmill Walk': ['knees'],
  'Rowing Intervals': ['back'],
  'Cycling': ['knees'],
  'Jump Rope': ['knees'],
  'Goblet Squat': ['knees', 'hips'],
  'Kettlebell Swing': ['back', 'hips'],
}

export function areasForExercise(name) {
  return EXERCISE_AREAS[name] || []
}

export function isExerciseFlagged(name, flaggedAreaIds) {
  if (!flaggedAreaIds || flaggedAreaIds.length === 0) return false
  return areasForExercise(name).some((a) => flaggedAreaIds.includes(a))
}
