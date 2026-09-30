import { useEffect, useId, useState } from 'react'

export default function Ring({
  value, // 0..1
  size = 148,
  stroke = 14,
  color = 'var(--accent-ring)',
  gradientTo, // optional second color — renders the ring as a gradient
  trackColor = 'var(--border)',
  children,
}) {
  const gradientId = useId()
  const clamped = Math.max(0, Math.min(1, value || 0))
  // Starts empty and fills to the real value on the next frame, so the
  // ring visibly sweeps up when a page opens (the CSS transition does the
  // animating; later value changes animate the same way).
  const [shown, setShown] = useState(0)
  useEffect(() => {
    // setTimeout rather than requestAnimationFrame: rAF is paused in a
    // background tab, which would leave the ring stuck empty.
    const id = setTimeout(() => setShown(clamped), 30)
    return () => clearTimeout(id)
  }, [clamped])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = c * shown
  const strokeValue = gradientTo ? `url(#${gradientId})` : color

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {gradientTo && (
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={gradientTo} />
            </linearGradient>
          </defs>
        )}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={trackColor} strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={strokeValue} strokeWidth={stroke}
          strokeLinecap={shown > 0 ? 'round' : 'butt'}
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(.22,1,.36,1)' }}
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
