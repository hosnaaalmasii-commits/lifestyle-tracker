// Three concentric progress rings merged into one instrument-style dial —
// replaces a single ring when multiple stats need to read as one hero.
export default function FlightDial({ rings, score, label, size = 224, stroke = 14 }) {
  const cx = size / 2
  const cy = size / 2

  return (
    <div className="flight-dial-wrap" style={{ width: size, height: size }}>
      <svg className="flight-dial-ticks" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g stroke="rgba(255,255,255,0.14)" strokeWidth={1}>
          <line x1={cx} y1="4" x2={cx} y2="14" />
          <line x1={cx} y1={size - 4} x2={cx} y2={size - 14} />
          <line x1="4" y1={cy} x2="14" y2={cy} />
          <line x1={size - 4} y1={cy} x2={size - 14} y2={cy} />
        </g>
      </svg>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {rings.map((ring, i) => {
          const r = (size - stroke) / 2 - i * (stroke + 8)
          const c = 2 * Math.PI * r
          const dash = c * Math.max(0, Math.min(1, ring.ratio))
          return (
            <g key={ring.key}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
              <circle
                cx={cx} cy={cy} r={r} fill="none" stroke={ring.color} strokeWidth={stroke}
                strokeLinecap="round" strokeDasharray={`${dash} ${c}`}
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)' }}
              />
            </g>
          )
        })}
      </svg>
      <div className="flight-dial-center">
        <div className="stat-number flight-dial-score">{score}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}
