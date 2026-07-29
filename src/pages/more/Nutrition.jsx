import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey, humanDate, addDaysToKey, lastNDayKeys, isToday } from '../../utils/dates'
import BackHeader from '../../components/BackHeader'
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
  const { data, setNutritionItem } = useApp()
  const [viewDate, setViewDate] = useState(todayKey())

  const day = data.nutrition[viewDate] || {}
  const count = ITEMS.filter((i) => day[i.key]).length

  const weekKeys = lastNDayKeys(7)
  const weekValues = weekKeys.map((k) => {
    const d = data.nutrition[k] || {}
    return { key: k, value: ITEMS.filter((i) => d[i.key]).length }
  })

  return (
    <div className="page">
      <BackHeader eyebrow="More" title="Nutrition" onBack={onBack} />

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
    </div>
  )
}
