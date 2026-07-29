// Small inline trend line for embedding inside list rows/cards — a
// lighter-weight sibling to LineChart.jsx, which is sized for a full card.
export default function Sparkline({ values, width = 64, height = 24, color = 'var(--accent)' }) {
  if (!values || values.length < 2) {
    return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden />
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = width / (values.length - 1)
  const points = values.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const last = points[points.length - 1].split(',').map(Number)

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={color} />
    </svg>
  )
}
