export default function MiniCard({ label, value, sub, icon, accent, onClick }) {
  return (
    <button
      className="card"
      onClick={onClick}
      style={{
        flex: 1, textAlign: 'left', cursor: onClick ? 'pointer' : 'default',
        border: '1px solid var(--border-soft)', minWidth: 0,
      }}
    >
      <div className="row" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
        <span className="text-sm muted" style={{ fontWeight: 600 }}>{label}</span>
        {icon && (
          <span style={{
            width: 26, height: 26, borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 13,
            background: accent ? `color-mix(in srgb, ${accent} 18%, transparent)` : 'var(--surface-soft)',
          }}>
            {icon}
          </span>
        )}
      </div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </div>
      {sub && <div className="text-sm faint" style={{ marginTop: 2 }}>{sub}</div>}
    </button>
  )
}
