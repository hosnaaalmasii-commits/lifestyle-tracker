// One-off icon generator: dark background with a rising flame — becoming
// the fullest, most alive version of yourself, one day's effort at a
// time. Also just reads as a single bold, unmistakable mark at every
// size, unlike a many-small-leaves wreath which blurs at favicon scale.
// Uses the same flame-tongue curve shape as the app's own Fire archetype
// (ElementalCreature.jsx's tongue()), layered for depth, so the icon
// feels like it belongs to the same visual world as the app itself.
// Run with `npm run gen-icons`. Requires `sharp` (devDependency).
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')
const iconsDir = path.join(publicDir, 'icons')
mkdirSync(iconsDir, { recursive: true })

const SIZE = 512
const CX = SIZE / 2
const BASE_Y = 388

// A single flame "tongue": a teardrop from a flat base up to a tip that
// can lean left/right, bulging asymmetrically on the way up like a real
// flame's flicker rather than a perfectly symmetric almond.
function tongue(leanX, h, w, bulge = 0.3) {
  const tipX = CX + leanX
  const tipY = BASE_Y - h
  return `M${CX - w},${BASE_Y} C${CX - w - w * bulge},${BASE_Y - h * 0.45} ${tipX - w * 0.35},${BASE_Y - h * 0.88} ${tipX},${tipY} C${tipX + w * 0.32},${BASE_Y - h * 0.82} ${CX + w + w * bulge * 0.6},${BASE_Y - h * 0.42} ${CX + w},${BASE_Y} Z`
}

function svg({ maskable }) {
  const rx = maskable ? 0 : SIZE * 0.22
  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${SIZE}" y2="${SIZE}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#243119"/>
      <stop offset="1" stop-color="#182010"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="62%" r="45%">
      <stop offset="0" stop-color="#FFDB8A" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#FFDB8A" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="outer" x1="${CX}" y1="${BASE_Y - 260}" x2="${CX}" y2="${BASE_Y}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#F6B94A"/>
      <stop offset="1" stop-color="#D9631F"/>
    </linearGradient>
    <linearGradient id="inner" x1="${CX}" y1="${BASE_Y - 190}" x2="${CX}" y2="${BASE_Y}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#FFF3C4"/>
      <stop offset="1" stop-color="#FCCB56"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="${rx}" ry="${rx}" fill="url(#bg)"/>
  <circle cx="${CX}" cy="${BASE_Y - 130}" r="190" fill="url(#glow)"/>
  <path d="${tongue(6, 262, 96, 0.34)}" fill="url(#outer)"/>
  <path d="${tongue(-10, 178, 56, 0.28)}" fill="url(#inner)"/>
</svg>`
}

const roundedSvg = svg({ maskable: false })
const maskableSvg = svg({ maskable: true })

writeFileSync(path.join(publicDir, 'favicon.svg'), roundedSvg)
writeFileSync(path.join(iconsDir, 'icon.svg'), roundedSvg)

const targets = [
  { file: path.join(publicDir, 'apple-touch-icon.png'), size: 180, source: roundedSvg },
  { file: path.join(iconsDir, 'icon-192.png'), size: 192, source: roundedSvg },
  { file: path.join(iconsDir, 'icon-512.png'), size: 512, source: roundedSvg },
  { file: path.join(iconsDir, 'icon-512-maskable.png'), size: 512, source: maskableSvg },
  { file: path.join(publicDir, 'favicon-32.png'), size: 32, source: roundedSvg },
]

for (const t of targets) {
  await sharp(Buffer.from(t.source))
    .resize(t.size, t.size)
    .png()
    .toFile(t.file)
  console.log('wrote', t.file)
}
