import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey, humanDate, isToday } from '../../utils/dates'
import BackHeader from '../../components/BackHeader'
import Sheet from '../../components/Sheet'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'
import { tx } from '../../i18n/tx'

export default function Notes({ onBack }) {
  const { data, addNote, deleteNote } = useApp()
  const [logOpen, setLogOpen] = useState(false)
  const [text, setText] = useState('')
  const [toDelete, setToDelete] = useState(null)

  const entries = [...data.notes].reverse()

  const openLog = () => {
    setText('')
    setLogOpen(true)
  }

  return (
    <div className="page">
      <BackHeader
        eyebrow={tx("More")}
        title={tx("Notes")}
        onBack={onBack}
        action={<button className="btn btn-primary btn-sm" onClick={openLog}>{tx("+ Add")}</button>}
      />

      {entries.length === 0 ? (
        <div className="empty-state"><div className="icon"><Icon name="chat" size={26} /></div><p>{tx("No notes yet — jot something down, or save a voice note before it's parsed.")}</p></div>
      ) : (
        <div className="stack">
          {entries.map((n) => (
            <div key={n.id} className="card row" style={{ padding: '12px 16px', alignItems: 'flex-start' }}>
              <div>
                <div className="text-sm faint">{isToday(n.date) ? tx("Today") : humanDate(n.date)}</div>
                <div style={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>{n.text}</div>
              </div>
              <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13, flexShrink: 0 }} onClick={() => setToDelete(n)}>{tx("Delete")}</button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title={tx("Add note")}>
        <div className="field">
          <label>{tx("Note")}</label>
          <textarea
            className="input"
            style={{ minHeight: 84, resize: 'vertical' }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
        </div>
        <button
          className="btn btn-primary btn-block"
          disabled={!text.trim()}
          onClick={() => { addNote(text.trim(), todayKey()); setLogOpen(false) }}
        >
          {tx("Save")}
        </button>
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        title={tx("Delete note?")}
        message={tx("This note will be removed.")}
        confirmLabel={tx("Delete")}
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { deleteNote(toDelete.id); setToDelete(null) }}
      />
    </div>
  )
}
