import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useT } from '../i18n/useT'
import { todayKey, keyToDate } from '../utils/dates'
import { getTasksForDate, computeDayScore, taskStreak } from '../utils/taskSchedule'
import Ring from '../components/Ring'
import TodayTasks from '../components/TodayTasks'
import DayReplanSheet from '../components/DayReplanSheet'
import Confetti from '../components/Confetti'
import CompanionTile from '../components/CompanionTile'

function greetingKey() {
  const h = new Date().getHours()
  if (h < 12) return 'greet.morning'
  if (h < 18) return 'greet.afternoon'
  return 'greet.evening'
}

// The "Richting E" Figma mockup (E1): greeting, the day-score hero, three
// quick pills, three stats, the companion (small — tap for its own page),
// today's checklist, the coach bar. Everything else lives on its own page.
export default function Overview({ onNavigate }) {
  const { data, addWater } = useApp()
  const { t, locale } = useT()
  const today = todayKey()
  const num1 = (n) => n.toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: n % 1 ? 1 : 0 })

  const tasks = getTasksForDate(data.taskSchedule, today, data.dayOverrides)
  const completions = data.taskCompletions[today] || {}
  const doneCount = tasks.filter((x) => completions[x.id]).length
  const score = computeDayScore(tasks, completions)
  const threshold = data.settings.streakThresholdPct
  const streak = taskStreak(data.taskSchedule, data.taskCompletions, threshold, data.dayOverrides, today)
  const trainingDay = tasks.some((x) => x.category === 'training')

  const waterToday = data.water[today] || 0
  const sleepToday = data.sleep[today]
  const proteinToday = Math.round(data.meals.filter((m) => m.date === today).reduce((sum, m) => sum + (m.proteinG || 0), 0))
  const proteinGoal = data.settings.calorieTargets?.protein_g?.[1] || data.settings.macroGoals.proteinG
  const hUnit = t('unit.h')

  const celebratedToday = useRef(null)
  const [confettiTick, setConfettiTick] = useState(0)
  const [replanOpen, setReplanOpen] = useState(false)
  useEffect(() => {
    if (tasks.length && score >= 100 && celebratedToday.current !== today) {
      celebratedToday.current = today
      setConfettiTick((n) => n + 1)
    }
  }, [score, today, tasks.length])

  const name = data.settings.displayName?.trim()
  const dateLabel = keyToDate(today).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="page">
      <Confetti trigger={confettiTick} />

      <div className="row" style={{ gap: 12, justifyContent: 'flex-start', marginBottom: 16, paddingRight: 52 }}>
        <span
          aria-hidden
          style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 25%, transparent)',
            fontWeight: 700, fontSize: 17, color: 'var(--text)',
          }}
        >
          {name ? name[0].toUpperCase() : null}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25 }}>{t(greetingKey())}{name ? `, ${name}` : ''}</div>
          <div className="faint" style={{ fontSize: 12, fontWeight: 500 }}>
            {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} · {t(trainingDay ? 'ov.trainingDay' : 'ov.restDay')}
          </div>
        </div>
      </div>

      <div className="card row" style={{ gap: 18, justifyContent: 'flex-start', padding: 20 }}>
        <Ring
          value={score / 100}
          size={100}
          stroke={8}
          color="var(--accent)"
          gradientTo="var(--second)"
          trackColor="color-mix(in srgb, var(--text) 8%, transparent)"
        >
          <div style={{ fontSize: 25, fontWeight: 800, lineHeight: 1 }}>{score}%</div>
        </Ring>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span className="faint" style={{ fontSize: 12, fontWeight: 500 }}>{t('ov.dayScore')}</span>
          <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
            {tasks.length ? t('ov.tasksOf', { done: doneCount, total: tasks.length }) : t('ov.noTasks')}
          </span>
          <span className="chip" style={{ alignSelf: 'flex-start', cursor: 'default', padding: '5px 12px', fontSize: 12 }}>
            {streak ? t(streak === 1 ? 'ov.streakDay' : 'ov.streakDays', { n: streak }) : t('ov.startStreak')}
          </span>
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'flex-start' }}>
        <button className="chip" onClick={() => addWater(250)}>+ 250 ml</button>
        <button className="chip" onClick={() => setReplanOpen(true)}>{t('ov.chipAppt')}</button>
        <button className="chip" onClick={() => onNavigate('voeding')}>{t('ov.chipMenu')}</button>
      </div>

      <div className="card-row" style={{ marginTop: 14, gap: 10 }}>
        <StatCard label={t('stat.water')} value={`${num1(waterToday / 1000)} L`} sub={t('stat.of', { x: `${num1(data.settings.waterGoalMl / 1000)} L` })} onClick={() => onNavigate('water')} />
        <StatCard
          label={t('stat.sleep')}
          value={sleepToday ? `${Math.floor(sleepToday.hours)}${hUnit} ${String(Math.round((sleepToday.hours % 1) * 60)).padStart(2, '0')}` : '—'}
          sub={t('stat.goal', { x: `${data.settings.sleepGoalHours}${hUnit}` })}
          onClick={() => onNavigate('sleep')}
        />
        <StatCard label={t('stat.protein')} value={`${proteinToday} g`} sub={t('stat.of', { x: `${proteinGoal} g` })} onClick={() => onNavigate('voeding')} />
      </div>

      <div style={{ marginTop: 14 }}>
        <CompanionTile onOpen={() => onNavigate('more', 'companion')} />
      </div>

      <div style={{ marginTop: 14 }}>
        <TodayTasks onOpenSchedule={() => onNavigate('more', 'dailyschedule')} />
      </div>

      <button
        onClick={() => onNavigate('more', 'coach')}
        className="row"
        style={{
          width: '100%', marginTop: 14, padding: '6px 6px 6px 18px', borderRadius: 999, cursor: 'pointer',
          background: 'var(--surface)', border: '1.2px solid color-mix(in srgb, var(--accent) 55%, transparent)',
        }}
      >
        <span className="faint" style={{ fontSize: 14 }}>{t('ov.askCoach')}</span>
        <span className="btn btn-primary btn-sm" style={{ pointerEvents: 'none' }}>{t('ov.ask')}</span>
      </button>

      <DayReplanSheet open={replanOpen} onClose={() => setReplanOpen(false)} />
    </div>
  )
}

function StatCard({ label, value, sub, onClick }) {
  return (
    <button className="card" onClick={onClick} style={{ flex: 1, textAlign: 'left', cursor: 'pointer', padding: 14, minWidth: 0 }}>
      <div className="faint" style={{ fontWeight: 500, fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3, whiteSpace: 'nowrap' }}>{value}</div>
      <div className="faint" style={{ fontSize: 11 }}>{sub}</div>
    </button>
  )
}
