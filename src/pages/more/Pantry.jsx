import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey, isToday } from '../../utils/dates'
import { getMealsForDate, weekdayKeyForDate } from '../../utils/taskSchedule'
import {
  MEAL_SLOTS, MEAL_SLOT_LABELS, PANTRY_LOCATIONS,
  pantryNameSet, bestOption, suggestSwaps, shoppingList, parsePantryInput,
} from '../../utils/pantry'
import BackHeader from '../../components/BackHeader'
import SegmentedControl from '../../components/SegmentedControl'
import ConfirmDialog from '../../components/ConfirmDialog'
import DictateButton, { DICTATION_SUPPORTED } from '../../components/DictateButton'

const DAY_SHORT = { mon: 'ma', tue: 'di', wed: 'wo', thu: 'do', fri: 'vr', sat: 'za', sun: 'zo' }

function CoverageLine({ result }) {
  if (!result) return null
  if (!result.missing.length) return <div className="text-sm" style={{ color: 'var(--success)' }}>Alles in huis</div>
  return <div className="text-sm faint">Mist: {result.missing.join(', ')}</div>
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

  const boughtItem = (name) => addPantryItems([{ name, location: 'koelkast' }])

  return (
    <div className="page">
      <BackHeader eyebrow="Transformation plan" title="Voorraad & Menu" onBack={onBack} />

      <div className="section-title" style={{ marginTop: 0 }}>Vandaag koken met wat je hebt</div>
      {!mealInfo?.meals ? (
        <p className="text-sm faint">Geen menu gepland voor vandaag.</p>
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
                <div className="eyebrow">{MEAL_SLOT_LABELS[slot]}{swapped ? ' · gewisseld' : ''}</div>
                <div style={{ fontWeight: 600 }}>{text}</div>
                {data.pantry.length > 0 && <CoverageLine result={current} />}
                {swapped && (
                  <button className="btn-ghost text-sm" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '4px 0' }} onClick={() => setDayMealSwap(today, slot, null)}>
                    Terug naar plan: {mealInfo.planned?.[slot]}
                  </button>
                )}
                {suggestions.length > 0 && (
                  <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                    <div className="text-sm faint">Wel te maken met je voorraad:</div>
                    {suggestions.map((s) => (
                      <div key={s.option} className="row" style={{ gap: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--surface-soft)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500 }}>{s.option}</div>
                          <CoverageLine result={s} />
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => setDayMealSwap(today, slot, s.option)}>Kies</button>
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
        <p className="text-sm faint" style={{ marginTop: 8 }}>Voeg hieronder toe wat je in huis hebt — dan zie je per maaltijd wat je mist en wat je in plaats daarvan kunt maken.</p>
      )}
      <p className="text-sm faint" style={{ marginTop: 8 }}>
        Wissels komen uit je eigen menurotatie voor hetzelfde moment, dus je calorie- en eiwitdoel blijft ongeveer gelijk.
      </p>

      <div className="section-title">Voorraad toevoegen</div>
      <div className="card">
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder="bv. eieren, spinazie, kipfilet"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addFrom(input) }}
          />
          <DictateButton onText={setInput} />
        </div>
        <div style={{ marginTop: 10 }}>
          <SegmentedControl options={PANTRY_LOCATIONS} value={location} onChange={setLocation} />
        </div>
        <button className="btn btn-primary btn-block" style={{ marginTop: 10 }} disabled={!input.trim()} onClick={() => addFrom(input)}>Toevoegen</button>
        <p className="text-sm faint" style={{ marginTop: 8 }}>
          Meerdere tegelijk kan: scheid met komma's of "en".{!DICTATION_SUPPORTED && ' Inspreken kan via de microfoon van je toetsenbord.'}
        </p>
      </div>

      {data.pantry.length > 0 && (
        <>
          <div className="row" style={{ alignItems: 'baseline' }}>
            <div className="section-title">In huis ({data.pantry.length})</div>
            <button className="btn-ghost text-sm" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }} onClick={() => setConfirmClear(true)}>Alles wissen</button>
          </div>
          <div className="card" style={{ padding: '4px 16px' }}>
            {PANTRY_LOCATIONS.map(({ value, label }) => {
              const items = data.pantry.filter((p) => (p.location || 'koelkast') === value)
              if (!items.length) return null
              return (
                <div key={value} style={{ padding: '10px 0' }}>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {items.map((p) => (
                      <button
                        key={p.id}
                        className="chip"
                        title="Op? Tik om te verwijderen"
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
          <p className="text-sm faint" style={{ marginTop: 6 }}>Iets op? Tik erop om het te verwijderen.</p>
        </>
      )}

      <div className="section-title">Boodschappenlijst (7 dagen)</div>
      {shopping.length === 0 ? (
        <p className="text-sm faint">Je hebt alles in huis voor het menu van de komende week.</p>
      ) : (
        <div className="card" style={{ padding: '4px 16px' }}>
          {(showAllShopping ? shopping : shopping.slice(0, 12)).map((item, i) => (
            <div key={item.name} className="row" style={{ gap: 8, padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border-soft)' : 'none' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{item.name}</div>
                <div className="text-sm faint">{item.dates.map((d) => (isToday(d) ? 'vandaag' : DAY_SHORT[weekdayKeyForDate(d)])).join(', ')}</div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => boughtItem(item.name)}>Gekocht</button>
            </div>
          ))}
          {shopping.length > 12 && (
            <button className="btn btn-ghost btn-block" onClick={() => setShowAllShopping((v) => !v)}>
              {showAllShopping ? 'Minder tonen' : `Alle ${shopping.length} tonen`}
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Voorraad wissen?"
        message="Alle items in je voorraad worden verwijderd."
        confirmLabel="Wissen"
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => { clearPantry(); setConfirmClear(false) }}
      />
    </div>
  )
}
