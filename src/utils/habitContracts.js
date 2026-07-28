import { todayKey, weekdayShort } from './dates'

const MOOD_LOW = ['😞', '😕']

export const TRIGGER_TYPES = [
  {
    id: 'poor_sleep',
    label: 'I slept poorly',
    describe: (param) => `slept under ${param}h`,
    hasParam: true,
    paramLabel: 'Hours or fewer',
    defaultParam: 6,
    check: (data, param) => (data.sleep[todayKey()]?.hours ?? 99) < param,
    templateResponse: 'I skip heavy training and keep today light.',
  },
  {
    id: 'stressed_mood',
    label: "I'm feeling low or stressed",
    describe: () => 'mood logged as low today',
    hasParam: false,
    check: (data) => {
      const today = todayKey()
      const entry = [...data.mood].reverse().find((m) => m.date === today)
      return !!entry && MOOD_LOW.includes(entry.emoji)
    },
    templateResponse: 'I do 10 minutes of walking before anything else.',
  },
  {
    id: 'training_day_pending',
    label: "I haven't trained yet on a training day",
    describe: () => 'a scheduled training day, not completed yet',
    hasParam: false,
    check: (data) => {
      const today = todayKey()
      const scheduledDay = data.workouts.schedule.find((s) => s.day === weekdayShort(today))
      return !!scheduledDay && !scheduledDay.rest && !data.workouts.completions[today]
    },
    templateResponse: "If I don't feel like it, I do the Survival-tier version — 5 minutes, no more required.",
  },
  {
    id: 'water_behind',
    label: "I'm behind on water",
    describe: () => 'under half of today\'s water goal',
    hasParam: false,
    check: (data) => (data.water[todayKey()] || 0) < data.settings.waterGoalMl * 0.5,
    templateResponse: 'I drink one glass right now, no need to catch up all at once.',
  },
]

export function getTriggerType(id) {
  return TRIGGER_TYPES.find((t) => t.id === id)
}

export function activeContractsToday(contracts, data) {
  return contracts.filter((c) => {
    const type = getTriggerType(c.triggerType)
    return type && type.check(data, c.param)
  })
}
