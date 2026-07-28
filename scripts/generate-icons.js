// One-off icon generator: dark green rounded square with a purple ring + arc.
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
const CY = SIZE / 2
const R = 150
const CIRC = 2 * Math.PI * R
const ARC_FRACTION = 0.72
const dash = `${(CIRC * ARC_FRACTION).toFixed(2)} ${CIRC.toFixed(2)}`

function svg({ rounded }) {
  const rx = rounded ? SIZE * 0.22 : 0
  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${SIZE}" y2="${SIZE}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#243119"/>
      <stop offset="1" stop-color="#182010"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${SIZE}" height="${SIZE}" rx="${rx}" ry="${rx}" fill="url(#bg)"/>
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#7C5A9C" stroke-width="20" opacity="0.5"/>
  <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#C9A6F2" stroke-width="30"
    stroke-linecap="round" stroke-dasharray="${dash}" transform="rotate(-90 ${CX} ${CY})"/>
</svg>`
}

const roundedSvg = svg({ rounded: true })
const maskableSvg = svg({ rounded: false })

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
