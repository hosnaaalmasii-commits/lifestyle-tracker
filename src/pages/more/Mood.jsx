import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey, humanDate, lastNDayKeys } from '../../utils/dates'
import BackHeader from '../../components/BackHeader'
import WeeklyBarChart from '../../components/WeeklyBarChart'
import Sheet from '../../components/Sheet'

const MOODS = [
  { emoji: '😞', value: 1, label: 'Rough' },
  { emoji: '😕', value: 2, label: 'Low' },
  { emoji: '😐', value: 3, label: 'Okay' },
  { emoji: '🙂', value: 4, label: 'Good' },
  { emoji: '😄', value: 5, label: 'Great' },
]

export default function Mood({ onBack }) {
  const { data, addMood } = useApp()
  const [logOpen, setLogOpen] = useState(false)
  const [emoji, setEmoji] = useState('🙂')
  const [note, setNote] = useState('')

  const entries = data.mood
  const today = todayKey()
  const todaysEntry = [...entries].reverse().find((m) => m.date === today)

  const weekKeys = lastNDayKeys(7)
  const weekValues = weekKeys.map((k) => {
    const dayEntries = entries.filter((m) => m.date === k)
    const last = dayEntries[dayEntries.length - 1]
    const value = last ? (MOODS.find((m) => m.emoji === last.emoji)?.value || 0) : 0
    return { key: k, value }
  })

  return (
    <div className="page">
      <BackHeader
        eyebrow="More"
        title="Mood"
        onBack={onBack}
        action={<button className="btn btn-primary btn-sm" onClick={() => { setEmoji(todaysEntry?.emoji || '🙂'); setNote(''); setLogOpen(true) }}>+ Log</button>}
      />

      <div className="card" style={{ textAlign: 'center', padding: '24px 18px' }}>
        <div style={{ fontSize: 44 }}>{todaysEntry ? todaysEntry.emoji : '—'}</div>
        <div className="text-sm muted" style={{ marginTop: 6 }}>{todaysEntry ? 'Logged today' : 'Not logged today'}</div>
        {todaysEntry?.note && <p className="text-sm" style={{ marginTop: 10, fontStyle: 'italic' }}>"{todaysEntry.note}"</p>}
      </div>

      <div className="section-title">This week</div>
      <div className="card">
        <WeeklyBarChart values={weekValues} goal={0} color="var(--accent)" formatValue={(v) => MOODS.find((m) => m.value === v)?.label || 'None'} />
      </div>

      <div className="section-title">History</div>
      {entries.length === 0 ? (
        <div className="empty-state"><div className="icon">🙂</div><p>No moods logged yet.</p></div>
      ) : (
        <div className="stack">
          {[...entries].reverse().slice(0, 30).map((m) => (
            <div key={m.id} className="card row" style={{ padding: '12px 16px' }}>
              <div className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
                <span style={{ fontSize: 20 }}>{m.emoji}</span>
                <div>
                  <div className="text-sm">{humanDate(m.date)}</div>
                  {m.note && <div className="text-sm faint">{m.note}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="How are you feeling?">
        <div className="row" style={{ marginBottom: 20 }}>
          {MOODS.map((m) => (
            <button
              key={m.emoji}
              onClick={() => setEmoji(m.emoji)}
              style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer', fontSize: 30,
                opacity: emoji === m.emoji ? 1 : 0.4,
                transform: emoji === m.emoji ? 'scale(1.15)' : 'scale(1)',
                transition: 'all 0.15s ease',
              }}
            >
              {m.emoji}
            </button>
          ))}
        </div>
        <div className="field">
          <label>Note (optional)</label>
          <input className="input" type="text" placeholder="What's on your mind?" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" onClick={() => { addMood(emoji, note); setLogOpen(false) }}>Save</button>
      </Sheet>
    </div>
  )
}
