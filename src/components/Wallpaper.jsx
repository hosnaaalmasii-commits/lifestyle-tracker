import { createPortal } from 'react-dom'
import './Wallpaper.css'

// Real NASA photography (public domain — NASA material carries no
// copyright unless explicitly noted, see nasa.gov/nasa-brand-center/images-and-media)
// instead of CSS-drawn patterns, which read as cheap/flat next to actual
// photography. Sourced via images-api.nasa.gov, resized/compressed with
// scripts/optimize-wallpapers.mjs (sharp) before committing.
export const WALLPAPER_OPTIONS = [
  { key: 'none', label: 'None' },
  { key: 'stars', label: 'Stars', file: 'stars.jpg', credit: 'NASA — Milky Way over Earth’s airglow, ISS Expedition 73' },
  { key: 'aurora', label: 'Aurora', file: 'aurora.jpg', credit: 'NASA — Aurora borealis over Canada, ISS Expedition 72' },
  { key: 'nebula', label: 'Nebula', file: 'nebula.jpg', credit: 'NASA/JPL-Caltech — Tarantula Nebula, Spitzer Space Telescope' },
  { key: 'earth', label: 'Earth', file: 'earth.jpg', credit: 'NASA/NOAA/Suomi NPP — Blue Marble' },
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
