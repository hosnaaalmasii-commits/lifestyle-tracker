import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayKey, lastNDayKeys } from '../utils/dates'
import { streakFromDateSet } from '../utils/streaks'
import { computeHydrationAutopilot } from '../utils/hydrationAutopilot'
import Ring from '../components/Ring'
import StreakBadge from '../components/StreakBadge'
import WeeklyBarChart from '../components/WeeklyBarChart'
import Sheet from '../components/Sheet'
import ConfirmDialog from '../components/ConfirmDialog'
import { useT } from '../i18n/useT'

const QUICK_ADDS = [200, 330, 500]

const STATUS_COLOR = {
  likely_low: 'var(--danger)',
  slightly_low: 'var(--warning)',
  on_track: 'var(--accent-water)',
  well_hydrated: 'var(--success)',
  overhydration: 'var(--warning)',
}

export default function Water() {
  const { data, addWater, undoLastWater, clearWater, setWaterGoal } = useApp()
  const { t } = useT()
  const [goalSheetOpen, setGoalSheetOpen] = useState(false)
  const [customGoal, setCustomGoal] = useState(data.settings.waterGoalMl)
  const [justAdded, setJustAdded] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const today = todayKey()
  const goal = data.settings.waterGoalMl
  const todayMl = data.water[today] || 0
  const ratio = Math.min(1, todayMl / goal)

  const weekKeys = lastNDayKeys(7)
  const weekValues = weekKeys.map((k) => ({ key: k, value: data.water[k] || 0 }))

  const streak = streakFromDateSet(new Set(Object.entries(data.water).filter(([, ml]) => ml >= goal).map(([k]) => k)))
  const autopilot = computeHydrationAutopilot(data)

  const handleAdd = (ml) => {
    addWater(ml)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 260)
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">{t('tab.water')}</div>
        <h1>{t('water.title')}</h1>
      </div>

      <div className="card hero-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '26px 18px', '--hero-tint': 'var(--accent-water)', '--hero-glow': 'var(--accent-water)' }}>
        <Ring value={ratio} size={160} stroke={15} color="var(--accent-water)">
          <div
            className="mono"
            style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, transform: justAdded ? 'scale(1.12)' : 'scale(1)', transition: 'transform 0.24s cubic-bezier(.34,1.56,.64,1)' }}
          >
            {todayMl}
          </div>
          <div className="text-sm muted" style={{ marginTop: 4 }}>{t('water.of', { goal })}</div>
        </Ring>

        <div className="scroll-x" style={{ marginTop: 22, justifyContent: 'center' }}>
          {QUICK_ADDS.map((ml) => (
            <button key={ml} className="chip" onClick={() => handleAdd(ml)}>+{ml} ml</button>
          ))}
        </div>

        <div className="row" style={{ marginTop: 14, gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={undoLastWater}>{t('water.undo')}</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setCustomGoal(goal); setGoalSheetOpen(true) }}>{t('water.editGoal')}</button>
          {todayMl > 0 && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => setConfirmClear(true)}>{t('water.clearToday')}</button>}
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 20 }}>{t('water.autopilot')}</div>
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="text-sm faint">{t('water.adjusted')}</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 22, marginTop: 2 }}>{autopilot.target} ml</div>
          </div>
          <span
            className="text-sm"
            style={{
              fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-pill)',
              color: STATUS_COLOR[autopilot.status],
              background: `color-mix(in srgb, ${STATUS_COLOR[autopilot.status]} 14%, transparent)`,
            }}
          >
            {t(`water.status.${autopilot.status}`)}
          </span>
        </div>
        {autopilot.bumps.length > 0 && (
          <p className="text-sm faint" style={{ marginTop: 8, marginBottom: 0 }}>
            {autopilot.baseline}ml baseline{autopilot.bumps.map((b) => ` + ${b.ml}ml (${b.label})`).join('')}
          </p>
        )}
        <p className="text-sm" style={{ marginTop: 10, marginBottom: 0 }}>{todayMl >= autopilot.target ? t('water.reached') : t('water.left', { ml: autopilot.target - todayMl })}</p>
      </div>

      <div className="row" style={{ marginTop: 20, marginBottom: 4 }}>
        <div className="section-title" style={{ margin: 0 }}>{t('water.thisWeek')}</div>
        <StreakBadge days={streak} />
      </div>
      <div className="card">
        <WeeklyBarChart values={weekValues} goal={goal} color="var(--accent-water)" formatValue={(v) => `${v} ml`} />
      </div>

      <Sheet open={goalSheetOpen} onClose={() => setGoalSheetOpen(false)} title={t('water.goalTitle')}>
        <div className="field">
          <label>{t('water.goalLabel')}</label>
          <input
            className="input"
            type="number"
            step={50}
            value={customGoal}
            onChange={(e) => setCustomGoal(Number(e.target.value))}
          />
        </div>
        <div className="scroll-x" style={{ marginBottom: 18 }}>
          {[1500, 2000, 2500, 3000, 3500].map((v) => (
            <button key={v} className={`chip${customGoal === v ? ' selected' : ''}`} onClick={() => setCustomGoal(v)}>{v} ml</button>
          ))}
        </div>
        <button
          className="btn btn-primary btn-block"
          onClick={() => { setWaterGoal(Math.max(200, customGoal)); setGoalSheetOpen(false) }}
        >
          {t('water.saveGoal')}
        </button>
      </Sheet>

      <ConfirmDialog
        open={confirmClear}
        title={t('water.clearTitle')}
        message={t('water.clearMsg')}
        confirmLabel={t('common.clear')}
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => { clearWater(today); setConfirmClear(false) }}
      />
    </div>
  )
}
