import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey, keyToDate, isToday } from '../../utils/dates'
import BackHeader from '../../components/BackHeader'
import Sheet from '../../components/Sheet'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'
import { tx } from '../../i18n/tx'
import { useT } from '../../i18n/useT'

// Loose appointments and reminders, apart from the fixed daily plan.
// Richting E layout (2026-10-16): one list card per section, tap an item
// to see/delete it, and a date can now be picked (it used to always be today).
export default function Schedule({ onBack }) {
  const { data, addScheduleItem, deleteScheduleItem } = useApp()
  const { locale } = useT()
  const [logOpen, setLogOpen] = useState(false)
  const [text, setText] = useState('')
  const [date, setDate] = useState(todayKey())
  const [time, setTime] = useState('')
  const [toDelete, setToDelete] = useState(null)

  const byDate = (a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))
  const upcoming = data.schedule.filter((s) => s.date >= todayKey()).sort(byDate)
  const past = data.schedule.filter((s) => s.date < todayKey()).sort(byDate).reverse()
  const when = (s) => {
    const day = isToday(s.date) ? tx("Vandaag") : keyToDate(s.date).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
    return s.time ? `${day} · ${s.time}` : day
  }

  const openLog = () => {
    setText('')
    setDate(todayKey())
    setTime('')
    setLogOpen(true)
  }

  const list = (items) => (
    <div className="card list-card">
      {items.map((s) => (
        <button key={s.id} type="button" className="list-row" onClick={() => setToDelete(s)}>
          <span style={{ width: 92, flexShrink: 0 }} className="text-sm faint">{when(s)}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600 }}>{s.text}</span>
          <Icon name="trash" size={16} />
        </button>
      ))}
    </div>
  )

  return (
    <div className="page">
      <BackHeader title={tx("Planning")} onBack={onBack} />
      <p className="text-sm muted" style={{ margin: '0 0 14px' }}>
        {tx("Losse afspraken en herinneringen, naast je vaste dagschema. Voor een afspraak die je dag moet omgooien gebruik je \"+ Afspraak\" op Vandaag.")}
      </p>

      <button type="button" className="btn btn-primary btn-block" onClick={openLog} style={{ marginBottom: 6 }}>+ {tx("Toevoegen")}</button>

      <div className="section-title">{tx("Komt eraan")}</div>
      {upcoming.length === 0 ? (
        <div className="card text-sm muted">{tx("Niets gepland.")}</div>
      ) : list(upcoming)}

      {past.length > 0 && (
        <>
          <div className="section-title">{tx("Geweest")}</div>
          {list(past.slice(0, 20))}
        </>
      )}

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title={tx("Toevoegen aan planning")}>
        <div className="field">
          <label>{tx("Wat")}</label>
          <input className="input" type="text" placeholder={tx("bv. Tandarts")} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>{tx("Datum")}</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value || todayKey())} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>{tx("Tijd (mag leeg)")}</label>
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <button
          className="btn btn-primary btn-block"
          disabled={!text.trim()}
          onClick={() => { addScheduleItem({ text: text.trim(), time: time || null }, date); setLogOpen(false) }}
        >
          {tx("Opslaan")}
        </button>
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        title={toDelete?.text || ''}
        message={toDelete ? `${when(toDelete)} — ${tx("verwijderen uit je planning?")}` : ''}
        confirmLabel={tx("Verwijderen")}
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { deleteScheduleItem(toDelete.id); setToDelete(null) }}
      />
    </div>
  )
}
