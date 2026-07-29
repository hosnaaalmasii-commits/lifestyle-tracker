import { useState } from 'react'
import { COLOR_GROUPS } from '../utils/colorPresets'

const QUICK_PICKS = COLOR_GROUPS.map((g) => g.swatches[0])

function Swatch({ p, value, onChange, size = 30 }) {
  const selected = value.toLowerCase() === p.hex.toLowerCase()
  return (
    <button
      key={p.hex}
      title={p.name}
      onClick={() => onChange(p.hex)}
      style={{
        flexShrink: 0, width: size, height: size, borderRadius: '50%', background: p.hex,
        border: selected ? '2px solid var(--text)' : '2px solid transparent',
        boxShadow: '0 0 0 1px var(--border)',
        cursor: 'pointer',
      }}
    />
  )
}

export default function ColorPicker({ label, value, onChange }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="field">
      <div className="row" style={{ marginBottom: 10 }}>
        <label style={{ margin: 0 }}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mono text-sm muted">{value.toUpperCase()}</span>
          <label
            style={{
              width: 30, height: 30, borderRadius: '50%', background: value,
              border: '2px solid var(--surface-raised)', boxShadow: '0 0 0 1px var(--border)',
              display: 'block', cursor: 'pointer', position: 'relative', overflow: 'hidden',
            }}
          >
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              style={{ position: 'absolute', inset: -4, opacity: 0, cursor: 'pointer' }}
            />
          </label>
        </div>
      </div>

      {!expanded ? (
        <div className="row" style={{ gap: 8 }}>
          <div className="scroll-x" style={{ flex: 1 }}>
            {QUICK_PICKS.map((p) => <Swatch key={p.hex} p={p} value={value} onChange={onChange} />)}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0, padding: '6px 10px' }} onClick={() => setExpanded(true)}>
            More shades
          </button>
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {COLOR_GROUPS.map((group) => (
            <div key={group.name}>
              <div className="text-sm faint" style={{ marginBottom: 6, fontWeight: 600 }}>{group.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {group.swatches.map((p) => <Swatch key={p.hex} p={p} value={value} onChange={onChange} size={28} />)}
              </div>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', padding: '4px 0' }} onClick={() => setExpanded(false)}>
            Show fewer
          </button>
        </div>
      )}
    </div>
  )
}
