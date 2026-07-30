import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { computeCompanionState } from '../utils/companionState'
import CompanionCreature from './CompanionCreature'
import Sheet from './Sheet'

export default function CompanionStateCard({ variant = 'hero' }) {
  const { data } = useApp()
  const [open, setOpen] = useState(false)
  const companion = computeCompanionState(data)

  const trigger = variant === 'bento' ? (
    <button className="tile tile-companion-state" onClick={() => setOpen(true)} style={{ cursor: 'pointer' }}>
      <div style={{ flexShrink: 0 }}>
        <CompanionCreature state={companion.state} size={56} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="stat-label">Companion state</div>
        <div className="stat-number tile-num" style={{ fontSize: 19, marginTop: 2 }}>{companion.name}</div>
      </div>
    </button>
  ) : (
    <button className="card" onClick={() => setOpen(true)} style={{ textAlign: 'left', cursor: 'pointer', width: '100%', padding: '20px 18px' }}>
      <div className="row" style={{ alignItems: 'center', gap: 16 }}>
        <div style={{ flexShrink: 0 }}>
          <CompanionCreature state={companion.state} size={72} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="text-sm muted">Companion state</div>
          <div style={{ fontWeight: 700, fontSize: 19, fontFamily: 'var(--font-heading)' }}>{companion.name}</div>
          <div className="text-sm faint" style={{ marginTop: 2 }}>{companion.blurb}</div>
        </div>
      </div>
    </button>
  )

  return (
    <>
      {trigger}
      <Sheet open={open} onClose={() => setOpen(false)} title={companion.name}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <CompanionCreature state={companion.state} size={96} />
        </div>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 16, textAlign: 'center' }}>{companion.headline}</p>
        <p className="text-sm muted" style={{ margin: '0 0 20px', textAlign: 'center' }}>{companion.blurb}</p>

        <div className="stack" style={{ gap: 10, marginBottom: 18 }}>
          {companion.drivers.map((d) => (
            <div key={d.key} className="row" style={{ fontSize: 13.5, gap: 10 }}>
              <span className="muted" style={{ width: 66, flexShrink: 0 }}>{d.label}</span>
              <span className="xp-bar-track" style={{ flex: 1 }}>
                <span className="xp-bar-fill" style={{ width: `${Math.round(d.ratio * 100)}%`, background: `var(--state-${companion.state})` }} />
              </span>
              <span className="mono text-sm faint" style={{ width: 90, textAlign: 'right', flexShrink: 0 }}>{d.valueLabel}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
          <div className="text-sm faint" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11, marginBottom: 4 }}>Next</div>
          <p style={{ margin: 0, fontSize: 14 }}>{companion.nextAction}</p>
        </div>
      </Sheet>
    </>
  )
}
