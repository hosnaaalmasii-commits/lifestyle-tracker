import { useEffect, useRef, useState } from 'react'
import Sheet from './Sheet'
import { formatSeconds } from '../utils/time'

export default function RestTimer({ open, onClose, seconds, exerciseName }) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (open) {
      setRemaining(seconds)
      setRunning(true)
    } else {
      setRunning(false)
    }
  }, [open, seconds])

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false)
          if (navigator.vibrate) navigator.vibrate([120, 60, 120])
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [running])

  const ratio = seconds > 0 ? remaining / seconds : 0
  const done = remaining === 0

  return (
    <Sheet open={open} onClose={onClose} title={exerciseName ? `Rest — ${exerciseName}` : 'Rest'}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 4px' }}>
        <div style={{ position: 'relative', width: 160, height: 160 }}>
          <svg width={160} height={160} viewBox="0 0 160 160">
            <circle cx={80} cy={80} r={70} fill="none" stroke="var(--border)" strokeWidth={12} />
            <circle
              cx={80} cy={80} r={70} fill="none"
              stroke={done ? 'var(--success)' : 'var(--accent-workout)'}
              strokeWidth={12} strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 70 * ratio} ${2 * Math.PI * 70}`}
              transform="rotate(-90 80 80)"
              style={{ transition: 'stroke-dasharray 0.3s linear' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="mono" style={{ fontSize: 34, fontWeight: 700 }}>{formatSeconds(remaining)}</span>
          </div>
        </div>
        {done && <p className="text-sm" style={{ marginTop: 14, color: 'var(--success)', fontWeight: 600 }}>Rest complete — back to it!</p>}
        <div className="row" style={{ marginTop: 20, gap: 10, width: '100%' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setRemaining(seconds); setRunning(true) }}>Reset</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setRunning((r) => !r)} disabled={done}>
            {running ? 'Pause' : 'Resume'}
          </button>
        </div>
      </div>
    </Sheet>
  )
}
