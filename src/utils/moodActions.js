export const MOOD_STATES = [
  { id: 'stressed', emoji: '😣', label: 'Stressed', logAs: '😕' },
  { id: 'tired', emoji: '🥱', label: 'Tired', logAs: '😐' },
  { id: 'angry', emoji: '😠', label: 'Angry', logAs: '😞' },
  { id: 'sad', emoji: '😔', label: 'Sad', logAs: '😞' },
  { id: 'lazy', emoji: '🛋️', label: 'Lazy', logAs: '😐' },
  { id: 'unmotivated', emoji: '😶', label: 'Unmotivated', logAs: '😐' },
  { id: 'insecure', emoji: '😟', label: 'Insecure', logAs: '😕' },
  { id: 'energetic', emoji: '⚡', label: 'Energetic', logAs: '😄' },
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
