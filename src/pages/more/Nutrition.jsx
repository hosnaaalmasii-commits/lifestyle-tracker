import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey, humanDate, addDaysToKey, lastNDayKeys, isToday } from '../../utils/dates'
import { estimateCyclePhase, nutritionTipForPhase } from '../../utils/cyclePhase'
import BackHeader from '../../components/BackHeader'
import Sheet from '../../components/Sheet'
import WeeklyBarChart from '../../components/WeeklyBarChart'
import IconBadge from '../../components/IconBadge'

const ITEMS = [
  { key: 'breakfast', label: 'Breakfast', icon: 'sun', color: '#F5A623' },
  { key: 'lunch', label: 'Lunch', icon: 'sandwich', color: '#FF6B6B' },
  { key: 'dinner', label: 'Dinner', icon: 'utensils', color: '#7C6FE0' },
  { key: 'vegetables', label: 'Vegetables', icon: 'carrot', color: '#2ECC71' },
  { key: 'snacks', label: 'Mindful snacks', icon: 'apple', color: '#FF9F43' },
]

export default function Nutrition({ onBack }) {
  const { data, setNutritionItem, setMacroGoals } = useApp()
  const [viewDate, setViewDate] = useState(todayKey())
  const [goalsOpen, setGoalsOpen] = useState(false)
  const [draftGoals, setDraftGoals] = useState(data.settings.macroGoals)

  const day = data.nutrition[viewDate] || {}
  const count = ITEMS.filter((i) => day[i.key]).length

  const weekKeys = lastNDayKeys(7)
  const weekValues = weekKeys.map((k) => {
    const d = data.nutrition[k] || {}
    return { key: k, value: ITEMS.filter((i) => d[i.key]).length }
  })

  const phase = estimateCyclePhase(data, todayKey())
  const phaseTip = nutritionTipForPhase(phase?.phase)

  return (
    <div className="page">
      <BackHeader
        eyebrow="More"
        title="Nutrition"
        onBack={onBack}
        action={<button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }} onClick={() => { setDraftGoals(data.settings.macroGoals); setGoalsOpen(true) }}>Goals</button>}
      />

      {phaseTip && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 12 }}>
          <div className="text-sm faint" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>
            {phase.name} window (estimated)
          </div>
          <p className="text-sm" style={{ margin: '4px 0 0' }}>{phaseTip}</p>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ marginBottom: 4 }}>
          <button className="btn-ghost" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-soft)' }} onClick={() => setViewDate((d) => addDaysToKey(d, -1))}>‹</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600 }}>{isToday(viewDate) ? 'Today' : humanDate(viewDate)}</div>
            <div className="text-sm faint mono">{count}/5 complete</div>
          </div>
          <button
            className="btn-ghost"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: isToday(viewDate) ? 'var(--border)' : 'var(--text-soft)' }}
            onClick={() => !isToday(viewDate) && setViewDate((d) => addDaysToKey(d, 1))}
            disabled={isToday(viewDate)}
          >
            ›
          </button>
        </div>
        <div className="stack" style={{ marginTop: 14 }}>
          {ITEMS.map((item) => {
            const on = !!day[item.key]
            return (
              <div key={item.key} className="row" style={{ padding: '6px 0' }}>
                <div className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
                  <IconBadge icon={item.icon} color={item.color} size={30} iconSize={14} />
                  <span className="text-sm" style={{ fontWeight: 500 }}>{item.label}</span>
                </div>
                <button
                  className={`switch${on ? ' on' : ''}`}
                  onClick={() => setNutritionItem(viewDate, item.key, !on)}
                  aria-label={item.label}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="section-title">This week</div>
      <div className="card">
        <WeeklyBarChart values={weekValues} goal={5} color="var(--accent)" formatValue={(v) => `${v}/5`} />
      </div>

      <Sheet open={goalsOpen} onClose={() => setGoalsOpen(false)} title="Macro goals">
        <div className="field">
          <label>Calories</label>
          <input className="input" type="number" min="0" value={draftGoals.calories} onChange={(e) => setDraftGoals((g) => ({ ...g, calories: Number(e.target.value) }))} />
        </div>
        <div className="field">
          <label>Protein (g)</label>
          <input className="input" type="number" min="0" value={draftGoals.proteinG} onChange={(e) => setDraftGoals((g) => ({ ...g, proteinG: Number(e.target.value) }))} />
        </div>
        <div className="field">
          <label>Carbs (g)</label>
          <input className="input" type="number" min="0" value={draftGoals.carbsG} onChange={(e) => setDraftGoals((g) => ({ ...g, carbsG: Number(e.target.value) }))} />
        </div>
        <div className="field">
          <label>Fat (g)</label>
          <input className="input" type="number" min="0" value={draftGoals.fatG} onChange={(e) => setDraftGoals((g) => ({ ...g, fatG: Number(e.target.value) }))} />
        </div>
        <button
          className="btn btn-primary btn-block"
          onClick={() => {
            setMacroGoals({
              calories: Math.max(0, draftGoals.calories),
              proteinG: Math.max(0, draftGoals.proteinG),
              carbsG: Math.max(0, draftGoals.carbsG),
              fatG: Math.max(0, draftGoals.fatG),
            })
            setGoalsOpen(false)
          }}
        >
          Save goals
        </button>
      </Sheet>
    </div>
  )
}
