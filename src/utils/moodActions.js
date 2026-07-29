// The 5-point daily mood scale. `emoji` is the value actually persisted in
// data.mood entries (kept as-is for backward compatibility with existing
// logs) — `icon` is only the display glyph, decoupled from storage.
export const MOOD_SCALE = [
  { emoji: '😞', value: 1, label: 'Rough', icon: 'faceRough' },
  { emoji: '😕', value: 2, label: 'Low', icon: 'faceLow' },
  { emoji: '😐', value: 3, label: 'Okay', icon: 'faceOkay' },
  { emoji: '🙂', value: 4, label: 'Good', icon: 'faceGood' },
  { emoji: '😄', value: 5, label: 'Great', icon: 'faceGreat' },
]

export function faceIconForEmoji(emoji) {
  return MOOD_SCALE.find((m) => m.emoji === emoji)?.icon || 'faceOkay'
}

// The 8-state quick mood-to-action check-in. `logAs` maps back onto the
// MOOD_SCALE emoji above when the user chooses to also log it as today's mood.
export const MOOD_STATES = [
  { id: 'stressed', icon: 'moodStressed', label: 'Stressed', logAs: '😕' },
  { id: 'tired', icon: 'moodTired', label: 'Tired', logAs: '😐' },
  { id: 'angry', icon: 'moodAngry', label: 'Angry', logAs: '😞' },
  { id: 'sad', icon: 'moodSad', label: 'Sad', logAs: '😞' },
  { id: 'lazy', icon: 'moodLazy', label: 'Lazy', logAs: '😐' },
  { id: 'unmotivated', icon: 'moodUnmotivated', label: 'Unmotivated', logAs: '😐' },
  { id: 'insecure', icon: 'moodInsecure', label: 'Insecure', logAs: '😕' },
  { id: 'energetic', icon: 'moodEnergetic', label: 'Energetic', logAs: '😄' },
]

export const MOOD_ACTIONS = {
  stressed: ['Take 5 slow breaths — 4 counts in, 6 counts out', 'Step outside for a 10-minute walk', 'Write down what\'s on your mind for 2 minutes'],
  tired: ['Rest for 10 minutes before deciding anything else', 'Light stretching instead of a full workout', 'Drink some water — tiredness is often just thirst'],
  angry: ['Step away for 5 minutes before responding to anything', 'A brisk walk to burn off the edge', 'Write down the angry version, then don\'t send it'],
  sad: ['Reach out to one person, even just to say hi', 'A short walk outside, ideally in daylight', 'Do one small kind thing for yourself today'],
  lazy: ['Just 5 minutes — a Survival-tier workout, no more required', 'One glass of water, then reassess in 10 minutes', 'Put your shoes on. That\'s the whole task for now.'],
  unmotivated: ['Pick the smallest possible version of today\'s plan', 'Do it for someone else\'s reason today, not your own', 'Skip deciding — just do the Survival-tier workout'],
  insecure: ['Check your Consistency Score instead of the mirror', 'Message someone who makes you feel steady', 'Showing up today counts more than how you look doing it'],
  energetic: ['Good day for the Full-tier workout', 'Tackle the thing you\'ve been avoiding', 'Bank this energy — note what\'s working today'],
}

export function getMoodState(id) {
  return MOOD_STATES.find((m) => m.id === id)
}
