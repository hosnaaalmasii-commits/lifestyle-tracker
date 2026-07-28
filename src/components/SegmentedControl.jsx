export default function SegmentedControl({ options, value, onChange }) {
  return (
    <div style={{
      display: 'flex', background: 'var(--surface-soft)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-pill)', padding: 3, gap: 2,
    }}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, border: 'none', borderRadius: 'var(--radius-pill)', padding: '8px 10px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? '#fff' : 'var(--text-soft)',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
