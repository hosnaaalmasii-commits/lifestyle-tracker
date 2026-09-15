import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey, humanDate, addDaysToKey, lastNDayKeys, isToday } from '../../utils/dates'
import { estimateCyclePhase, nutritionTipForPhase } from '../../utils/cyclePhase'
import { hasApiKey } from '../../utils/claudeApi'
import { analyzeMeal } from '../../utils/mealAnalysis'
import { resizeImageToDataUrl } from '../../utils/image'
import BackHeader from '../../components/BackHeader'
import Sheet from '../../components/Sheet'
import WeeklyBarChart from '../../components/WeeklyBarChart'
import IconBadge from '../../components/IconBadge'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'

const MACRO_BARS = [
  { key: 'calories', label: 'Calories', goalKey: 'calories', unit: '' },
  { key: 'proteinG', label: 'Protein', goalKey: 'proteinG', unit: 'g' },
  { key: 'carbsG', label: 'Carbs', goalKey: 'carbsG', unit: 'g' },
  { key: 'fatG', label: 'Fat', goalKey: 'fatG', unit: 'g' },
]

const ITEMS = [
  { key: 'breakfast', label: 'Breakfast', icon: 'sun', color: '#F5A623' },
  { key: 'lunch', label: 'Lunch', icon: 'sandwich', color: '#FF6B6B' },
  { key: 'dinner', label: 'Dinner', icon: 'utensils', color: '#7C6FE0' },
  { key: 'vegetables', label: 'Vegetables', icon: 'carrot', color: '#2ECC71' },
  { key: 'snacks', label: 'Mindful snacks', icon: 'apple', color: '#FF9F43' },
]

export default function Nutrition({ onBack }) {
  const { data, setNutritionItem, setMacroGoals, addMeal, deleteMeal } = useApp()
  const [viewDate, setViewDate] = useState(todayKey())
  const [goalsOpen, setGoalsOpen] = useState(false)
  const [draftGoals, setDraftGoals] = useState(data.settings.macroGoals)

  const [mealOpen, setMealOpen] = useState(false)
  const [mealName, setMealName] = useState('')
  const [mealPhoto, setMealPhoto] = useState(null)
  const [mealEstimate, setMealEstimate] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [mealToDelete, setMealToDelete] = useState(null)

  const day = data.nutrition[viewDate] || {}
  const count = ITEMS.filter((i) => day[i.key]).length

  const mealsToday = data.meals.filter((m) => m.date === viewDate)
  const totals = mealsToday.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0),
    proteinG: acc.proteinG + (m.proteinG || 0),
    carbsG: acc.carbsG + (m.carbsG || 0),
    fatG: acc.fatG + (m.fatG || 0),
  }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 })
  const goals = data.settings.macroGoals

  const resetMealDraft = () => {
    setMealName('')
    setMealPhoto(null)
    setMealEstimate(null)
    setAnalyzeError('')
  }

  const handleMealPhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { dataUrl } = await resizeImageToDataUrl(file, 800, 0.75)
      setMealPhoto(dataUrl)
      setMealEstimate(null)
    } finally {
      e.target.value = ''
    }
  }

  const runAnalysis = async () => {
    setAnalyzing(true)
    setAnalyzeError('')
    try {
      const result = await analyzeMeal({ name: mealName, photoDataUrl: mealPhoto })
      setMealEstimate(result)
    } catch (err) {
      setAnalyzeError(err.message || 'Could not analyze this meal.')
    } finally {
      setAnalyzing(false)
    }
  }

  const saveMeal = () => {
    if (!mealEstimate) return
    addMeal({
      name: mealEstimate.name,
      photoDataUrl: mealPhoto,
      calories: mealEstimate.calories,
      proteinG: mealEstimate.proteinG,
      carbsG: mealEstimate.carbsG,
      fatG: mealEstimate.fatG,
      confidence: mealEstimate.confidence,
      note: mealEstimate.note,
    }, viewDate)
    setMealOpen(false)
    resetMealDraft()
  }

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

      <div className="section-title row">
        <span>Meals</span>
        <button className="btn btn-primary btn-sm" onClick={() => { resetMealDraft(); setMealOpen(true) }}>+ Log a meal</button>
      </div>
      <div className="card">
        <div className="stack">
          {MACRO_BARS.map((bar) => {
            const value = totals[bar.key]
            const goal = goals[bar.goalKey] || 0
            const pct = goal > 0 ? Math.min(1, value / goal) : 0
            return (
              <div key={bar.key}>
                <div className="row text-sm" style={{ marginBottom: 4 }}>
                  <span className="faint">{bar.label}</span>
                  <span className="mono">{Math.round(value)}{bar.unit} / {goal}{bar.unit}</span>
                </div>
                <div className="xp-bar-track"><div className="xp-bar-fill" style={{ width: `${Math.round(pct * 100)}%` }} /></div>
              </div>
            )
          })}
        </div>
      </div>

      {mealsToday.length > 0 && (
        <div className="stack" style={{ marginTop: 10 }}>
          {mealsToday.map((m) => (
            <div key={m.id} className="card row" style={{ padding: '10px 14px', gap: 10 }}>
              <div className="row" style={{ gap: 10, justifyContent: 'flex-start', flex: 1, minWidth: 0 }}>
                {m.photoDataUrl ? (
                  <img src={m.photoDataUrl} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <IconBadge icon="apple" color="#FF9F43" size={30} iconSize={14} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div className="text-sm" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                  <div className="text-sm faint mono">{Math.round(m.calories)} cal · {Math.round(m.proteinG)}p {Math.round(m.carbsG)}c {Math.round(m.fatG)}f</div>
                </div>
              </div>
              <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13, flexShrink: 0 }} onClick={() => setMealToDelete(m)}>Delete</button>
            </div>
          ))}
        </div>
      )}

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

      <Sheet open={mealOpen} onClose={() => { setMealOpen(false); resetMealDraft() }} title="Log a meal">
        {!hasApiKey() ? (
          <p className="text-sm faint">Add a Claude API key in More → Settings → AI Coach to analyze meals from a name or photo.</p>
        ) : (
          <>
            <div className="field">
              <label>Meal name (optional if you add a photo)</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Grilled chicken salad"
                value={mealName}
                onChange={(e) => { setMealName(e.target.value); setMealEstimate(null) }}
              />
            </div>

            <div className="field">
              <label>Photo (optional)</label>
              {mealPhoto ? (
                <div className="row" style={{ justifyContent: 'flex-start', gap: 12 }}>
                  <img src={mealPhoto} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />
                  <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }} onClick={() => { setMealPhoto(null); setMealEstimate(null) }}>Remove</button>
                </div>
              ) : (
                <label className="btn btn-secondary btn-block" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Icon name="camera" size={16} /> Add photo
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleMealPhoto} />
                </label>
              )}
            </div>

            {!mealEstimate ? (
              <button
                className="btn btn-primary btn-block"
                disabled={analyzing || (!mealName.trim() && !mealPhoto)}
                onClick={runAnalysis}
              >
                {analyzing ? 'Analyzing…' : 'Analyze with AI'}
              </button>
            ) : (
              <>
                <div className="card" style={{ padding: '12px 16px' }}>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>{mealEstimate.name}</span>
                    <span className="text-sm faint" style={{ textTransform: 'capitalize' }}>{mealEstimate.confidence} confidence</span>
                  </div>
                  <div className="text-sm mono">{Math.round(mealEstimate.calories)} cal · {Math.round(mealEstimate.proteinG)}g protein · {Math.round(mealEstimate.carbsG)}g carbs · {Math.round(mealEstimate.fatG)}g fat</div>
                  {mealEstimate.note && <p className="text-sm faint" style={{ marginTop: 8 }}>{mealEstimate.note}</p>}
                </div>
                <div className="row" style={{ gap: 10, marginTop: 12 }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setMealEstimate(null)}>Re-analyze</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveMeal}>Save</button>
                </div>
              </>
            )}

            {analyzeError && <p className="text-sm" style={{ color: 'var(--danger)', marginTop: 10 }}>{analyzeError}</p>}
          </>
        )}
      </Sheet>

      <ConfirmDialog
        open={!!mealToDelete}
        title="Delete meal?"
        message="This logged meal and its macros will be removed."
        confirmLabel="Delete"
        danger
        onCancel={() => setMealToDelete(null)}
        onConfirm={() => { deleteMeal(mealToDelete.id); setMealToDelete(null) }}
      />
    </div>
  )
}
