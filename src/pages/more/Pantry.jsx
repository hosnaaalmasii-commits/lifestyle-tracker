import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey, isToday } from '../../utils/dates'
import { getMealsForDate, weekdayKeyForDate, getTasksForDate } from '../../utils/taskSchedule'
import { hasApiKey } from '../../utils/claudeApi'
import { aiMealIdeas } from '../../utils/smartDay'
import {
  MEAL_SLOTS, MEAL_SLOT_LABELS, PANTRY_LOCATIONS,
  pantryNameSet, bestOption, suggestSwaps, shoppingList, parsePantryInput,
} from '../../utils/pantry'
import BackHeader from '../../components/BackHeader'
import SegmentedControl from '../../components/SegmentedControl'
import ConfirmDialog from '../../components/ConfirmDialog'
import DictateButton, { DICTATION_SUPPORTED } from '../../components/DictateButton'
import { tx } from '../../i18n/tx'

const DAY_SHORT = { mon: 'ma', tue: 'di', wed: 'wo', thu: 'do', fri: 'vr', sat: 'za', sun: 'zo' }

function CoverageLine({ result }) {
  if (!result) return null
  if (!result.missing.length) return <div className="text-sm" style={{ color: 'var(--success)' }}>{tx("Alles in huis")}</div>
  return <div className="text-sm faint">{tx("Mist:")} {result.missing.join(', ')}</div>
}

// Voorraad & Menu — what's in the fridge/freezer/cupboard, "cook with what
// you have" meal swaps for today (utils/pantry.js, no AI), and a shopping
// list for the coming week. Swaps only ever pick other meals from the same
// slot of the user's own rotation, which is what keeps the day on target.
export default function Pantry({ onBack }) {
  const { data, addPantryItems, removePantryItem, clearPantry, setDayMealSwap } = useApp()
  const [input, setInput] = useState('')
  const [location, setLocation] = useState('koelkast')
  const [confirmClear, setConfirmClear] = useState(false)
  const [showAllShopping, setShowAllShopping] = useState(false)
  const [ideas, setIdeas] = useState({}) // { [slot]: { loading, error, list } }
  // Three parts instead of one long page (2026-10-16 cleanup).
  const [part, setPart] = useState('today') // today | home | shopping
  const aiAvailable = hasApiKey()

  const today = todayKey()
  const names = pantryNameSet(data.pantry)
  const mealInfo = getMealsForDate(data.mealRotation, today, data.dayOverrides)
  const shopping = shoppingList(data.mealRotation, data.dayOverrides, names, today, 7)

  const addFrom = (text) => {
    const items = parsePantryInput(text)
    if (!items.length) return
    const existing = new Set(data.pantry.map((p) => p.name.toLowerCase()))
    const fresh = items.filter((name) => !existing.has(name.toLowerCase()))
    if (fresh.length) addPantryItems(fresh.map((name) => ({ name, location })))
    setInput('')
  }

  const trainingDay = getTasksForDate(data.taskSchedule, today, data.dayOverrides).some((t) => t.category === 'training')

  const fetchIdeas = async (slot) => {
    setIdeas((m) => ({ ...m, [slot]: { loading: true } }))
    try {
      const list = await aiMealIdeas({
        slotLabel: MEAL_SLOT_LABELS[slot],
        plannedMeal: mealInfo?.planned?.[slot] || mealInfo?.meals?.[slot],
        pantryItems: data.pantry,
        trainingDay,
      })
      setIdeas((m) => ({ ...m, [slot]: { list } }))
    } catch (e) {
      setIdeas((m) => ({ ...m, [slot]: { error: e.message } }))
    }
  }

  const chooseIdea = (slot, idea) => {
    setDayMealSwap(today, slot, `${idea.name} (~${idea.kcal} kcal, ${idea.proteinG} g eiwit)`)
    setIdeas((m) => ({ ...m, [slot]: undefined }))
  }

  const boughtItem = (name) => addPantryItems([{ name, location: 'koelkast' }])

  return (
    <div className="page">
      <BackHeader title={tx("Voorraad & menu")} onBack={onBack} />

      <div className="scroll-x" style={{ marginBottom: 18 }}>
        {[
          ['today', tx("Vandaag")],
          ['home', `${tx("In huis")}${data.pantry.length ? ` (${data.pantry.length})` : ''}`],
          ['shopping', `${tx("Boodschappen")}${shopping.length ? ` (${shopping.length})` : ''}`],
        ].map(([id, label]) => (
          <button key={id} type="button" className={`chip${part === id ? ' selected' : ''}`} onClick={() => setPart(id)}>{label}</button>
        ))}
      </div>

      {part === 'today' && (<>
      <p className="text-sm muted" style={{ margin: '0 0 12px' }}>{tx("Koken met wat je in huis hebt. Wissels komen uit je eigen menu voor hetzelfde moment, dus je calorie- en eiwitdoel blijft ongeveer gelijk.")}</p>
      {!mealInfo?.meals ? (
        <p className="text-sm faint">{tx("Geen menu gepland voor vandaag.")}</p>
      ) : (
        <div className="card" style={{ padding: '4px 16px' }}>
          {MEAL_SLOTS.filter((slot) => mealInfo.meals[slot]).map((slot, i) => {
            const text = mealInfo.meals[slot]
            const swapped = mealInfo.swapped.includes(slot)
            const isLeftovers = /^restjes/i.test(text)
            const current = isLeftovers ? null : bestOption(text, names)
            const needsSwap = data.pantry.length > 0 && current && current.missing.length > 0
            const suggestions = needsSwap
              ? suggestSwaps(data.mealRotation, slot, names, { minCoverage: current.coverage }).filter((s) => s.option !== current.option)
              : []
            return (
              <div key={slot} style={{ padding: '12px 0', borderTop: i > 0 ? '1px solid var(--border-soft)' : 'none' }}>
                <div className="text-sm faint" style={{ fontWeight: 600 }}>{tx(MEAL_SLOT_LABELS[slot])}{swapped ? tx(" · gewisseld") : ''}</div>
                <div style={{ fontWeight: 600 }}>{text}</div>
                {data.pantry.length > 0 && <CoverageLine result={current} />}
                {swapped && (
                  <button type="button" className="chip" style={{ marginTop: 8, fontSize: 12.5, padding: '6px 12px' }} onClick={() => setDayMealSwap(today, slot, null)}>
                    {tx("Terug naar plan:")} {mealInfo.planned?.[slot]}
                  </button>
                )}
                {aiAvailable && !ideas[slot]?.list && (
                  <button
                    type="button"
                    className="chip"
                    style={{ marginTop: 8, fontSize: 12.5, padding: '6px 12px' }}
                    disabled={ideas[slot]?.loading}
                    onClick={() => fetchIdeas(slot)}
                  >
                    {ideas[slot]?.loading ? tx("Ideeën bedenken…") : tx("Bedenk iets met wat ik heb")}
                  </button>
                )}
                {ideas[slot]?.error && <div className="text-sm" style={{ color: 'var(--danger)' }}>{ideas[slot].error}</div>}
                {ideas[slot]?.list && (
                  <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                    <div className="text-sm faint">{tx("AI-ideeën met je voorraad:")}</div>
                    {ideas[slot].list.map((idea) => (
                      <div key={idea.name} className="row" style={{ gap: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--surface-soft)', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500 }}>{idea.name}</div>
                          <div className="text-sm faint">~{idea.kcal} {tx("kcal ·")} {idea.proteinG} {tx("g eiwit")}</div>
                          {idea.how && <div className="text-sm faint">{idea.how}</div>}
                          {idea.missing.length > 0
                            ? <div className="text-sm faint">{tx("Mist:")} {idea.missing.join(', ')}</div>
                            : <div className="text-sm" style={{ color: 'var(--success)' }}>{tx("Alles in huis")}</div>}
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => chooseIdea(slot, idea)}>{tx("Kies")}</button>
                      </div>
                    ))}
                    <button className="btn-ghost text-sm" style={{ background: 'none', border: 'none', color: 'var(--text-soft)', cursor: 'pointer', padding: 0, textAlign: 'left' }} onClick={() => setIdeas((m) => ({ ...m, [slot]: undefined }))}>{tx("Verbergen")}</button>
                  </div>
                )}
                {suggestions.length > 0 && (
                  <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                    <div className="text-sm faint">{tx("Wel te maken met je voorraad:")}</div>
                    {suggestions.map((s) => (
                      <div key={s.option} className="row" style={{ gap: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--surface-soft)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500 }}>{s.option}</div>
                          <CoverageLine result={s} />
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDayMealSwap(today, slot, s.option)}>{tx("Kies")}</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {data.pantry.length === 0 && (
        <div className="card stack" style={{ marginTop: 12, gap: 10 }}>
          <span className="text-sm">{tx("Vul in wat je in huis hebt — dan zie je per maaltijd wat je mist en wat je in plaats daarvan kunt maken.")}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPart('home')}>{tx("Voorraad invullen")}</button>
        </div>
      )}
      </>)}

      {part === 'home' && (<>
      <div className="card">
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder={tx("bv. eieren, spinazie, kipfilet")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addFrom(input) }}
          />
          <DictateButton onText={setInput} />
        </div>
        <div style={{ marginTop: 10 }}>
          <SegmentedControl options={PANTRY_LOCATIONS} value={location} onChange={setLocation} />
        </div>
        <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={!input.trim()} onClick={() => addFrom(input)}>{tx("Toevoegen")}</button>
        <p className="text-sm faint" style={{ marginTop: 8 }}>
          {tx("Meerdere tegelijk kan: scheid met komma's of \"en\".")}{!DICTATION_SUPPORTED && tx(" Inspreken kan via de microfoon van je toetsenbord.")}
        </p>
      </div>

      {data.pantry.length > 0 && (
        <>
          <div className="row" style={{ alignItems: 'center', margin: '24px 0 12px' }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{tx("In huis")} ({data.pantry.length})</div>
            <button type="button" className="chip" style={{ color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 60%, transparent)' }} onClick={() => setConfirmClear(true)}>{tx("Alles wissen")}</button>
          </div>
          <div className="card" style={{ padding: '4px 16px' }}>
            {PANTRY_LOCATIONS.map(({ value, label }) => {
              const items = data.pantry.filter((p) => (p.location || 'koelkast') === value)
              if (!items.length) return null
              return (
                <div key={value} style={{ padding: '10px 0' }}>
                  <div className="text-sm faint" style={{ marginBottom: 8, fontWeight: 600 }}>{tx(label)}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {items.map((p) => (
                      <button
                        key={p.id}
                        className="chip"
                        title={tx("Op? Tik om te verwijderen")}
                        onClick={() => removePantryItem(p.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        {p.name} ×
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-sm faint" style={{ marginTop: 6 }}>{tx("Iets op? Tik erop om het te verwijderen.")}</p>
        </>
      )}

      </>)}

      {part === 'shopping' && (<>
      <p className="text-sm muted" style={{ margin: '0 0 12px' }}>{tx("Wat je nog nodig hebt voor het menu van de komende 7 dagen. Gekocht? Tik erop, dan staat het bij In huis.")}</p>
      {shopping.length === 0 ? (
        <p className="text-sm faint">{tx("Je hebt alles in huis voor het menu van de komende week.")}</p>
      ) : (
        <div className="card" style={{ padding: '4px 16px' }}>
          {(showAllShopping ? shopping : shopping.slice(0, 12)).map((item, i) => (
            <div key={item.name} className="row" style={{ gap: 8, padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border-soft)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{tx(item.name)}</div>
                <div className="text-sm faint">{item.dates.map((d) => (isToday(d) ? 'vandaag' : DAY_SHORT[weekdayKeyForDate(d)])).join(', ')}</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => boughtItem(item.name)}>{tx("Gekocht")}</button>
            </div>
          ))}
          {shopping.length > 12 && (
            <button className="btn btn-ghost btn-block" onClick={() => setShowAllShopping((v) => !v)}>
              {showAllShopping ? tx("Minder tonen") : `Alle ${shopping.length} tonen`}
            </button>
          )}
        </div>
      )}
      </>)}

      <ConfirmDialog
        open={confirmClear}
        title={tx("Voorraad wissen?")}
        message={tx("Alle items in je voorraad worden verwijderd.")}
        confirmLabel={tx("Wissen")}
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => { clearPantry(); setConfirmClear(false) }}
      />
    </div>
  )
}
