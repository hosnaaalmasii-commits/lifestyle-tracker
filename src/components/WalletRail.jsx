import { useRef, useState } from 'react'
import Sparkline from './Sparkline'

// Horizontal scroll-snap "wallet card" carousel — each card tilts toward the
// cursor with a moving sheen, like a metal card catching light. Mutates DOM
// style directly on mousemove instead of React state, since re-rendering on
// every pointer move would be wasteful.
export default function WalletRail({ cards }) {
  const railRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const handleScroll = () => {
    const rail = railRef.current
    if (!rail || !rail.firstElementChild) return
    const cardWidth = rail.firstElementChild.getBoundingClientRect().width + 14
    setActiveIndex(Math.round(rail.scrollLeft / cardWidth))
  }

  const handleTilt = (e) => {
    const card = e.currentTarget
    const r = card.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    const rx = (py - 0.5) * -10
    const ry = (px - 0.5) * 10
    card.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`
    card.style.setProperty('--mx', `${px * 100}%`)
    card.style.setProperty('--my', `${py * 100}%`)
  }

  const resetTilt = (e) => {
    e.currentTarget.style.transform = 'rotateX(0) rotateY(0) scale(1)'
  }

  return (
    <div>
      <div className="wallet-rail" ref={railRef} onScroll={handleScroll}>
        {cards.map((c) => (
          <div
            key={c.key}
            className="wallet-card"
            style={{ background: c.gradient }}
            onMouseMove={handleTilt}
            onMouseLeave={resetTilt}
          >
            <div className="wallet-sheen" />
            <div className="wallet-eyebrow">
              <span>{c.eyebrow}</span>
              <span className="wallet-chip" />
            </div>
            <div className="wallet-number">{c.value}{c.valueSuffix && <span className="wallet-suffix"> {c.valueSuffix}</span>}</div>
            <div className="wallet-sub">{c.sub}</div>
            {c.trend && c.trend.some((v) => v > 0) && (
              <Sparkline values={c.trend} width={120} height={26} color="rgba(255,255,255,0.9)" />
            )}
          </div>
        ))}
      </div>
      <div className="wallet-dots">
        {cards.map((c, i) => (
          <span key={c.key} className={i === activeIndex ? 'on' : ''} />
        ))}
      </div>
    </div>
  )
}
