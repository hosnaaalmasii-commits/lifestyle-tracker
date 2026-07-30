import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey, humanDate } from '../../utils/dates'
import { CYCLE_FLOW_OPTIONS, CYCLE_SYMPTOM_OPTIONS } from '../../utils/voiceLogging'
import BackHeader from '../../components/BackHeader'
import Sheet from '../../components/Sheet'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'

export default function Cycle({ onBack }) {
  const { data, addCycleEntry, deleteCycleEntry } = useApp()
  const [logOpen, setLogOpen] = useState(false)
  const [flow, setFlow] = useState('light')
  const [symptoms, setSymptoms] = useState([])
  const [note, setNote] = useState('')
  const [toDelete, setToDelete] = useState(null)

  const entries = [...data.cycle].reverse()
  const latest = entries[0]

  const toggleSymptom = (s) => {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const openLog = () => {
    setFlow('light')
    setSymptoms([])
    setNote('')
    setLogOpen(true)
  }

  return (
    <div className="page">
      <BackHeader
        eyebrow="More"
        title="Cycle"
        onBack={onBack}
        action={<button className="btn btn-primary btn-sm" onClick={openLog}>+ Log</button>}
      />

      <div className="card">
        {latest ? (
          <>
            <div className="text-sm faint">{humanDate(latest.date)}</div>
            <div style={{ fontWeight: 600, fontSize: 18, marginTop: 4, textTransform: 'capitalize' }}>{latest.flow || 'Logged'}</div>
            {latest.symptoms?.length > 0 && <div className="text-sm muted" style={{ marginTop: 4 }}>{latest.symptoms.join(', ')}</div>}
            {latest.note && <p className="text-sm" style={{ marginTop: 8, fontStyle: 'italic' }}>"{latest.note}"</p>}
          </>
        ) : (
          <p className="text-sm faint">No entries yet.</p>
        )}
      </div>

      <div className="section-title">History</div>
      {entries.length === 0 ? (
        <div className="empty-state"><div className="icon"><Icon name="droplet" size={26} /></div><p>No cycle entries logged yet.</p></div>
      ) : (
        <div className="stack">
          {entries.map((c) => (
            <div key={c.id} className="card row" style={{ padding: '12px 16px', alignItems: 'flex-start' }}>
              <div>
                <div className="text-sm">{humanDate(c.date)}</div>
                <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{c.flow || '—'}</div>
                {c.symptoms?.length > 0 && <div className="text-sm faint">{c.symptoms.join(', ')}</div>}
              </div>
              <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }} onClick={() => setToDelete(c)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Log cycle">
        <div className="field">
          <label>Flow</label>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            {CYCLE_FLOW_OPTIONS.map((f) => (
              <button key={f} className={`chip${flow === f ? ' selected' : ''}`} style={{ textTransform: 'capitalize' }} onClick={() => setFlow(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Symptoms</label>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            {CYCLE_SYMPTOM_OPTIONS.map((s) => (
              <button key={s} className={`chip${symptoms.includes(s) ? ' selected' : ''}`} style={{ textTransform: 'capitalize' }} onClick={() => toggleSymptom(s)}>{s}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Note (optional)</label>
          <input className="input" type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button
          className="btn btn-primary btn-block"
          onClick={() => { addCycleEntry({ flow, symptoms, note }, todayKey()); setLogOpen(false) }}
        >
          Save
        </button>
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete entry?"
        message="This cycle entry will be removed."
        confirmLabel="Delete"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { deleteCycleEntry(toDelete.id); setToDelete(null) }}
      />
    </div>
  )
}
