import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey, humanDate, isToday } from '../../utils/dates'
import BackHeader from '../../components/BackHeader'
import Sheet from '../../components/Sheet'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'

export default function Schedule({ onBack }) {
  const { data, addScheduleItem, deleteScheduleItem } = useApp()
  const [logOpen, setLogOpen] = useState(false)
  const [text, setText] = useState('')
  const [time, setTime] = useState('')
  const [toDelete, setToDelete] = useState(null)

  const upcoming = data.schedule.filter((s) => s.date >= todayKey())
  const past = data.schedule.filter((s) => s.date < todayKey()).slice().reverse()

  const openLog = () => {
    setText('')
    setTime('')
    setLogOpen(true)
  }

  const renderRow = (s) => (
    <div key={s.id} className="card row" style={{ padding: '12px 16px' }}>
      <div>
        <div className="text-sm faint">{isToday(s.date) ? 'Today' : humanDate(s.date)}{s.time ? ` · ${s.time}` : ''}</div>
        <div style={{ fontWeight: 500 }}>{s.text}</div>
      </div>
      <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }} onClick={() => setToDelete(s)}>Delete</button>
    </div>
  )

  return (
    <div className="page">
      <BackHeader
        eyebrow="More"
        title="Schedule"
        onBack={onBack}
        action={<button className="btn btn-primary btn-sm" onClick={openLog}>+ Add</button>}
      />

      <div className="section-title" style={{ marginTop: 0 }}>Upcoming</div>
      {upcoming.length === 0 ? (
        <div className="empty-state"><div className="icon"><Icon name="calendar" size={26} /></div><p>Nothing scheduled.</p></div>
      ) : (
        <div className="stack">{upcoming.map(renderRow)}</div>
      )}

      {past.length > 0 && (
        <>
          <div className="section-title">Past</div>
          <div className="stack">{past.map(renderRow)}</div>
        </>
      )}

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Add to schedule">
        <div className="field">
          <label>What</label>
          <input className="input" type="text" placeholder="e.g. Dentist appointment" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="field">
          <label>Time (optional)</label>
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <button
          className="btn btn-primary btn-block"
          disabled={!text.trim()}
          onClick={() => { addScheduleItem({ text: text.trim(), time: time || null }, todayKey()); setLogOpen(false) }}
        >
          Save
        </button>
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete item?"
        message="This schedule item will be removed."
        confirmLabel="Delete"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { deleteScheduleItem(toDelete.id); setToDelete(null) }}
      />
    </div>
  )
}
