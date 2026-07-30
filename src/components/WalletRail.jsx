import { useEffect, useRef, useState } from 'react'
import Sparkline from './Sparkline'

// Horizontal scroll-snap "wallet card" carousel. Touch already scrolls this
// natively via overflow-x — the drag-to-scroll handling below exists only
// for a plain desktop mouse (no trackpad/touchscreen), which cannot
// drag-scroll a div by default. It's gated on pointerType === 'mouse' and
// never touches touch/pen input: mixing custom JS drag logic with touch's
// own event model is exactly how you end up with a stuck global listener
// hijacking an unrelated tap elsewhere on the page.
export default function WalletRail({ cards }) {
  const railRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [dragging, setDragging] = useState(false)
  const drag = useRef({ startX: 0, startScrollLeft: 0, moved: false })

  const handleScroll = () => {
    const rail = railRef.current
    if (!rail || !rail.firstElementChild) return
    const cardWidth = rail.firstElementChild.getBoundingClientRect().width + 14
    setActiveIndex(Math.round(rail.scrollLeft / cardWidth))
  }

  const handlePointerDown = (e) => {
    if (e.pointerType !== 'mouse') return
    drag.current = { startX: e.clientX, startScrollLeft: railRef.current.scrollLeft, moved: false }
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      const dx = e.clientX - drag.current.startX
      if (Math.abs(dx) > 4) drag.current.moved = true
      railRef.current.scrollLeft = drag.current.startScrollLeft - dx
    }
    const onUp = () => setDragging(false)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging])

  const handleCardClick = (e, onClick) => {
    if (drag.current.moved) {
      e.preventDefault()
      drag.current.moved = false
      return
    }
    onClick?.()
  }

  const goToIndex = (i) => {
    const rail = railRef.current
    if (!rail || !rail.firstElementChild) return
    const cardWidth = rail.firstElementChild.getBoundingClientRect().width + 14
    rail.scrollTo({ left: cardWidth * i, behavior: 'smooth' })
  }

  return (
    <div>
      <div
        className={`wallet-rail${dragging ? ' dragging' : ''}`}
        ref={railRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
      >
        {cards.map((c) => (
          <button
            key={c.key}
            className="wallet-card"
            style={{ background: c.gradient, textAlign: 'left', cursor: c.onClick ? 'pointer' : 'default' }}
            onClick={(e) => handleCardClick(e, c.onClick)}
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
          <button
            key={c.key}
            className={i === activeIndex ? 'on' : ''}
            aria-label={`Go to ${c.eyebrow}`}
            onClick={() => goToIndex(i)}
          />
        ))}
      </div>
    </div>
  )
}
