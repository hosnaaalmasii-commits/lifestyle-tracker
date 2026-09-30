import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { todayKey, currentWeekKeys, keyToDate } from '../utils/dates'
import { getMealsForDate, getTasksForDate } from '../utils/taskSchedule'
import { MEAL_SLOTS, pantryNameSet, bestOption } from '../utils/pantry'
import { hasApiKey } from '../utils/claudeApi'
import { analyzeMeal } from '../utils/mealAnalysis'
import Sheet from '../components/Sheet'
import Icon from '../components/Icon'
import { useT } from '../i18n/useT'
import { useCountUp } from '../utils/useCountUp'
import { useContentT } from '../i18n/useContentT'

// Two-tone thumbnails per slot — stand-ins for the food photos in the
// design until real photos exist.
const SLOT_THUMB = {
  ontbijt: ['var(--accent)', 'color-mix(in srgb, var(--accent) 45%, #ffffff)'],
  lunch: ['color-mix(in srgb, var(--second) 55%, #1b3a2a)', 'var(--second)'],
  diner: ['#A8552A', '#F0A868'],
  snack: ['#3A4F8C', '#8FB0FF'],
}

// "Pasta (~450 kcal, 35 g eiwit)" — AI pantry ideas carry their macros in
// the text itself; read them back instead of estimating again.
function macrosFromText(text) {
  const m = text.match(/~\s*(\d+)\s*kcal,\s*(\d+)\s*g eiwit/i)
  return m ? { calories: Number(m[1]), proteinG: Number(m[2]) } : null
}
const cleanName = (text) => text.replace(/\s*\(~[^)]*\)\s*$/, '')


// "Jouw menu" — the Voeding tab, laid out after the Richting E Figma mockup:
// week day pills, the day's kcal/macro card, one card per meal of the
// rotation (with an "in huis / mist" pantry check), and pantry actions.
export default function Voeding({ onNavigate }) {
  const { data, addMeal, deleteMeal, setMealEstimate } = useApp()
  const { t, locale } = useT()
  const { tc } = useContentT()
  const nlNum = (n) => Math.round(n).toLocaleString(locale)
  const slotLabel = (slot) => t(`food.slot.${slot}`)
  const dayName = (k, style) => keyToDate(k).toLocaleDateString(locale, { weekday: style }).replace('.', '')
  const today = todayKey()
  const [selected, setSelected] = useState(today)
  const [openSlot, setOpenSlot] = useState(null)
  const estimating = useRef(new Set())

  const week = currentWeekKeys()
  const info = getMealsForDate(data.mealRotation, selected, data.dayOverrides)
  const pantryNames = pantryNameSet(data.pantry)
  const trainingDay = getTasksForDate(data.taskSchedule, selected, data.dayOverrides).some((t) => t.category === 'training')
  const targets = data.settings.calorieTargets || {}
  const kcalGoal = (trainingDay ? targets.training_day_kcal : targets.rest_day_kcal)?.[1] || data.settings.macroGoals.calories
  const goals = {
    proteinG: targets.protein_g?.[1] || data.settings.macroGoals.proteinG,
    carbsG: targets.carbs_g?.[1] || data.settings.macroGoals.carbsG,
    fatG: targets.fat_g?.[1] || data.settings.macroGoals.fatG,
  }

  const logged = data.meals.filter((m) => m.date === selected)
  const eaten = logged.reduce((s, m) => ({
    calories: s.calories + (m.calories || 0),
    proteinG: s.proteinG + (m.proteinG || 0),
    carbsG: s.carbsG + (m.carbsG || 0),
    fatG: s.fatG + (m.fatG || 0),
  }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 })

  const slots = MEAL_SLOTS.filter((s) => info?.meals?.[s])
  const kcalShown = useCountUp(eaten.calories)
  const estimateFor = (text) => macrosFromText(text) || data.mealEstimates?.[text] || null
  const loggedFor = (slot, text) => logged.find((m) => m.plannedSlot === slot && m.plannedText === text)

  // Fill in kcal/protein for dishes that don't have an estimate yet — one
  // small Claude call per dish, ever (cached in data.mealEstimates).
  useEffect(() => {
    if (!hasApiKey() || !info?.meals) return
    for (const slot of slots) {
      const text = info.meals[slot]
      if (estimateFor(text) || estimating.current.has(text) || /^restjes/i.test(text)) continue
      estimating.current.add(text)
      analyzeMeal({ name: text })
        .then((r) => setMealEstimate(text, { calories: r.calories, proteinG: r.proteinG, carbsG: r.carbsG, fatG: r.fatG }))
        .catch(() => { estimating.current.delete(text) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, info?.meals && slots.map((s) => info.meals[s]).join('|')])

  const open = openSlot && info?.meals?.[openSlot] ? { slot: openSlot, text: info.meals[openSlot] } : null
  const openEst = open && estimateFor(open.text)
  const openLog = open && loggedFor(open.slot, open.text)
  const openCheck = open && data.pantry.length ? bestOption(open.text, pantryNames) : null

  const toggleEaten = () => {
    if (!open) return
    if (openLog) { deleteMeal(openLog.id); setOpenSlot(null); return }
    addMeal({
      name: cleanName(open.text),
      calories: openEst?.calories || 0,
      proteinG: openEst?.proteinG || 0,
      carbsG: openEst?.carbsG || 0,
      fatG: openEst?.fatG || 0,
      plannedSlot: open.slot,
      plannedText: open.text,
    }, selected)
    setOpenSlot(null)
  }

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="eyebrow">{t('food.week', { w: info?.letter || '—' })} · {dayName(selected, 'long').toUpperCase()}</div>
        <h1>{t('food.title')}</h1>
      </div>

      <div className="row" style={{ gap: 6 }}>
        {week.map((k) => {
          const active = k === selected
          return (
            <button
              key={k}
              onClick={() => setSelected(k)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, padding: '8px 0', borderRadius: 999, cursor: 'pointer',
                background: active ? 'var(--accent)' : 'transparent',
                border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                color: active ? 'var(--accent-contrast)' : 'var(--text-faint)',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>{dayName(k, 'short').slice(0, 2)}</span>
              <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>{keyToDate(k).getDate()}</span>
            </button>
          )
        })}
      </div>

      <div className="card" style={{ marginTop: 14, padding: 16 }}>
        <div className="row" style={{ alignItems: 'baseline' }}>
          <span style={{ fontSize: 22, fontWeight: 800 }}>{nlNum(kcalShown)} kcal</span>
          <span className="text-sm faint">{t('stat.of', { x: nlNum(kcalGoal) })}</span>
        </div>
        <div className="xp-bar-track" style={{ height: 6, marginTop: 10 }}>
          <div className="xp-bar-fill" style={{ width: `${Math.min(100, (eaten.calories / kcalGoal) * 100)}%`, background: 'linear-gradient(90deg, var(--accent), var(--second))', boxShadow: 'none' }} />
        </div>
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          {[[t('stat.protein'), 'proteinG'], [t('food.carbs'), 'carbsG'], [t('food.fat'), 'fatG']].map(([label, key]) => (
            <div key={key} style={{ flex: 1 }}>
              <div className="faint" style={{ fontSize: 11 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(eaten[key])}/{goals[key]} g</div>
            </div>
          ))}
        </div>
      </div>

      {!info?.meals ? (
        <p className="text-sm faint" style={{ marginTop: 16 }}>{t('food.noMenu')}</p>
      ) : (
        <div className="stack" style={{ marginTop: 14, gap: 10 }}>
          {slots.map((slot) => {
            const text = info.meals[slot]
            const est = estimateFor(text)
            const done = loggedFor(slot, text)
            const check = data.pantry.length && !/^restjes/i.test(text) ? bestOption(text, pantryNames) : null
            const [c1, c2] = SLOT_THUMB[slot]
            return (
              <button
                key={slot}
                className="card row"
                onClick={() => setOpenSlot(slot)}
                style={{ padding: 10, gap: 12, cursor: 'pointer', textAlign: 'left', width: '100%', margin: 0, justifyContent: 'flex-start' }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 60, height: 60, borderRadius: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `linear-gradient(135deg, ${c1}, ${c2})`, color: 'rgba(255,255,255,0.9)',
                  }}
                >
                  {done && <Icon name="check" size={22} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-faint)' }}>
                    {slotLabel(slot).toUpperCase()}{info.swapped.includes(slot) ? ` · ${t('food.swapped')}` : ''}{done ? ` · ${t('food.eatenTag')}` : ''}
                  </span>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{tc(cleanName(text))}</span>
                  <span className="faint" style={{ display: 'block', fontSize: 11.5 }}>
                    {est ? `${nlNum(est.calories)} kcal · ${Math.round(est.proteinG)} g ${t('stat.protein').toLowerCase()}` : hasApiKey() ? t('food.estimating') : ''}
                  </span>
                </span>
                {check && (
                  <span className="chip" style={{ padding: '4px 10px', fontSize: 11.5, flexShrink: 0, pointerEvents: 'none' }}>
                    {check.missing.length ? t('food.missing', { n: check.missing.length }) : t('food.inHouse')}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="row" style={{ gap: 8, marginTop: 16, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={() => onNavigate('more', 'pantry')}>{t('food.noShop')}</button>
        <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('more', 'pantry')}>{t('food.shopping')}</button>
      </div>

      <Sheet open={!!open} onClose={() => setOpenSlot(null)} title={open ? slotLabel(open.slot) : ''}>
        {open && (
          <>
            <p style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>{tc(cleanName(open.text))}</p>
            <p className="text-sm faint" style={{ margin: '0 0 14px' }}>
              {openEst
                ? `≈ ${nlNum(openEst.calories)} kcal · ${Math.round(openEst.proteinG)} g ${t('stat.protein').toLowerCase()} · ${Math.round(openEst.carbsG || 0)} g ${t('food.carbs').toLowerCase()} · ${Math.round(openEst.fatG || 0)} g ${t('food.fat').toLowerCase()} (${t('food.estimated')})`
                : t('food.noEstimate')}
            </p>
            {openCheck && (
              <p className="text-sm" style={{ margin: '0 0 14px', color: openCheck.missing.length ? 'var(--text-soft)' : 'var(--second)' }}>
                {openCheck.missing.length ? t('food.missingList', { x: openCheck.missing.join(', ') }) : t('food.allHome')}
              </p>
            )}
            <button className="btn btn-primary btn-block" onClick={toggleEaten}>
              {openLog ? t('food.notEaten') : t('food.eat')}
            </button>
            <button className="btn btn-secondary btn-block" style={{ marginTop: 10 }} onClick={() => { setOpenSlot(null); onNavigate('more', 'pantry') }}>
              {t('food.swap')}
            </button>
          </>
        )}
      </Sheet>
    </div>
  )
}
