import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayKey, keyToDate } from '../utils/dates'
import { computeInsights } from '../utils/insights'
import { computeBadges } from '../utils/badges'
import { computeXP } from '../utils/gamification'
import { getTasksForDate, computeDayScore, taskStreak } from '../utils/taskSchedule'
import Ring from '../components/Ring'
import TodayTasks from '../components/TodayTasks'
import DayReplanSheet from '../components/DayReplanSheet'
import LevelBar from '../components/LevelBar'
import Confetti from '../components/Confetti'
import MoodCheckIn from '../components/MoodCheckIn'
import { activeContractsToday, getTriggerType } from '../utils/habitContracts'
import { getMicroHabit } from '../utils/microHabits'
import { getGPSStatus } from '../utils/lifestyleGPS'
import Icon from '../components/Icon'
import CharacterCard from '../components/CharacterCard'
import CharacterErrorBoundary from '../components/CharacterErrorBoundary'
import VoiceLogSheet from '../components/VoiceLogSheet'
import {
  shouldShowEodReport, getCachedReport, clearCachedReport,
  generateAiReport, gatherFallbackReportData, buildFallbackReportText,
} from '../utils/eodReport'
import { hasApiKey } from '../utils/claudeApi'

// Module-level, not component state — Overview is fully unmounted/remounted
// on tab switch (App.jsx: `{activeTab === 'overview' && <Overview />}`), so a
// useRef guard would reset on every remount and never actually prevent a
// second real generateAiReport() call firing while the first is still in
// flight (e.g. navigating away and back within the few seconds a real
// Claude call takes, before the first call's promise settles and writes
// the cache). This lives as long as the page itself does.
//
// It's the shared *promise*, not a boolean flag, on purpose: a remount
// during an in-flight call needs to attach to that call and receive its
// result, otherwise it renders an empty recap card forever (the original
// promise resolves into the previous, now-unmounted instance).
let eodGenerationPromise = null

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Goedemorgen'
  if (h < 18) return 'Goedemiddag'
  return 'Goedenavond'
}

const nl1 = (n) => n.toFixed(1).replace('.', ',')

// Layout from the "Richting E" Figma design: greeting, one hero card with
// the day score, quick-action pills, three small stats, today's checklist,
// the companion, and a coach prompt bar. Everything secondary (contracts,
// recap, insights, level/phase) sits below, quieter.
export default function Overview({ onNavigate }) {
  const { data, addWater } = useApp()
  const today = todayKey()

  const tasks = getTasksForDate(data.taskSchedule, today, data.dayOverrides)
  const completions = data.taskCompletions[today] || {}
  const doneCount = tasks.filter((t) => completions[t.id]).length
  const score = computeDayScore(tasks, completions)
  const threshold = data.settings.streakThresholdPct
  const streak = taskStreak(data.taskSchedule, data.taskCompletions, threshold, data.dayOverrides, today)
  const trainingDay = tasks.some((t) => t.category === 'training')

  const waterToday = data.water[today] || 0
  const sleepToday = data.sleep[today]
  const proteinToday = Math.round(data.meals.filter((m) => m.date === today).reduce((sum, m) => sum + (m.proteinG || 0), 0))
  const proteinGoal = data.settings.calorieTargets?.protein_g?.[0] || data.settings.macroGoals.proteinG

  const celebratedToday = useRef(null)
  const [confettiTick, setConfettiTick] = useState(0)
  const [moodCheckInOpen, setMoodCheckInOpen] = useState(false)
  const [voiceLogOpen, setVoiceLogOpen] = useState(false)
  const [replanOpen, setReplanOpen] = useState(false)
  useEffect(() => {
    if (tasks.length && score >= 100 && celebratedToday.current !== today) {
      celebratedToday.current = today
      setConfettiTick((n) => n + 1)
    }
  }, [score, today, tasks.length])

  const [eodReport, setEodReport] = useState(null)
  const [eodLoading, setEodLoading] = useState(false)
  const showEod = shouldShowEodReport(data)

  // Deliberately NOT cached: the spec treats the fallback as applying "for
  // that view" only, and it's cheap enough to recompute live. Caching it
  // would (a) hide the Regenerate button for the rest of the day after one
  // transient AI failure and (b) go stale as the user keeps logging.
  const runFallback = () => setEodReport({
    date: todayKey(),
    text: buildFallbackReportText(gatherFallbackReportData(data)),
    source: 'fallback',
  })

  // Single entry point for every AI generation, from both the mount effect
  // and Regenerate, so the shared in-flight promise is never bypassed.
  const startEodGeneration = () => {
    if (!eodGenerationPromise) {
      const pending = generateAiReport(data).finally(() => {
        // Only clear if this is still the current call — Regenerate can
        // have replaced it with a newer one while this was in flight.
        if (eodGenerationPromise === pending) eodGenerationPromise = null
      })
      eodGenerationPromise = pending
    }
    setEodLoading(true)
    return eodGenerationPromise
      .then(setEodReport)
      .catch(runFallback)
      .finally(() => setEodLoading(false))
  }

  useEffect(() => {
    if (!showEod) { setEodReport(null); return }
    const cached = getCachedReport()
    if (cached) { setEodReport(cached); return }
    if (!hasApiKey()) { runFallback(); return }
    // Attaches to an already-in-flight call rather than firing a second
    // one — the cache check above covers the common case, this covers the
    // narrow window where a first call hasn't settled yet.
    startEodGeneration()
    // Intentionally keyed on showEod only, not `data` — the cache is
    // date-based, not data-based; regenerating on every log would defeat
    // the once-per-day cache. Use the Regenerate button for a fresh pull.
  }, [showEod])

  const handleRegenerate = () => {
    clearCachedReport()
    // Force an actually-new call: without this, Regenerate would silently
    // re-attach to a stale in-flight generation and show its result.
    eodGenerationPromise = null
    startEodGeneration()
  }

  const badges = computeBadges(data)
  const xp = computeXP(data, badges.filter((b) => b.unlocked).length)
  const topInsights = computeInsights(data).slice(0, 2)
  const activeContracts = activeContractsToday(data.habitContracts, data)
  const microHabit = getMicroHabit(data)
  const gps = getGPSStatus(data)
  const name = data.settings.displayName?.trim()

  const linkRow = { width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 0', textAlign: 'left' }

  return (
    <div className="page">
      <Confetti trigger={confettiTick} />

      <div className="row" style={{ gap: 12, justifyContent: 'flex-start', marginBottom: 18, paddingRight: 52 }}>
        <span
          aria-hidden
          style={{
            width: 46, height: 46, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 22%, transparent)',
            fontWeight: 800, fontSize: 18, color: 'var(--text)',
          }}
        >
          {name ? name[0].toUpperCase() : <Icon name="sparkle" size={18} />}
        </span>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 22, lineHeight: 1.2 }}>{greeting()}{name ? `, ${name}` : ''}</h1>
          <div className="text-sm faint" style={{ fontWeight: 500 }}>{keyToDate(today).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })} · {trainingDay ? 'trainingsdag' : 'rustdag'}</div>
        </div>
      </div>

      {/* The one dominant number on the page. */}
      <div className="card hero-card row" style={{ gap: 20, justifyContent: 'flex-start', padding: 20 }}>
        <Ring
          value={score / 100}
          size={108}
          stroke={11}
          color="var(--accent)"
          gradientTo="var(--second)"
          trackColor="color-mix(in srgb, var(--text) 9%, transparent)"
        >
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{score}%</div>
        </Ring>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
          <span className="text-sm faint" style={{ fontWeight: 600 }}>Dagscore</span>
          <span style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.2 }}>
            {tasks.length ? `${doneCount} van ${tasks.length} taken` : 'Geen taken vandaag'}
          </span>
          <span className="chip" style={{ alignSelf: 'flex-start', cursor: 'default', padding: '5px 12px', fontSize: 12.5 }}>
            <Icon name="flame" size={13} /> {streak ? `${streak} ${streak === 1 ? 'dag' : 'dagen'} op rij` : `Haal ${threshold}% voor je reeks`}
          </span>
        </div>
      </div>

      <div className="scroll-x" style={{ margin: '14px -18px 0', padding: '0 18px 4px' }}>
        <button className="chip" onClick={() => addWater(250)}><Icon name="droplet" size={14} /> + 250 ml</button>
        <button className="chip" onClick={() => setReplanOpen(true)}><Icon name="calendar" size={14} /> + Afspraak</button>
        <button className="chip" onClick={() => setVoiceLogOpen(true)}><Icon name="mic" size={14} /> Inspreken</button>
        <button className="chip" onClick={() => onNavigate('more', 'pantry')}><Icon name="utensils" size={14} /> Menu</button>
        <button className="chip" onClick={() => setMoodCheckInOpen(true)}><Icon name="heart" size={14} /> Even pauze</button>
      </div>

      <div className="card-row" style={{ marginTop: 14, gap: 10 }}>
        <StatCard label="Water" value={`${nl1(waterToday / 1000)} L`} sub={`van ${nl1(data.settings.waterGoalMl / 1000)} L`} onClick={() => onNavigate('water')} />
        <StatCard label="Slaap" value={sleepToday ? `${Math.floor(sleepToday.hours)}u ${String(Math.round((sleepToday.hours % 1) * 60)).padStart(2, '0')}` : '—'} sub={`doel ${data.settings.sleepGoalHours}u`} onClick={() => onNavigate('sleep')} />
        <StatCard label="Eiwit" value={`${proteinToday} g`} sub={`van ${proteinGoal} g`} onClick={() => onNavigate('more', 'nutrition')} />
      </div>

      <div style={{ marginTop: 14 }}>
        <TodayTasks
          onOpenSchedule={() => onNavigate('more', 'dailyschedule')}
          onOpenPantry={() => onNavigate('more', 'pantry')}
          onOpenReplan={() => setReplanOpen(true)}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <CharacterErrorBoundary>
          <CharacterCard />
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
        <span className="faint" style={{ fontSize: 14 }}>Vraag je coach iets…</span>
        <span className="btn btn-primary btn-sm" style={{ pointerEvents: 'none' }}>Vraag</span>
      </button>

      {activeContracts.length > 0 && (
        <button
          className="card"
          style={{ marginTop: 14, width: '100%', textAlign: 'left', cursor: 'pointer', borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--border-soft))' }}
          onClick={() => onNavigate('more', 'contracts')}
        >
          <div className="row" style={{ color: 'var(--accent)', marginBottom: 6, gap: 6, justifyContent: 'flex-start', fontSize: 13, fontWeight: 700 }}>
            <Icon name="handshake" size={13} /> Contract actief vandaag
          </div>
          {activeContracts.map((c) => (
            <p key={c.id} style={{ margin: '2px 0', fontSize: 14 }}>
              <span className="faint">If {getTriggerType(c.triggerType)?.label.toLowerCase()} — </span>{c.response}
            </p>
          ))}
        </button>
      )}

      {showEod && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <div className="text-sm faint" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 11, fontWeight: 700 }}>
              {eodReport?.source === 'ai' ? 'AI-terugblik' : 'Terugblik op vandaag'}
            </div>
            {/* Keyed on having a key rather than on the current report's
                source, so someone looking at a fallback recap (after a
                transient failure, or having just added their key) can still
                retry instead of being stuck with it until tomorrow. */}
            {hasApiKey() && !eodLoading && (
              <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }} onClick={handleRegenerate}>
                Opnieuw
              </button>
            )}
          </div>
          {eodLoading ? (
            <p className="text-sm muted" style={{ marginTop: 8 }}>Terugblik schrijven…</p>
          ) : (
            <p className="text-sm" style={{ marginTop: 8, whiteSpace: 'pre-line' }}>{eodReport?.text}</p>
          )}
        </div>
      )}

      {topInsights.length > 0 && (
        <>
          <div className="section-title">Inzichten</div>
          <div>
            {topInsights.map((ins) => (
              <div key={ins.id} className={`insight-card tone-${ins.tone}`}>
                <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}><Icon name={ins.icon} size={16} /></span>
                <span className="text-sm" style={{ lineHeight: 1.5 }}>{ins.text}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, gap: 4 }} onClick={() => onNavigate('more', 'insights')}>
            Alle inzichten <Icon name="chevronRight" size={14} />
          </button>
        </>
      )}

      {/* Secondary info in one divided card rather than a stack of boxes. */}
      <div className="card" style={{ marginTop: 14, padding: '4px 18px' }}>
        <button className="row" style={linkRow} onClick={() => onNavigate('more', 'badges')}>
          <LevelBar xp={xp} compact />
        </button>
        <button className="row" style={{ ...linkRow, borderTop: '1px solid var(--border-soft)' }} onClick={() => onNavigate('more', 'gps')}>
          <span className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
            <span style={{ color: 'var(--accent)' }}><Icon name={gps.current.icon} size={18} /></span>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{gps.current.label} phase</span>
          </span>
          <span className="faint" aria-hidden><Icon name="chevronRight" size={16} /></span>
        </button>
        <div style={{ padding: '14px 0', borderTop: '1px solid var(--border-soft)' }}>
          <div className="row" style={{ color: 'var(--second)', gap: 6, justifyContent: 'flex-start', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
            <Icon name="leaf" size={13} /> Micro-gewoonte van vandaag
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{microHabit.text}</p>
        </div>
      </div>

      <DayReplanSheet open={replanOpen} onClose={() => setReplanOpen(false)} />
      <VoiceLogSheet open={voiceLogOpen} onClose={() => setVoiceLogOpen(false)} />
      <MoodCheckIn open={moodCheckInOpen} onClose={() => setMoodCheckInOpen(false)} />
    </div>
  )
}

function StatCard({ label, value, sub, onClick }) {
  return (
    <button className="card" onClick={onClick} style={{ flex: 1, textAlign: 'left', cursor: 'pointer', padding: 14, minWidth: 0 }}>
      <div className="text-sm faint" style={{ fontWeight: 600, fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.3, whiteSpace: 'nowrap' }}>{value}</div>
      <div className="faint" style={{ fontSize: 11.5 }}>{sub}</div>
    </button>
  )
}
