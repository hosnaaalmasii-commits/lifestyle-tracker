import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { MOOD_STATES, MOOD_ACTIONS } from '../utils/moodActions'
import Sheet from './Sheet'
import Icon from './Icon'

export default function MoodCheckIn({ open, onClose }) {
  const { addMood } = useApp()
  const [picked, setPicked] = useState(null)
  const [logged, setLogged] = useState(false)

  const close = () => {
    onClose()
    setTimeout(() => { setPicked(null); setLogged(false) }, 200)
  }

  const state = picked && MOOD_STATES.find((m) => m.id === picked)
  const actions = picked && MOOD_ACTIONS[picked]

  return (
    <Sheet open={open} onClose={close} title="How are you feeling?">
      {!picked ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
          {MOOD_STATES.map((m) => (
            <button
              key={m.id}
              onClick={() => setPicked(m.id)}
              style={{
                background: 'var(--surface-soft)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                padding: '14px 4px', cursor: 'pointer', textAlign: 'center', color: 'var(--text)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center' }}><Icon name={m.icon} size={24} /></div>
              <div className="text-sm" style={{ marginTop: 6, fontWeight: 600 }}>{m.label}</div>
            </button>
          ))}
        </div>
      ) : (
        <div>
          <div className="row" style={{ marginBottom: 16 }}>
            <div className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
              <span style={{ color: 'var(--accent)' }}><Icon name={state.icon} size={28} /></span>
              <span style={{ fontWeight: 600 }}>{state.label}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setPicked(null)}>Change</button>
          </div>
          <div className="stack">
            {actions.map((a, i) => (
              <div key={i} className="card" style={{ padding: '13px 16px' }}>
                <span className="text-sm">{a}</span>
              </div>
            ))}
          </div>
          <button
            className="btn btn-secondary btn-block"
            style={{ marginTop: 16 }}
            disabled={logged}
            onClick={() => { addMood(state.logAs, `Felt ${state.label.toLowerCase()}`); setLogged(true) }}
          >
            {logged ? (
              <span className="row" style={{ gap: 6, justifyContent: 'center' }}><Icon name="check" size={14} /> Logged to today's mood</span>
            ) : 'Also log this as today\'s mood'}
          </button>
        </div>
      )}
    </Sheet>
  )
}
