import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey, humanDate, currentWeekKeys } from '../../utils/dates'
import { BUDGET_CATEGORIES } from '../../utils/voiceLogging'
import BackHeader from '../../components/BackHeader'
import Sheet from '../../components/Sheet'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'

export default function Budget({ onBack }) {
  const { data, addExpense, deleteExpense } = useApp()
  const [logOpen, setLogOpen] = useState(false)
  const [amount, setAmount] = useState(10)
  const [category, setCategory] = useState('food')
  const [note, setNote] = useState('')
  const [toDelete, setToDelete] = useState(null)

  const entries = [...data.budget].reverse()
  const weekKeys = new Set(currentWeekKeys())
  const spentThisWeek = data.budget.filter((b) => weekKeys.has(b.date)).reduce((sum, b) => sum + b.amount, 0)

  const openLog = () => {
    setAmount(10)
    setCategory('food')
    setNote('')
    setLogOpen(true)
  }

  return (
    <div className="page">
      <BackHeader
        eyebrow="More"
        title="Budget"
        onBack={onBack}
        action={<button className="btn btn-primary btn-sm" onClick={openLog}>+ Log</button>}
      />

      <div className="card">
        <div className="mono" style={{ fontSize: 28, fontWeight: 700 }}>{spentThisWeek.toFixed(2)}</div>
        <div className="text-sm faint">spent this week</div>
      </div>

      <div className="section-title">History</div>
      {entries.length === 0 ? (
        <div className="empty-state"><div className="icon"><Icon name="scale" size={26} /></div><p>No expenses logged yet.</p></div>
      ) : (
        <div className="stack">
          {entries.map((b) => (
            <div key={b.id} className="card row" style={{ padding: '12px 16px' }}>
              <div>
                <div className="text-sm">{humanDate(b.date)}</div>
                <div className="text-sm faint" style={{ textTransform: 'capitalize' }}>{b.category}{b.note ? ` · ${b.note}` : ''}</div>
              </div>
              <div className="row" style={{ gap: 12, justifyContent: 'flex-end' }}>
                <span className="mono">{b.amount.toFixed(2)}</span>
                <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }} onClick={() => setToDelete(b)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Log expense">
        <div className="field">
          <label>Amount</label>
          <div className="stepper">
            <button onClick={() => setAmount((v) => Math.max(0, +(v - 1).toFixed(2)))}>−</button>
            <span className="value">{amount}</span>
            <button onClick={() => setAmount((v) => +(v + 1).toFixed(2))}>+</button>
          </div>
        </div>
        <div className="field">
          <label>Category</label>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            {BUDGET_CATEGORIES.map((c) => (
              <button key={c} className={`chip${category === c ? ' selected' : ''}`} style={{ textTransform: 'capitalize' }} onClick={() => setCategory(c)}>{c}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Note (optional)</label>
          <input className="input" type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button
          className="btn btn-primary btn-block"
          onClick={() => { addExpense({ amount, category, note }, todayKey()); setLogOpen(false) }}
        >
          Save
        </button>
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete entry?"
        message="This expense will be removed."
        confirmLabel="Delete"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { deleteExpense(toDelete.id); setToDelete(null) }}
      />
    </div>
  )
}
