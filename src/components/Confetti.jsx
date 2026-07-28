import { useEffect, useRef } from 'react'

const COLORS = ['var(--accent)', 'var(--accent-gradient-end)', 'var(--accent-water)', 'var(--accent-sleep)', 'var(--accent-workout)', 'var(--moss)']

// Lightweight CSS-driven confetti burst — no canvas, no dependency. Fires
// once whenever `trigger` changes to a truthy, new value.
export default function Confetti({ trigger }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!trigger) return
    const container = containerRef.current
    if (!container) return
    const pieces = []
    const count = 28
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span')
      const size = 5 + Math.random() * 5
      const startX = 50 + (Math.random() - 0.5) * 20
      const drift = (Math.random() - 0.5) * 220
      const rise = 40 + Math.random() * 40
      const fall = 240 + Math.random() * 160
      const rotate = Math.random() * 720 - 360
      const duration = 900 + Math.random() * 700
      const delay = Math.random() * 120
      el.style.cssText = `
        position:absolute; left:${startX}%; top:40%;
        width:${size}px; height:${size * 1.4}px;
        background:${COLORS[i % COLORS.length]};
        border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
        opacity:0.95; pointer-events:none;
        transform: translate(0,0) rotate(0deg);
        animation: confetti-fall ${duration}ms cubic-bezier(.15,.6,.4,1) ${delay}ms forwards;
        --drift:${drift}px; --rise:-${rise}px; --fall:${fall}px; --rotate:${rotate}deg;
      `
      container.appendChild(el)
      pieces.push(el)
    }
    const timeout = setTimeout(() => pieces.forEach((p) => p.remove()), 2000)
    return () => { clearTimeout(timeout); pieces.forEach((p) => p.remove()) }
  }, [trigger])

  return (
    <div
      ref={containerRef}
      aria-hidden
      style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 300 }}
    />
  )
}
