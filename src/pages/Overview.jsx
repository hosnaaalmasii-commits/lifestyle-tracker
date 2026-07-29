import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayKey, humanDateFull, lastNDayKeys, addDaysToKey } from '../utils/dates'
import { streakFromDateSet } from '../utils/streaks'
import { computeInsights } from '../utils/insights'
import { computeBadges } from '../utils/badges'
import { computeXP } from '../utils/gamification'
import { computeConsistencyScore } from '../utils/consistencyScore'
import Ring from '../components/Ring'
import MiniCard from '../components/MiniCard'
import StreakBadge from '../components/StreakBadge'
import LevelBar from '../components/LevelBar'
import Confetti from '../components/Confetti'
import MoodCheckIn from '../components/MoodCheckIn'
import { activeContractsToday, getTriggerType } from '../utils/habitContracts'
import { getMicroHabit } from '../utils/microHabits'
import { getGPSStatus } from '../utils/lifestyleGPS'
import { faceIconForEmoji } from '../utils/moodActions'
import Icon from '../components/Icon'
import MascotCard from '../components/MascotCard'
import Sparkline from '../components/Sparkline'
import ChangeIndicator from '../components/ChangeIndicator'

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

  const celebratedToday = useRef(null)
  const [confettiTick, setConfettiTick] = useState(0)
  const [moodCheckInOpen, setMoodCheckInOpen] = useState(false)
  useEffect(() => {
    if (score >= 100 && celebratedToday.current !== today) {
      celebratedToday.current = today
      setConfettiTick((n) => n + 1)
    }
  }, [score, today])

  const waterStreak = streakFromDateSet(new Set(Object.entries(data.water).filter(([, ml]) => ml >= data.settings.waterGoalMl).map(([k]) => k)))
  const sleepStreak = streakFromDateSet(new Set(Object.entries(data.sleep).filter(([, s]) => s.hours >= data.settings.sleepGoalHours).map(([k]) => k)))
  const workoutStreak = streakFromDateSet(new Set(Object.keys(data.workouts.completions).filter((k) => data.workouts.completions[k])))

  const todaysMood = [...data.mood].reverse().find((m) => m.date === today)
  const latestWeight = data.weight[data.weight.length - 1]
  const nutritionToday = data.nutrition[today] || {}
  const nutritionCount = NUTRITION_KEYS.filter((k) => nutritionToday[k]).length

  const badges = computeBadges(data)
  const xp = computeXP(data, badges.filter((b) => b.unlocked).length)
  const topInsights = computeInsights(data).slice(0, 2)

  const { colors, useGradientAccents } = data.settings
  const consistency = computeConsistencyScore(data)
  const activeContracts = activeContractsToday(data.habitContracts, data)
  const microHabit = getMicroHabit(data)
  const gps = getGPSStatus(data)

  const last7 = lastNDayKeys(7)
  const waterTrend = last7.map((k) => data.water[k] || 0)
  const sleepTrend = last7.map((k) => data.sleep[k]?.hours || 0)
  const yesterday = addDaysToKey(today, -1)
  const waterDelta = data.water[yesterday] != null ? waterToday - data.water[yesterday] : null
  const sleepDelta = data.sleep[yesterday] != null && sleepToday ? +(sleepToday.hours - data.sleep[yesterday].hours).toFixed(1) : null

  return (
    <div className="page">
      <Confetti trigger={confettiTick} />
      <div className="page-header">
        <div className="eyebrow">{humanDateFull(today)}</div>
        <h1>Today</h1>
      </div>

      <div className="card hero-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 18px' }}>
        <Ring
          value={score / 100}
          size={168}
          stroke={15}
          color={colors.ring}
          gradientTo={useGradientAccents ? colors.gradientEnd : undefined}
        >
          <div className="mono" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{score}</div>
          <div className="text-sm muted" style={{ marginTop: 4 }}>daily score</div>
        </Ring>
        <div style={{ display: 'flex', gap: 18, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
          <StreakBadge days={waterStreak} label="water" />
          <StreakBadge days={sleepStreak} label="sleep" />
          <StreakBadge days={workoutStreak} label="workout" />
        </div>
        <div
          style={{
            marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-soft)',
            width: '100%', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8,
          }}
        >
          <span className="text-sm muted">Consistency</span>
          <span className="mono" style={{ fontWeight: 700 }}>{consistency.score}</span>
          <span className="text-sm" style={{ color: 'var(--accent)', fontWeight: 600 }}>{consistency.label}</span>
        </div>
      </div>

      <MascotCard xp={xp} onClick={() => onNavigate('more', 'badges')} />

      {activeContracts.length > 0 && (
        <button
          className="card"
          style={{ marginTop: 12, textAlign: 'left', cursor: 'pointer', borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--border-soft))' }}
          onClick={() => onNavigate('more', 'contracts')}
        >
          <div className="tag row" style={{ background: 'transparent', color: 'var(--accent)', padding: 0, marginBottom: 6, gap: 6, justifyContent: 'flex-start' }}>
            <Icon name="handshake" size={13} /> Contract active today
          </div>
          {activeContracts.map((c) => (
            <p key={c.id} style={{ margin: '2px 0', fontSize: 14 }}>
              <span className="faint">If {getTriggerType(c.triggerType)?.label.toLowerCase()} — </span>{c.response}
            </p>
          ))}
        </button>
      )}

      {data.calendarStatus?.connected && (
        <button className="card row" style={{ marginTop: 12, cursor: 'pointer' }} onClick={() => onNavigate('workouts')}>
          <div className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
            <span style={{ color: 'var(--accent)' }}><Icon name="calendar" size={18} /></span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              Today's calendar: {data.calendarStatus.busyMinutesToday >= 360 ? 'packed' : data.calendarStatus.busyMinutesToday >= 180 ? 'busy' : 'light'}
            </span>
          </div>
          <span className="faint" aria-hidden><Icon name="chevronRight" size={16} /></span>
        </button>
      )}

      <button className="card" style={{ marginTop: 12, textAlign: 'left', cursor: 'pointer' }} onClick={() => onNavigate('more', 'badges')}>
        <LevelBar xp={xp} compact />
      </button>

      <button className="card row" style={{ marginTop: 12, cursor: 'pointer' }} onClick={() => onNavigate('more', 'gps')}>
        <div className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
          <span style={{ color: 'var(--accent)' }}><Icon name={gps.current.icon} size={18} /></span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{gps.current.label} phase</span>
        </div>
        <span className="faint" aria-hidden><Icon name="chevronRight" size={16} /></span>
      </button>

      <div className="card-row" style={{ marginTop: 12 }}>
        <button className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => onNavigate('more', 'coach')}>
          <div style={{ marginBottom: 8, color: 'var(--accent)' }}><Icon name="sparkle" size={20} /></div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Ask your coach</div>
          <div className="text-sm faint">Grounded in your data</div>
        </button>
        <button className="card" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setMoodCheckInOpen(true)}>
          <div style={{ marginBottom: 8, color: 'var(--accent)' }}><Icon name="heart" size={20} /></div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Need a moment?</div>
          <div className="text-sm faint">Quick mood-to-action</div>
        </button>
      </div>

      <MoodCheckIn open={moodCheckInOpen} onClose={() => setMoodCheckInOpen(false)} />

      <div className="card" style={{ marginTop: 12 }}>
        <div className="tag row" style={{ background: 'transparent', color: 'var(--moss)', padding: 0, marginBottom: 6, gap: 6, justifyContent: 'flex-start' }}>
          <Icon name="leaf" size={13} /> Today's micro-habit
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{microHabit.text}</p>
      </div>

      {topInsights.length > 0 && (
        <>
          <div className="section-title">Insights</div>
          <div>
            {topInsights.map((ins) => (
              <div key={ins.id} className={`insight-card tone-${ins.tone}`}>
                <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}><Icon name={ins.icon} size={16} /></span>
                <span className="text-sm" style={{ lineHeight: 1.5 }}>{ins.text}</span>
              </div>
            ))}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 8, gap: 4 }}
            onClick={() => onNavigate('more', 'insights')}
          >
            See all insights <Icon name="chevronRight" size={14} />
          </button>
        </>
      )}

      <div className="section-title">At a glance</div>
      <div className="card-row">
        <MiniCard
          label="Mood"
          value={todaysMood ? <Icon name={faceIconForEmoji(todaysMood.emoji)} size={22} /> : '—'}
          sub={todaysMood ? 'Logged today' : 'Not logged'}
          icon="heart"
          accent="var(--accent)"
          onClick={() => onNavigate('more', 'mood')}
        />
        <MiniCard
          label="Weight"
          value={data.settings.gentleMode ? (latestWeight ? <Icon name="leaf" size={20} /> : '—') : (latestWeight ? `${latestWeight.kg}${data.settings.weightUnit}` : '—')}
          sub={data.settings.gentleMode ? 'Gentle mode' : (latestWeight ? latestWeight.date.slice(5) : 'No entries')}
          icon="scale"
          accent="var(--accent)"
          onClick={() => onNavigate('more', 'weight')}
        />
        <MiniCard
          label="Nutrition"
          value={`${nutritionCount}/5`}
          sub="today"
          icon="apple"
          accent="var(--accent)"
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
          trend={waterTrend}
          delta={waterDelta}
          onClick={() => onNavigate('water')}
        />
        <SummaryRow
          color="var(--accent-sleep)"
          label="Sleep"
          value={sleepToday ? `${sleepToday.hours}h logged` : `Goal: ${data.settings.sleepGoalHours}h`}
          ratio={sleepRatio}
          trend={sleepTrend}
          delta={sleepDelta}
          deltaSuffix="h"
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

function SummaryRow({ color, label, value, ratio, trend, delta, deltaSuffix = '', onClick }) {
  const hasTrend = trend && trend.some((v) => v > 0)
  return (
    <button className="card" onClick={onClick} style={{ textAlign: 'left', cursor: 'pointer' }}>
      <div className="row">
        <div className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
          <span className="badge-dot" style={{ background: color }} />
          <span style={{ fontWeight: 600 }}>{label}</span>
        </div>
        <div className="row" style={{ gap: 10, justifyContent: 'flex-end', width: 'auto' }}>
          {hasTrend && <Sparkline values={trend} color={color} />}
          <span className="mono text-sm muted">{value}</span>
          {delta != null && <ChangeIndicator value={delta} suffix={deltaSuffix} />}
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'var(--border-soft)', marginTop: 12, overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(ratio * 100)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
    </button>
  )
}
