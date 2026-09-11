import { createPortal } from 'react-dom'
import './Wallpaper.css'

// Real photography instead of CSS-drawn patterns, which read as cheap/flat
// next to actual images. All free-licensed (verified "Free Photo" /
// "Download free" on Unsplash — not Unsplash+ paid content — at the time
// these were sourced), resized/compressed with
// scripts/optimize-wallpapers.mjs (sharp) before committing.
//
// Each entry also carries `accent`/`ring`/`gradientEnd` — colors picked to
// match that specific photo's own palette. AppContext.jsx's theme effect
// uses these instead of the user's manually-picked Classic accent whenever
// a wallpaper is active, the same way Fintech's gradient already overrides
// Classic colors — so picking a wallpaper doesn't leave the rest of the UI
// clashing with it, and turning the wallpaper back off cleanly restores
// whatever the user had picked by hand.
export const WALLPAPER_OPTIONS = [
  { key: 'none', label: 'None' },
  {
    key: 'stars', label: 'Stars', file: 'stars.jpg',
    credit: 'Dns Dgn — Milky way on mountains (Unsplash)',
    accent: '#e8b84b', ring: '#e8b84b', gradientEnd: '#7c5cd4',
  },
  {
    key: 'sea', label: 'Sea', file: 'sea.jpg',
    credit: 'Jakob Owens — Turbulent ocean wave (Unsplash)',
    accent: '#4dd0c8', ring: '#4dd0c8', gradientEnd: '#1a6e8a',
  },
  {
    key: 'rain', label: 'Rain', file: 'rain.jpg',
    credit: 'Max van den Oetelaar — Rain on a window at night (Unsplash)',
    accent: '#f0a355', ring: '#f0a355', gradientEnd: '#2a7fa8',
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
