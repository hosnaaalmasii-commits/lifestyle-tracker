export default function Ring({
  value, // 0..1
  size = 148,
  stroke = 14,
  color = 'var(--accent-ring)',
  trackColor = 'var(--border)',
  children,
}) {
  const clamped = Math.max(0, Math.min(1, value || 0))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = c * clamped

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={trackColor} strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
      }}>
        {children}
      </div>
    </div>
  )
}
