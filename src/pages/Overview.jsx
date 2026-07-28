import { useApp } from '../context/AppContext'
import { todayKey, humanDateFull } from '../utils/dates'
import { streakFromDateSet } from '../utils/streaks'
import Ring from '../components/Ring'
import MiniCard from '../components/MiniCard'
import StreakBadge from '../components/StreakBadge'

const MOOD_EMOJI = ['😞', '😕', '😐', '🙂', '😄']
const NUTRITION_KEYS = ['breakfast', 'lunch', 'dinner', 'vegetables', 'snacks']

export default function Overview({ onNavigate }) {
  const { data } = useApp()
  const today = todayKey()

  const waterToday = data.water[today] || 0
  const waterRatio = Math.min(1, waterToday / data.settings.waterGoalMl)

  const sleepToday = data.sleep[today]
  const sleepRatio = sleepToday ? Math.min(1, sleepToday.hours / data.settings.sleepGoalHours) : 0

  const todaysWorkout = data.workouts.schedule.find((d) => d.day === weekdayAbbrev(today))
  const isRestDay = !todaysWorkout || todaysWorkout.rest
  const workoutRatio = isRestDay ? 1 : (data.workouts.completions[today] ? 1 : 0)

  const score = Math.round(((waterRatio + sleepRatio + workoutRatio) / 3) * 100)

  const waterStreak = streakFromDateSet(new Set(Object.entries(data.water).filter(([, ml]) => ml >= data.settings.waterGoalMl).map(([k]) => k)))
  const sleepStreak = streakFromDateSet(new Set(Object.entries(data.sleep).filter(([, s]) => s.hours >= data.settings.sleepGoalHours).map(([k]) => k)))
  const workoutStreak = streakFromDateSet(new Set(Object.keys(data.workouts.completions).filter((k) => data.workouts.completions[k])))

  const todaysMood = [...data.mood].reverse().find((m) => m.date === today)
  const latestWeight = data.weight[data.weight.length - 1]
  const nutritionToday = data.nutrition[today] || {}
  const nutritionCount = NUTRITION_KEYS.filter((k) => nutritionToday[k]).length

  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">{humanDateFull(today)}</div>
        <h1>Today</h1>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 18px' }}>
        <Ring value={score / 100} size={168} stroke={15}>
          <div className="mono" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{score}</div>
          <div className="text-sm muted" style={{ marginTop: 4 }}>daily score</div>
        </Ring>
        <div style={{ display: 'flex', gap: 18, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          <StreakBadge days={waterStreak} label="water" />
          <StreakBadge days={sleepStreak} label="sleep" />
          <StreakBadge days={workoutStreak} label="workout" />
        </div>
      </div>

      <div className="section-title">At a glance</div>
      <div className="card-row">
        <MiniCard
          label="Mood"
          value={todaysMood ? todaysMood.emoji : '—'}
          sub={todaysMood ? 'Logged today' : 'Not logged'}
          icon="🙂"
          onClick={() => onNavigate('more', 'mood')}
        />
        <MiniCard
          label="Weight"
          value={latestWeight ? `${latestWeight.kg}${data.settings.weightUnit}` : '—'}
          sub={latestWeight ? latestWeight.date.slice(5) : 'No entries'}
          icon="⚖️"
          onClick={() => onNavigate('more', 'weight')}
        />
        <MiniCard
          label="Nutrition"
          value={`${nutritionCount}/5`}
          sub="today"
          icon="🥗"
          onClick={() => onNavigate('more', 'nutrition')}
        />
      </div>

      <div className="section-title">Today's focus</div>
      <div className="stack">
        <SummaryRow
          color="var(--accent-water)"
          label="Water"
          value={`${waterToday} / ${data.settings.waterGoalMl} ml`}
          ratio={waterRatio}
          onClick={() => onNavigate('water')}
        />
        <SummaryRow
          color="var(--accent-sleep)"
          label="Sleep"
          value={sleepToday ? `${sleepToday.hours}h logged` : `Goal: ${data.settings.sleepGoalHours}h`}
          ratio={sleepRatio}
          onClick={() => onNavigate('sleep')}
        />
        <SummaryRow
          color="var(--accent-workout)"
          label="Workout"
          value={isRestDay ? 'Rest day' : (data.workouts.completions[today] ? 'Completed' : todaysWorkout?.label || 'Not set up')}
          ratio={workoutRatio}
          onClick={() => onNavigate('workouts')}
        />
      </div>
    </div>
  )
}

function weekdayAbbrev(key) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const [y, m, d] = key.split('-').map(Number)
  return days[new Date(y, m - 1, d).getDay()]
}

function SummaryRow({ color, label, value, ratio, onClick }) {
  return (
    <button className="card" onClick={onClick} style={{ textAlign: 'left', cursor: 'pointer' }}>
      <div className="row">
        <div className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
          <span className="badge-dot" style={{ background: color }} />
          <span style={{ fontWeight: 600 }}>{label}</span>
        </div>
        <span className="mono text-sm muted">{value}</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'var(--border-soft)', marginTop: 12, overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(ratio * 100)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
    </button>
  )
}
