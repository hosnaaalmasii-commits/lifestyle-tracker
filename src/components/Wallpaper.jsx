import { createPortal } from 'react-dom'
import './Wallpaper.css'

// Real photography instead of CSS-drawn patterns, which read as cheap/flat
// next to actual images. All free-licensed (verified "Free Photo" /
// "Download free" on Unsplash — not Unsplash+ paid content — at the time
// these were sourced), resized/compressed with
// scripts/optimize-wallpapers.mjs (sharp) before committing.
//
// Every wallpaper shares the SAME neutral off-white accent, on purpose —
// an earlier version matched each photo's own saturated color (gold,
// teal, amber) and it read as "everything is orange," repeated across
// every button/ring/tab/checkbox on every screen. The photo itself is
// already the color; the UI on top of it stays quiet and neutral so nothing
// fights the image — closer to how a premium app treats a photo background
// (the picture carries the color, the chrome doesn't add a second one).
// AppContext.jsx's theme effect uses this instead of the user's
// manually-picked Classic accent whenever a wallpaper is active, the same
// way Fintech's gradient already overrides Classic colors — turning the
// wallpaper back off cleanly restores whatever the user had picked by hand.
const NEUTRAL_ACCENT = '#f3f1ea'

export const WALLPAPER_OPTIONS = [
  { key: 'none', label: 'None' },
  {
    key: 'stars', label: 'Stars', file: 'stars.jpg',
    credit: 'Dns Dgn — Milky way on mountains (Unsplash)',
    accent: NEUTRAL_ACCENT,
  },
  {
    key: 'sea', label: 'Sea', file: 'sea.jpg',
    credit: 'Jakob Owens — Turbulent ocean wave (Unsplash)',
    accent: NEUTRAL_ACCENT,
  },
  {
    key: 'rain', label: 'Rain', file: 'rain.jpg',
    credit: 'Max van den Oetelaar — Rain on a window at night (Unsplash)',
    accent: NEUTRAL_ACCENT,
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
