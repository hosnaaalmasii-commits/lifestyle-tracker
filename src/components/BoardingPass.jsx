// A literal torn boarding-pass ticket for today's single most actionable
// item (the workout) — a perforated divider and a barcode-textured stub
// stand in for a plain "start workout" card.
export default function BoardingPass({ eyebrow, title, meta, stubLabel, onClick, done }) {
  return (
    <button className="boarding-pass" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <div className="pass-main">
        <div className="eyebrow" style={{ marginBottom: 0 }}>{eyebrow}</div>
        <div className="pass-route">{title}</div>
        <div className="pass-meta">
          {meta.map((m) => (
            <div key={m.label}>{m.label}<b>{m.value}</b></div>
          ))}
        </div>
      </div>
      <div className="pass-perf" />
      <div className={`pass-stub${done ? ' done' : ''}`}>
        <div className="barcode" aria-hidden="true">
          {[60, 90, 40, 75, 55, 85, 35, 95, 50].map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
        <span className="pass-go">{stubLabel}</span>
      </div>
    </button>
  )
}
