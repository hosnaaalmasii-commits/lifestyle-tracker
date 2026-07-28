import { COLOR_PRESETS } from '../utils/colorPresets'

export default function ColorPicker({ label, value, onChange }) {
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
      <div className="scroll-x">
        {COLOR_PRESETS.map((p) => (
          <button
            key={p.hex}
            title={p.name}
            onClick={() => onChange(p.hex)}
            style={{
              flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: p.hex,
              border: value.toLowerCase() === p.hex.toLowerCase() ? '2px solid var(--text)' : '2px solid transparent',
              boxShadow: '0 0 0 1px var(--border)',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>
    </div>
  )
}
