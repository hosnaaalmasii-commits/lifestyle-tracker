import { createPortal } from 'react-dom'
import './Wallpaper.css'

// Real photography instead of CSS-drawn patterns, which read as cheap/flat
// next to actual images. All free-licensed (verified "Free Photo" /
// "Download free" on Unsplash — not Unsplash+ paid content — at the time
// these were sourced), resized/compressed with
// scripts/optimize-wallpapers.mjs (sharp) before committing.
//
// Every wallpaper shares the SAME neutral off-white accent for solid-fill
// chrome (buttons/chips/tags), on purpose — an earlier version matched
// each photo's own saturated color (gold, teal, amber) and it read as
// "everything is orange," repeated across every full-width button on
// every screen. AppContext.jsx's theme effect uses this instead of the
// user's manually-picked Classic accent whenever a wallpaper is active,
// the same way Fintech's gradient already overrides Classic colors —
// turning the wallpaper back off cleanly restores whatever the user had
// picked by hand.
const NEUTRAL_ACCENT = '#f3f1ea'

// Small-area color (a ring's stroke, a thin progress-bar fill, a streak
// icon) doesn't reproduce the "stark block" problem a full-width solid
// button did — so unlike NEUTRAL_ACCENT above, these stay varied rather
// than collapsing to one flat tone. Collapsing them too flattened the
// whole app into one monochrome look under a wallpaper, which read as
// "boring" — this brings back distinct, warm hues (amber hero ring,
// sky-blue water, moon-lavender sleep, ember-coral workout) that still
// read as one cohesive "warm night" family rather than a clashing
// per-page rainbow.
const WARM_PALETTE = {
  ring: '#f2b84c',
  ringEnd: '#ff7a45',
  water: '#6fa8c9',
  sleep: '#9b8bc4',
  workout: '#e2793f',
}

export const WALLPAPER_OPTIONS = [
  { key: 'none', label: 'None' },
  {
    key: 'stars', label: 'Stars', file: 'stars.jpg',
    credit: 'Dns Dgn — Milky way on mountains (Unsplash)',
    accent: NEUTRAL_ACCENT,
    palette: WARM_PALETTE,
  },
  {
    key: 'sea', label: 'Sea', file: 'sea.jpg',
    credit: 'Jakob Owens — Turbulent ocean wave (Unsplash)',
    accent: NEUTRAL_ACCENT,
    palette: WARM_PALETTE,
  },
  {
    key: 'rain', label: 'Rain', file: 'rain.jpg',
    credit: 'Max van den Oetelaar — Rain on a window at night (Unsplash)',
    accent: NEUTRAL_ACCENT,
    palette: WARM_PALETTE,
  },
]

const BASE = import.meta.env.BASE_URL

export default function Wallpaper({ type }) {
  const opt = WALLPAPER_OPTIONS.find((w) => w.key === type)
  if (!opt || !opt.file || typeof document === 'undefined') return null
  const target = document.getElementById('wallpaper-root') || document.body
  return createPortal(
    <div className="wallpaper" style={{ backgroundImage: `url(${BASE}wallpapers/${opt.file})` }}>
      <div className="wallpaper-vignette" />
    </div>,
    target
  )
}
