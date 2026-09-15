import Icon from './Icon'

// Deliberately no card chrome of its own (no border/background/shadow) —
// meant to sit as one column inside a single shared .card via a
// borderLeft divider, Oura's top-row-of-bare-stats look, rather than as
// its own boxed card. Three of these next to each other used to be three
// separate bordered boxes; one shared card with quiet dividers between
// columns reads as one glanceable strip instead.
export default function MiniCard({ label, value, sub, icon, accent, onClick, divider }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, textAlign: 'left', cursor: onClick ? 'pointer' : 'default', minWidth: 0,
        background: 'none', border: 'none', padding: '18px 14px',
        borderLeft: divider ? '1px solid var(--border-soft)' : 'none',
      }}
    >
      <div className="row" style={{ marginBottom: 10, alignItems: 'flex-start' }}>
        <span className="text-sm muted" style={{ fontWeight: 600 }}>{label}</span>
        {icon && (
          <span style={{
            width: 26, height: 26, borderRadius: '50%', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: accent || 'var(--text-soft)',
            background: accent ? `color-mix(in srgb, ${accent} 18%, transparent)` : 'var(--surface-soft)',
          }}>
            <Icon name={icon} size={14} />
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
