import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import './Wallpaper.css'

// Rendered as a portal straight to document.body, exactly like Sheet.jsx —
// this is load-bearing, not stylistic. It needs `position: fixed` to cover
// the full viewport behind every page, and per the CSS spec any ancestor
// with a `transform` (like .page's entrance animation, which leaves
// `transform: translateY(0)` behind at rest) becomes the containing block
// for position:fixed descendants instead of the real viewport. Rendering
// inline anywhere under .page would reproduce the exact bug documented in
// this repo's CLAUDE.md for Sheet.jsx. A `z-index: -1` (Wallpaper.css)
// keeps it behind normal page content without needing every page to be
// aware of it.

const STAR_COUNT = 140
const BOKEH_COUNT = 22

// Real starlight isn't uniformly white — cooler blue-white, neutral white,
// and warmer pale-yellow stars mixed together is what actually reads as a
// photographic night sky instead of a scattered-dots pattern. Weighted so
// most stars are faint/small and only a few are the bigger "hero" points.
const STAR_COLORS = ['#ffffff', '#ffffff', '#cfe0ff', '#fff3d6']

function StarField() {
  const stars = useMemo(() => Array.from({ length: STAR_COUNT }, () => {
    const hero = Math.random() < 0.08
    return {
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: hero ? 2.4 + Math.random() * 1.6 : Math.random() * 1.3 + 0.4,
      color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      delay: Math.random() * 7,
      duration: 2.5 + Math.random() * 4.5,
    }
  }), [])
  return (
    <div className="wallpaper wallpaper-stars">
      <span className="milky-way" />
      {stars.map((s, i) => (
        <span
          key={i}
          className="wallpaper-star"
          style={{
            left: `${s.x}%`, top: `${s.y}%`,
            width: s.size, height: s.size,
            background: s.color, color: s.color,
            animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

function Aurora() {
  return (
    <div className="wallpaper wallpaper-aurora">
      <span className="aurora-blob aurora-1" />
      <span className="aurora-blob aurora-2" />
      <span className="aurora-blob aurora-3" />
    </div>
  )
}

function Bokeh() {
  const dots = useMemo(() => Array.from({ length: BOKEH_COUNT }, () => ({
    x: Math.random() * 100,
    size: 20 + Math.random() * 60,
    delay: Math.random() * 12,
    duration: 10 + Math.random() * 10,
  })), [])
  return (
    <div className="wallpaper wallpaper-bokeh">
      {dots.map((d, i) => (
        <span
          key={i}
          className="bokeh-dot"
          style={{
            left: `${d.x}%`, width: d.size, height: d.size,
            animationDelay: `${d.delay}s`, animationDuration: `${d.duration}s`,
          }}
        />
      ))}
    </div>
  )
}

function CloudMesh() {
  return (
    <div className="wallpaper wallpaper-clouds">
      <span className="cloud-blob cloud-1" />
      <span className="cloud-blob cloud-2" />
      <span className="cloud-blob cloud-3" />
      <span className="cloud-blob cloud-4" />
    </div>
  )
}

export const WALLPAPER_OPTIONS = [
  { key: 'none', label: 'None' },
  { key: 'stars', label: 'Stars' },
  { key: 'aurora', label: 'Aurora' },
  { key: 'bokeh', label: 'Bokeh drift' },
  { key: 'clouds', label: 'Gradient clouds' },
]

const WALLPAPERS = { stars: StarField, aurora: Aurora, bokeh: Bokeh, clouds: CloudMesh }

export default function Wallpaper({ type }) {
  const Comp = WALLPAPERS[type]
  if (!Comp || typeof document === 'undefined') return null
  const target = document.getElementById('wallpaper-root') || document.body
  return createPortal(<Comp />, target)
}
