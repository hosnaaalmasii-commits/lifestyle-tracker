import { useState, useEffect } from 'react'
import { PAIN_AREAS } from '../utils/painAreas'
import Sheet from './Sheet'

export default function PainCheckIn({ open, onClose, current, onSave }) {
  const [selected, setSelected] = useState(current || [])

  useEffect(() => { if (open) setSelected(current || []) }, [open, current])

  const toggle = (id) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id])
  }

  return (
    <Sheet open={open} onClose={onClose} title="How's your body feeling?">
      <p className="muted text-sm" style={{ marginBottom: 16 }}>
        Flag anything sore or tender today — we'll point out exercises that target those areas.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {PAIN_AREAS.map((a) => (
          <button
            key={a.id}
            className={`chip${selected.includes(a.id) ? ' selected' : ''}`}
            onClick={() => toggle(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>
      <button className="btn btn-primary btn-block" onClick={() => { onSave(selected); onClose() }}>
        {selected.length === 0 ? 'Save — nothing flagged' : 'Save'}
      </button>
    </Sheet>
  )
}
