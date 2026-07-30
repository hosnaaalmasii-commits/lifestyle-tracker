import { useRef, useState } from 'react'
import Sparkline from './Sparkline'

// Horizontal scroll-snap "wallet card" carousel. Deliberately no 3D
// tilt-on-hover here — perspective/preserve-3d on scroll-snap children is a
// known source of broken native scroll/touch gestures in several browsers,
// which isn't worth trading for a hover flourish on what's meant to be a
// swipeable list.
export default function WalletRail({ cards }) {
  const railRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const handleScroll = () => {
    const rail = railRef.current
    if (!rail || !rail.firstElementChild) return
    const cardWidth = rail.firstElementChild.getBoundingClientRect().width + 14
    setActiveIndex(Math.round(rail.scrollLeft / cardWidth))
  }

  return (
    <div>
      <div className="wallet-rail" ref={railRef} onScroll={handleScroll}>
        {cards.map((c) => (
          <button
            key={c.key}
            className="wallet-card"
            style={{ background: c.gradient, textAlign: 'left', cursor: c.onClick ? 'pointer' : 'default' }}
            onClick={c.onClick}
          >
            <div className="wallet-eyebrow">
              <span>{c.eyebrow}</span>
              <span className="wallet-chip" />
            </div>
            <div className="wallet-number">{c.value}{c.valueSuffix && <span className="wallet-suffix"> {c.valueSuffix}</span>}</div>
            <div className="wallet-sub">{c.sub}</div>
            {c.trend && c.trend.some((v) => v > 0) && (
              <Sparkline values={c.trend} width={120} height={26} color="rgba(255,255,255,0.9)" />
            )}
          </button>
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
