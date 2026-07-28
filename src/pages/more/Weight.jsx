import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey, humanDate } from '../../utils/dates'
import BackHeader from '../../components/BackHeader'
import LineChart from '../../components/LineChart'
import Sheet from '../../components/Sheet'
import ConfirmDialog from '../../components/ConfirmDialog'

export default function Weight({ onBack }) {
  const { data, addWeight, deleteWeight } = useApp()
  const [logOpen, setLogOpen] = useState(false)
  const [value, setValue] = useState(70)
  const [date, setDate] = useState(todayKey())
  const [toDelete, setToDelete] = useState(null)

  const unit = data.settings.weightUnit
  const entries = data.weight
  const chartValues = entries.slice(-30).map((w) => ({ key: w.date, value: w.kg }))
  const latest = entries[entries.length - 1]
  const previous = entries[entries.length - 2]
  const delta = latest && previous ? +(latest.kg - previous.kg).toFixed(1) : null

  return (
    <div className="page">
      <BackHeader
        eyebrow="More"
        title="Weight"
        onBack={onBack}
        action={<button className="btn btn-primary btn-sm" onClick={() => { setValue(latest?.kg ?? 70); setDate(todayKey()); setLogOpen(true) }}>+ Log</button>}
      />

      <div className="card">
        <div className="row" style={{ alignItems: 'baseline' }}>
          <div>
            <div className="mono" style={{ fontSize: 28, fontWeight: 700 }}>
              {latest ? `${latest.kg} ${unit}` : '—'}
            </div>
            <div className="text-sm faint">{latest ? humanDate(latest.date) : 'No entries yet'}</div>
          </div>
          {delta != null && (
            <span className="mono text-sm" style={{ color: delta === 0 ? 'var(--text-soft)' : delta < 0 ? 'var(--success)' : 'var(--warning)' }}>
              {delta > 0 ? '+' : ''}{delta} {unit}
            </span>
          )}
        </div>
        <div style={{ marginTop: 18 }}>
          <LineChart values={chartValues} color="var(--accent)" />
        </div>
      </div>

      <div className="section-title">History</div>
      {entries.length === 0 ? (
        <div className="empty-state"><div className="icon">⚖️</div><p>No weight logged yet.</p></div>
      ) : (
        <div className="stack">
          {[...entries].reverse().map((w) => (
            <div key={w.id} className="card row" style={{ padding: '12px 16px' }}>
              <span className="text-sm">{humanDate(w.date)}</span>
              <div className="row" style={{ gap: 12, justifyContent: 'flex-end' }}>
                <span className="mono">{w.kg} {unit}</span>
                <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }} onClick={() => setToDelete(w)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Log weight">
        <div className="field">
          <label>Weight ({unit})</label>
          <div className="stepper">
            <button onClick={() => setValue((v) => +(v - (unit === 'kg' ? 0.1 : 0.2)).toFixed(1))}>−</button>
            <span className="value">{value}</span>
            <button onClick={() => setValue((v) => +(v + (unit === 'kg' ? 0.1 : 0.2)).toFixed(1))}>+</button>
          </div>
        </div>
        <div className="field">
          <label>Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" onClick={() => { addWeight(value, date); setLogOpen(false) }}>Save</button>
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete entry?"
        message="This weight entry will be removed."
        confirmLabel="Delete"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { deleteWeight(toDelete.id); setToDelete(null) }}
      />
    </div>
  )
}
