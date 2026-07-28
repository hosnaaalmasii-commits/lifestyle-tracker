import { todayKey, weekdayShort } from './dates'

const HABITS = [
  { id: 'stand-up', text: 'Stand up and stretch for 60 seconds, right now.', context: [] },
  { id: 'water-glass', text: 'Drink one full glass of water before your next task.', context: ['waterBehind'] },
  { id: 'phone-away', text: 'Put your phone in another room for the next hour.', context: ['evening'] },
  { id: 'deep-breath', text: 'Take 3 slow breaths before you open your next app.', context: ['lowMood'] },
  { id: 'sunlight', text: 'Get 5 minutes of daylight, even through a window.', context: ['morning'] },
  { id: 'tidy-one', text: 'Tidy just one small surface — a desk corner, a counter.', context: ['restDay'] },
  { id: 'text-someone', text: "Send one message to someone you've been meaning to reach.", context: ['lowMood'] },
  { id: 'walk-call', text: 'Take your next phone call standing up or walking.', context: [] },
  { id: 'protein-first', text: 'Whatever you eat next, add a source of protein.', context: [] },
  { id: 'screen-break', text: 'Look at something 20 feet away for 20 seconds.', context: ['evening', 'afternoon'] },
  { id: 'stretch-legs', text: 'Two minutes of leg stretches before you sit back down.', context: ['restDay'] },
  { id: 'gratitude', text: 'Name one thing that went fine today — just one.', context: ['evening', 'lowMood'] },
  { id: 'water-morning', text: 'Start with a glass of water before coffee.', context: ['morning'] },
  { id: 'posture', text: 'Reset your posture right now — shoulders down, chin level.', context: [] },
  { id: 'wind-down', text: 'Dim the lights 30 minutes before you plan to sleep.', context: ['evening'] },
]

function hashString(s) {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h
}

/** A small, context-matched suggestion — stable for the whole day, not random per render. */
export function getMicroHabit(data) {
  const today = todayKey()
  const hour = new Date().getHours()
  const ctx = new Set()
  if (hour < 11) ctx.add('morning')
  else if (hour < 17) ctx.add('afternoon')
  else ctx.add('evening')

  const scheduledDay = data.workouts.schedule.find((s) => s.day === weekdayShort(today))
  if (!scheduledDay || scheduledDay.rest) ctx.add('restDay')
  if ((data.water[today] || 0) < data.settings.waterGoalMl * 0.5) ctx.add('waterBehind')

  const todaysMood = [...data.mood].reverse().find((m) => m.date === today)
  if (todaysMood && ['😞', '😕'].includes(todaysMood.emoji)) ctx.add('lowMood')

  const matched = HABITS.filter((h) => h.context.some((c) => ctx.has(c)))
  const pool = matched.length ? matched : HABITS
  const idx = hashString(today + '-habit') % pool.length
  return pool[idx]
}
