import { humanDate } from '../utils/dates'

// values: [{ key (dateKey), value }]
export default function LineChart({ values, color = 'var(--accent)', height = 140 }) {
  if (values.length === 0) {
    return <div className="empty-state text-sm">Not enough data yet</div>
  }
  if (values.length === 1) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{values[0].value}</span>
      </div>
    )
  }

  const width = 300
  const padY = 16
  const min = Math.min(...values.map((v) => v.value))
  const max = Math.max(...values.map((v) => v.value))
  const range = max - min || 1
  const stepX = width / (values.length - 1)

  const points = values.map((v, i) => {
    const x = i * stepX
    const y = padY + (1 - (v.value - min) / range) * (height - padY * 2)
    return [x, y]
  })

  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const areaPath = `${path} L${points[points.length - 1][0]},${height} L0,${height} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <defs>
          <linearGradient id="line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.22" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#line-fill)" stroke="none" />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === points.length - 1 ? 4 : 2.5} fill={color} />
        ))}
      </svg>
      <div className="row" style={{ marginTop: 4 }}>
        <span className="text-sm faint mono">{humanDate(values[0].key)}</span>
        <span className="text-sm faint mono">{humanDate(values[values.length - 1].key)}</span>
      </div>
    </div>
  )
}
