import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey, humanDate } from '../../utils/dates'
import BackHeader from '../../components/BackHeader'
import Sheet from '../../components/Sheet'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'
import { tx } from '../../i18n/tx'

export default function Alcohol({ onBack }) {
  const { data, addAlcoholEntry, deleteAlcoholEntry } = useApp()
  const [logOpen, setLogOpen] = useState(false)
  const [count, setCount] = useState(1)
  const [toDelete, setToDelete] = useState(null)

  const entries = [...data.alcohol].reverse()

  const openLog = () => {
    setCount(1)
    setLogOpen(true)
  }

  return (
    <div className="page">
      <BackHeader
        eyebrow={tx("More")}
        title={tx("Alcohol")}
        onBack={onBack}
        action={<button className="btn btn-primary btn-sm" onClick={openLog}>{tx("+ Log")}</button>}
      />

      <div className="section-title">{tx("History")}</div>
      {entries.length === 0 ? (
        <div className="empty-state"><div className="icon"><Icon name="droplet" size={26} /></div><p>{tx("No entries logged yet.")}</p></div>
      ) : (
        <div className="stack">
          {entries.map((a) => (
            <div key={a.id} className="card row" style={{ padding: '12px 16px', alignItems: 'flex-start' }}>
              <div>
                <div className="text-sm">{humanDate(a.date)}</div>
                <div style={{ fontWeight: 600 }}>{a.count} {a.count === 1 ? tx("drink") : tx("drinks")}</div>
              </div>
              <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }} onClick={() => setToDelete(a)}>{tx("Delete")}</button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title={tx("Log drinks")}>
        <div className="field">
          <label>{tx("Number of drinks")}</label>
          <input
            className="input"
            type="number"
            min="1"
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
          />
        </div>
        <button
          className="btn btn-primary btn-block"
          onClick={() => { addAlcoholEntry({ count }, todayKey()); setLogOpen(false) }}
        >
          {tx("Save")}
        </button>
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        title={tx("Delete entry?")}
        message={tx("This entry will be removed.")}
        confirmLabel={tx("Delete")}
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { deleteAlcoholEntry(toDelete.id); setToDelete(null) }}
      />
    </div>
  )
}
