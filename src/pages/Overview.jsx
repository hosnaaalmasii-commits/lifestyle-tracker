import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useT } from '../i18n/useT'
import { todayKey, keyToDate } from '../utils/dates'
import { getTasksForDate, computeDayScore, taskStreak } from '../utils/taskSchedule'
import Ring from '../components/Ring'
import TodayTasks from '../components/TodayTasks'
import DayReplanSheet from '../components/DayReplanSheet'
import Confetti from '../components/Confetti'
import CharacterCard from '../components/CharacterCard'
import CharacterErrorBoundary from '../components/CharacterErrorBoundary'
import VoiceLogSheet from '../components/VoiceLogSheet'
import LevelBar from '../components/LevelBar'
import Icon from '../components/Icon'
import { tx } from '../i18n/tx'
import { computeInsights } from '../utils/insights'
import { computeBadges } from '../utils/badges'
import { computeXP } from '../utils/gamification'
import { getMicroHabit } from '../utils/microHabits'
import { getGPSStatus } from '../utils/lifestyleGPS'
import { COACH_PREFILL } from './more/Coach'
import { useCountUp } from '../utils/useCountUp'

// "anna.devries@…" → "Anna" — the account holder's name when no display
// name has been set in Settings.
function nameFromEmail(email) {
  const local = (email || '').split('@')[0].split(/[._\-+\d]/).filter(Boolean)[0]
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : ''
}

function greetingKey() {
  const h = new Date().getHours()
  if (h < 12) return 'greet.morning'
  if (h < 18) return 'greet.afternoon'
  return 'greet.evening'
}

// The "Richting E" layout: greeting (the sparkle avatar opens voice input
// that files what you say into the right parts of the app, or hands it to
// the coach), the day-score hero, three quick pills, three stats, today's
// checklist, the companion, the coach bar, then insights and level/phase/
// micro-habit.
export default function Overview({ onNavigate }) {
  const { data, addWater, sync } = useApp()
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
  // Numbers count up to their value when the page opens.
  const scoreShown = Math.round(useCountUp(score))
  const waterShown = useCountUp(waterToday)
  const proteinShown = Math.round(useCountUp(proteinToday))

  const celebratedToday = useRef(null)
  const [confettiTick, setConfettiTick] = useState(0)
  const [replanOpen, setReplanOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  useEffect(() => {
    if (tasks.length && score >= 100 && celebratedToday.current !== today) {
      celebratedToday.current = today
      setConfettiTick((n) => n + 1)
    }
  }, [score, today, tasks.length])

  const name = data.settings.displayName?.trim() || nameFromEmail(sync?.email)
  const topInsights = computeInsights(data).slice(0, 2)
  const xp = computeXP(data, computeBadges(data).filter((b) => b.unlocked).length)
  const microHabit = getMicroHabit(data)
  const gps = getGPSStatus(data)
  const openCoachWith = (text) => {
    sessionStorage.setItem(COACH_PREFILL, text || '')
    onNavigate('more', 'coach')
  }
  const dateLabel = keyToDate(today).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="page">
      <Confetti trigger={confettiTick} />

      <div className="row" style={{ gap: 12, justifyContent: 'flex-start', marginBottom: 16, paddingRight: 52 }}>
        <button
          onClick={() => setVoiceOpen(true)}
          aria-label={t('ov.speak')}
          className="speak-btn"
          style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            border: '2px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--text)',
            boxShadow: '0 0 18px color-mix(in srgb, var(--accent) 35%, transparent)',
          }}
        >
          <Icon name="sparkle" size={18} />
        </button>
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
          <div style={{ fontSize: 25, fontWeight: 800, lineHeight: 1 }}>{scoreShown}%</div>
        </Ring>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span className="faint" style={{ fontSize: 12, fontWeight: 500 }}>{t('ov.dayScore')}</span>
          <span style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
            {tasks.length ? t('ov.tasksOf', { done: doneCount, total: tasks.length }) : t('ov.noTasks')}
          </span>
          <span className="chip" style={{ alignSelf: 'flex-start', cursor: 'default', padding: '5px 12px', fontSize: 12 }}>
            <span className="flame-flicker"><Icon name="flame" size={13} /></span> {streak ? t(streak === 1 ? 'ov.streakDay' : 'ov.streakDays', { n: streak }) : t('ov.reachForStreak', { pct: threshold })}
          </span>
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'flex-start' }}>
        <button className="chip" onClick={() => addWater(250)}>+ 250 ml</button>
        <button className="chip" onClick={() => setReplanOpen(true)}>{t('ov.chipAppt')}</button>
        <button className="chip" onClick={() => onNavigate('voeding')}>{t('ov.chipMenu')}</button>
      </div>

      <div className="card-row" style={{ marginTop: 14, gap: 10 }}>
        <StatCard label={t('stat.water')} value={`${num1(Math.round(waterShown / 100) / 10)} L`} sub={t('stat.of', { x: `${num1(data.settings.waterGoalMl / 1000)} L` })} onClick={() => onNavigate('water')} />
        <StatCard
          label={t('stat.sleep')}
          value={sleepToday ? `${Math.floor(sleepToday.hours)}${hUnit} ${String(Math.round((sleepToday.hours % 1) * 60)).padStart(2, '0')}` : '—'}
          sub={t('stat.goal', { x: `${data.settings.sleepGoalHours}${hUnit}` })}
          onClick={() => onNavigate('sleep')}
        />
        <StatCard label={t('stat.protein')} value={`${proteinShown} g`} sub={t('stat.of', { x: `${proteinGoal} g` })} onClick={() => onNavigate('voeding')} />
      </div>

      <div style={{ marginTop: 14 }}>
        <TodayTasks onOpenSchedule={() => onNavigate('more', 'dailyschedule')} />
      </div>

      <div style={{ marginTop: 14 }}>
        <CharacterErrorBoundary>
          <CharacterCard onOpen={() => onNavigate('more', 'companion')} />
        </CharacterErrorBoundary>
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

      {topInsights.length > 0 && (
        <>
          <div className="section-title">{t('ov.insights')}</div>
          {topInsights.map((ins) => (
            <div key={ins.id} className={`insight-card tone-${ins.tone}`}>
              <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}><Icon name={ins.icon} size={16} /></span>
              <span className="text-sm" style={{ lineHeight: 1.5 }}>{tx(ins.text)}</span>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, gap: 4 }} onClick={() => onNavigate('more', 'insights')}>
            {t('ov.allInsights')} <Icon name="chevronRight" size={14} />
          </button>
        </>
      )}

      <div className="card" style={{ marginTop: 14, padding: '4px 18px' }}>
        <button className="row" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 0', textAlign: 'left' }} onClick={() => onNavigate('more', 'badges')}>
          <LevelBar xp={xp} compact />
        </button>
        <button
          className="row"
          style={{ width: '100%', background: 'none', border: 'none', borderTop: '1px solid var(--border-soft)', cursor: 'pointer', padding: '14px 0', textAlign: 'left' }}
          onClick={() => onNavigate('more', 'gps')}
        >
          <span className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
            <span style={{ color: 'var(--accent)' }}><Icon name={gps.current.icon} size={18} /></span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{tx(`${gps.current.label} phase`)}</span>
          </span>
          <span className="faint" aria-hidden><Icon name="chevronRight" size={16} /></span>
        </button>
        <div style={{ padding: '14px 0', borderTop: '1px solid var(--border-soft)' }}>
          <div className="row" style={{ color: 'var(--second)', gap: 6, justifyContent: 'flex-start', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            <Icon name="leaf" size={13} /> {t('ov.microHabit')}
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{tx(microHabit.text)}</p>
        </div>
      </div>

      <DayReplanSheet open={replanOpen} onClose={() => setReplanOpen(false)} />
      <VoiceLogSheet open={voiceOpen} onClose={() => setVoiceOpen(false)} onOpenCoach={openCoachWith} />
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
