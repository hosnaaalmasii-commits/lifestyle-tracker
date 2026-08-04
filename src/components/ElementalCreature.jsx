// Each archetype rendered as its own real phenomenon rather than one
// shared shape recoloured ten ways — a fire that grows and heats up, a
// moon that waxes toward full, a blade being forged, and so on. Every
// icon takes the same two independent inputs: `growth` (0..1, evolution
// stage — drives size/complexity) and `vitality` (0..1, today's condition
// state — drives brightness/colour/openness). `muted` dims further for
// damage-tier conditions.
//
// Deliberately no SVG <filter>/feGaussianBlur anywhere in this file —
// Safari (especially iOS) has long-standing bugs rendering many
// simultaneous SVG blur filters, particularly combined with transforms,
// which can silently blank out or hang the whole element. All "glow"
// effects below use radialGradient-to-transparent fills instead, which
// give a soft look with no filter primitive involved.
function mix(hexA, hexB, t) {
  const a = hexA.match(/\w\w/g).map((h) => parseInt(h, 16))
  const b = hexB.match(/\w\w/g).map((h) => parseInt(h, 16))
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

let uidCounter = 0
function uid() {
  uidCounter += 1
  return `ec${uidCounter}`
}

// A soft radial glow def — used in place of feGaussianBlur throughout.
function glowGradientDef(id, color) {
  return `<radialGradient id="${id}" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${color}" stop-opacity="0.9"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></radialGradient>`
}

function tongue(cx, leanX, h, w) {
  const tipX = cx + leanX
  return `M${cx - w},150 C${cx - w - 4},${150 - h * 0.45} ${tipX - w * 0.3},${150 - h * 0.85} ${tipX},${150 - h} C${tipX + w * 0.3},${150 - h * 0.85} ${cx + w + 4},${150 - h * 0.45} ${cx + w},150 Z`
}

function fireIcon({ growth, vitality }) {
  const heat = 0.12 + vitality * 0.88
  const smoke = mix('#3a1a12', '#7a3a1a', heat)
  const outer = mix('#7a2a18', '#f5b34a', heat)
  const mid = mix('#a8481f', '#ffd94f', heat)
  const inner = mix('#c97a2a', heat > 0.75 ? '#eaf6ff' : '#fff2b0', Math.max(0, (heat - 0.4) / 0.6))
  const core = heat > 0.85 ? '#dff2ff' : inner
  const logColor = mix('#2a1812', '#4a2818', growth)
  const id = uid()
  const flameCount = growth < 0.2 ? 1 : growth < 0.55 ? 2 : growth < 0.85 ? 3 : 4
  const spread = 14 + growth * 20
  const baseH = 40 + growth * 90
  const positions = Array.from({ length: flameCount }, (_, i) => {
    const t = flameCount === 1 ? 0.5 : i / (flameCount - 1)
    return 50 + (t - 0.5) * spread * 2
  })
  let flames = ''
  positions.forEach((x, i) => {
    const hVar = baseH * (0.75 + ((i * 37) % 50) / 100)
    const w = 10 + growth * 7
    const lean = (i % 2 === 0 ? -1 : 1) * (4 + growth * 5)
    const cls = i % 2 === 0 ? 'flame-outer' : 'flame-inner'
    flames += `<g class="${cls}" style="transform-origin:${x}px 150px">
      <path d="${tongue(x, lean * 0.4, hVar * 0.65, w * 0.55)}" fill="${smoke}" opacity="0.5"/>
      <path d="${tongue(x, lean, hVar, w)}" fill="url(#${id}o)"/>
      <path d="${tongue(x, lean * 0.5, hVar * 0.6, w * 0.5)}" fill="url(#${id}m)" opacity="0.95"/>
    </g>`
  })
  const logCount = 2 + Math.round(growth * 2)
  let logs = ''
  for (let i = 0; i < logCount; i++) {
    const lx = 50 + (i - (logCount - 1) / 2) * 16
    logs += `<ellipse cx="${lx}" cy="150" rx="13" ry="6" fill="${logColor}"/><ellipse cx="${lx}" cy="148" rx="7" ry="2.4" fill="${outer}" opacity="${0.5 + heat * 0.4}"/>`
  }
  const emberCount = heat > 0.55 ? Math.round(2 + growth * 3) : 0
  let embers = ''
  for (let i = 0; i < emberCount; i++) {
    const ex = 50 + (i - emberCount / 2) * 9
    embers += `<circle class="ember" cx="${ex}" cy="${150 - baseH * 0.7}" r="2" fill="${core}" style="animation-delay:${(i * 0.5).toFixed(1)}s"/>`
  }
  const w = 60 + spread + growth * 30
  const h = 70 + baseH
  return `<svg viewBox="0 0 ${w + 40} 170" overflow="visible" style="width:100%;height:100%">
    <defs>
      <radialGradient id="${id}o" cx="50%" cy="82%" r="75%"><stop offset="0%" stop-color="${mid}"/><stop offset="100%" stop-color="${outer}"/></radialGradient>
      <radialGradient id="${id}m" cx="50%" cy="86%" r="68%"><stop offset="0%" stop-color="${core}"/><stop offset="100%" stop-color="${mid}"/></radialGradient>
      ${glowGradientDef(id + 'b', outer)}
    </defs>
    <g transform="translate(${(w + 40 - 100) / 2} ${170 - h - 10})">
      <ellipse cx="50" cy="140" rx="${44 + spread * 0.8}" ry="34" fill="url(#${id}b)" opacity="0.5"/>
      ${flames}${logs}${embers}
    </g>
  </svg>`
}

function moonPhasePath(R, p) {
  if (p <= 0.5) { const rx = R * (1 - 2 * p); return `M 0,${-R} A ${R},${R} 0 0 1 0,${R} A ${rx},${R} 0 0 0 0,${-R} Z` }
  const rx = R * (2 * p - 1); return `M 0,${-R} A ${R},${R} 0 0 1 0,${R} A ${rx},${R} 0 0 1 0,${-R} Z`
}
const CRATERS = [{ x: -10, y: -12, r: 3.2 }, { x: 6, y: -6, r: 2 }, { x: -3, y: 8, r: 4 }, { x: 12, y: 10, r: 2.4 }, { x: -14, y: 4, r: 1.6 }, { x: 4, y: -16, r: 1.8 }]
function moonIcon({ growth, vitality }) {
  const phase = 0.04 + growth * 0.93
  const glow = 0.12 + vitality * 0.68
  const tint = mix('#8a8fa0', '#f5d98a', vitality)
  const R = 30
  const path = moonPhasePath(R, phase)
  const id = uid()
  const craters = CRATERS.map((c) => `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="#000" opacity="0.08"/>`).join('')
  return `<svg viewBox="-40 -40 80 80" style="width:100%;height:100%">
    <defs>
      <radialGradient id="${id}glow" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="${tint}" stop-opacity="${glow}"/><stop offset="100%" stop-color="${tint}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id}sphere" cx="38%" cy="35%" r="75%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.5"/><stop offset="45%" stop-color="${tint}" stop-opacity="0"/><stop offset="100%" stop-color="#000000" stop-opacity="0.22"/></radialGradient>
      <clipPath id="${id}clip"><path d="${path}"/></clipPath>
    </defs>
    <circle r="34" fill="url(#${id}glow)"/>
    <circle r="${R}" fill="#232330" opacity="0.55"/>
    <path d="${path}" fill="${tint}"/>
    <g clip-path="url(#${id}clip)">${craters}<circle r="${R}" fill="url(#${id}sphere)"/></g>
  </svg>`
}

function warriorIcon({ growth, vitality }) {
  const id = uid()
  const steelDark = mix('#2a2822', '#4a4640', growth)
  const steelLight = mix('#5a564c', '#f2ecd8', growth)
  const edgeGlow = mix('#3a352c', '#fff8e0', vitality)
  const goldAcc = mix('#3a2e1a', '#d9b45a', Math.max(0, (growth - 0.5) / 0.5))
  const len = 26 + growth * 36
  const gw = 5 + growth * 2.2
  const glow = vitality > 0.55 ? `<ellipse cx="50" cy="${78 - len * 0.5}" rx="${gw + 6}" ry="${len * 0.55}" fill="url(#${id}g)" opacity="0.6"/>` : ''
  const orn = growth > 0.6 ? `<circle cx="50" cy="72" r="3" fill="${goldAcc}"/><path d="M44,80 L38,84 M56,80 L62,84" stroke="${goldAcc}" stroke-width="1.6" stroke-linecap="round"/>` : ''
  const sparks = vitality > 0.85 ? `<path d="M62,${78 - len * 0.6} L68,${74 - len * 0.6} M60,${74 - len * 0.7} L64,${68 - len * 0.7}" stroke="${edgeGlow}" stroke-width="1.4" stroke-linecap="round" opacity="0.85"/>` : ''
  return `<svg viewBox="0 0 100 100" style="width:100%;height:100%">
    <defs>
      <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${steelDark}"/><stop offset="45%" stop-color="${steelLight}"/><stop offset="100%" stop-color="${steelDark}"/></linearGradient>
      ${glowGradientDef(id + 'g', edgeGlow)}
    </defs>
    ${glow}
    <line x1="50" y1="${78 - len}" x2="50" y2="78" stroke="url(#${id}b)" stroke-width="${gw}" stroke-linecap="round"/>
    <line x1="50" y1="${78 - len}" x2="50" y2="78" stroke="${edgeGlow}" stroke-width="1" opacity="${0.4 + vitality * 0.5}"/>
    <line x1="37" y1="80" x2="63" y2="80" stroke="url(#${id}b)" stroke-width="4.5" stroke-linecap="round"/>
    <rect x="47" y="80" width="6" height="13" rx="1.5" fill="${mix('#3a2a1a', '#7a4a24', growth)}"/>
    ${orn}${sparks}
  </svg>`
}

function natureIcon({ growth, vitality }) {
  const id = uid()
  const canopyDeep = mix('#1e2a16', '#2f5a2a', vitality)
  const canopyLight = mix('#33421f', '#8fce62', vitality)
  const trunk = mix('#2a1e12', '#5a3d22', growth)
  const clusters = 3 + Math.round(growth * 6)
  let leaves = ''
  for (let i = 0; i < clusters; i++) {
    const ang = (i / clusters) * Math.PI * 2 + growth * 0.3
    const r = 8 + (i % 3) * 3.5
    const cx = 50 + Math.cos(ang) * r * (0.5 + growth * 0.7)
    const cy = 36 + Math.sin(ang) * r * (0.35 + growth * 0.55) - growth * 4
    leaves += `<circle cx="${cx}" cy="${cy}" r="${5 + growth * 4.5}" fill="url(#${id}leaf)" opacity="0.92" class="${i % 2 === 0 ? 'drift-y' : ''}"/>`
  }
  const dapple = vitality > 0.6 ? `<circle cx="44" cy="30" r="3" fill="#fff" opacity="0.18"/><circle cx="58" cy="38" r="2" fill="#fff" opacity="0.15"/>` : ''
  return `<svg viewBox="0 0 100 100" style="width:100%;height:100%">
    <defs><radialGradient id="${id}leaf" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="${canopyLight}"/><stop offset="100%" stop-color="${canopyDeep}"/></radialGradient></defs>
    <ellipse cx="50" cy="92" rx="${14 + growth * 8}" ry="3" fill="#000" opacity="0.2"/>
    <path d="M50,90 C49,72 51,58 50,${52 - growth * 6}" fill="none" stroke="${trunk}" stroke-width="4" stroke-linecap="round"/>
    ${leaves}${dapple}
  </svg>`
}

function robotIcon({ growth, vitality }) {
  const id = uid()
  const shellDark = mix('#252a2e', '#3f4a52', growth)
  const shellLight = mix('#3a4148', '#adc4d2', growth)
  const light = mix('#3a2a20', '#7fe0c0', vitality)
  const panels = growth > 0.35 ? `<rect x="34" y="42" width="10" height="18" rx="1.5" fill="${shellDark}" opacity="0.8"/><rect x="56" y="42" width="10" height="18" rx="1.5" fill="${shellDark}" opacity="0.8"/><line x1="39" y1="44" x2="39" y2="58" stroke="${shellLight}" stroke-width="0.6" opacity="0.5"/><line x1="61" y1="44" x2="61" y2="58" stroke="${shellLight}" stroke-width="0.6" opacity="0.5"/>` : ''
  const antenna = growth > 0.65 ? `<line x1="50" y1="28" x2="50" y2="17" stroke="url(#${id}s)" stroke-width="2"/><circle cx="50" cy="15" r="4.5" fill="url(#${id}g)"/><circle cx="50" cy="15" r="1.6" fill="${light}"/>` : ''
  const lightGlow = vitality > 0.3 ? `<circle cx="42" cy="48" r="${7 + vitality * 4}" fill="url(#${id}g)"/><circle cx="58" cy="48" r="${7 + vitality * 4}" fill="url(#${id}g)"/>` : ''
  return `<svg viewBox="0 0 100 100" style="width:100%;height:100%">
    <defs>
      <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${shellLight}"/><stop offset="100%" stop-color="${shellDark}"/></linearGradient>
      ${glowGradientDef(id + 'g', light)}
    </defs>
    <rect x="32" y="30" width="36" height="46" rx="7" fill="none" stroke="url(#${id}s)" stroke-width="2.8"/>
    <rect x="32" y="30" width="36" height="46" rx="7" fill="${shellDark}" opacity="0.12"/>
    ${panels}${lightGlow}
    <circle cx="42" cy="48" r="${2.2 + vitality * 1.6}" fill="${light}"/>
    <circle cx="58" cy="48" r="${2.2 + vitality * 1.6}" fill="${light}"/>
    <rect x="42" y="62" width="16" height="4" rx="2" fill="${light}" opacity="${0.4 + vitality * 0.5}"/>
    ${antenna}
  </svg>`
}

function animalIcon({ growth, vitality }) {
  const id = uid()
  const furDeep = mix('#3a2a1e', '#a85a28', growth)
  const furLight = mix('#5a4030', '#e8b366', growth)
  const eye = mix('#2a2a2a', '#fff2c0', vitality)
  const s = 0.6 + growth * 0.42
  const eyeGlow = vitality > 0.6 ? `<circle cx="44" cy="60" r="5" fill="url(#${id}g)"/><circle cx="56" cy="60" r="5" fill="url(#${id}g)"/>` : ''
  return `<svg viewBox="0 0 100 100" style="width:100%;height:100%">
    <defs>
      <radialGradient id="${id}f" cx="40%" cy="30%" r="75%"><stop offset="0%" stop-color="${furLight}"/><stop offset="100%" stop-color="${furDeep}"/></radialGradient>
      ${glowGradientDef(id + 'g', eye)}
    </defs>
    <ellipse cx="50" cy="94" rx="20" ry="3" fill="#000" opacity="0.18"/>
    <g transform="translate(50 58) scale(${s}) translate(-50 -58)">
      <path d="M70,64 Q88,58 85,76 Q78,72 70,68 Z" fill="url(#${id}f)"/>
      <ellipse cx="50" cy="63" rx="23" ry="17" fill="url(#${id}f)"/>
      <path d="M32,50 Q25,34 40,40 Z" fill="url(#${id}f)"/>
      <path d="M68,50 Q75,34 60,40 Z" fill="url(#${id}f)"/>
      <path d="M32,52 Q27,38 39,42 Z" fill="${furDeep}" opacity="0.5"/>
      <path d="M68,52 Q73,38 61,42 Z" fill="${furDeep}" opacity="0.5"/>
      ${eyeGlow}
      <circle cx="44" cy="60" r="2.2" fill="${eye}"/>
      <circle cx="56" cy="60" r="2.2" fill="${eye}"/>
      <path d="M47,68 Q50,71 53,68" stroke="${furDeep}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    </g>
  </svg>`
}

function plantIcon({ growth, vitality }) {
  const id = uid()
  const deep = mix('#243a1c', '#3f7a46', vitality)
  const light = mix('#3a5228', '#8fd68f', vitality)
  const petals = growth < 0.2 ? 1 : 6
  const len = 6 + growth * 15
  let p = ''
  for (let i = 0; i < petals; i++) p += `<ellipse cx="0" cy="${-len / 2}" rx="${3.5 + growth * 4.5}" ry="${len / 2}" fill="url(#${id}p)" opacity="0.95" transform="rotate(${(360 / petals) * i})"/>`
  const glow = vitality > 0.6 ? `<circle cx="50" cy="34" r="${22 + growth * 10}" fill="url(#${id}g)"/>` : ''
  return `<svg viewBox="0 0 100 100" style="width:100%;height:100%">
    <defs>
      <radialGradient id="${id}p" cx="50%" cy="20%" r="90%"><stop offset="0%" stop-color="${light}"/><stop offset="100%" stop-color="${deep}"/></radialGradient>
      ${glowGradientDef(id + 'g', light)}
    </defs>
    <ellipse cx="50" cy="92" rx="10" ry="2.4" fill="#000" opacity="0.16"/>
    <path d="M50,90 C49,70 51,55 50,42" fill="none" stroke="${deep}" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M50,72 Q40,68 36,74" fill="none" stroke="${deep}" stroke-width="2" stroke-linecap="round" opacity="${0.4 + growth * 0.5}"/>
    <path d="M50,64 Q60,60 64,66" fill="none" stroke="${deep}" stroke-width="2" stroke-linecap="round" opacity="${0.4 + growth * 0.5}"/>
    ${glow}
    <g transform="translate(50 34)">${p}<circle r="${2.8 + growth * 2.2}" fill="${light}"/></g>
  </svg>`
}

function dragonIcon({ growth, vitality }) {
  const id = uid()
  const scaleDeep = mix('#241a34', '#5a2e7a', vitality)
  const scaleLight = mix('#3a2a4a', '#c48fe8', vitality)
  const eye = mix('#3a2a4a', '#ffd94f', vitality)
  const wing = 10 + growth * 32
  const glow = vitality > 0.6 ? `<ellipse cx="50" cy="60" rx="${38 + wing * 0.6}" ry="34" fill="url(#${id}g)"/>` : ''
  return `<svg viewBox="0 0 100 100" style="width:100%;height:100%">
    <defs>
      <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${scaleLight}"/><stop offset="100%" stop-color="${scaleDeep}"/></linearGradient>
      ${glowGradientDef(id + 'g', scaleLight)}
    </defs>
    ${glow}
    <path d="M${50 - 10},55 Q${50 - 10 - wing},${45 - growth * 10} ${50 - 6},70" fill="none" stroke="url(#${id}s)" stroke-width="2.2" opacity="${0.55 + growth * 0.45}"/>
    <path d="M${50 + 10},55 Q${50 + 10 + wing},${45 - growth * 10} ${50 + 6},70" fill="none" stroke="url(#${id}s)" stroke-width="2.2" opacity="${0.55 + growth * 0.45}"/>
    <ellipse cx="50" cy="64" rx="15" ry="19" fill="none" stroke="url(#${id}s)" stroke-width="2.4"/>
    <path d="M42,58 Q50,54 58,58" stroke="${scaleDeep}" stroke-width="1.2" fill="none" opacity="0.6"/>
    <circle cx="50" cy="48" r="7.5" fill="none" stroke="url(#${id}s)" stroke-width="2.2"/>
    <circle cx="50" cy="48" r="1.8" fill="${eye}"/>
    <path d="M46,45 L48,42 M54,45 L52,42" stroke="url(#${id}s)" stroke-width="1.6" stroke-linecap="round"/>
    ${growth > 0.5 ? `<path d="M50,82 Q55,90 50,96" fill="none" stroke="url(#${id}s)" stroke-width="2" stroke-linecap="round"/>` : ''}
  </svg>`
}

function spiritIcon({ growth, vitality }) {
  const id = uid()
  const color = mix('#3a3a48', '#d8e2ff', vitality)
  const s = 0.65 + growth * 0.35
  const glow = vitality > 0.3 ? `<ellipse cx="50" cy="55" rx="${(24 + vitality * 16) * s}" ry="${(28 + vitality * 16) * s}" fill="url(#${id}g)"/>` : ''
  const sparkles = growth > 0.75 ? `<circle cx="34" cy="40" r="1.4" fill="${color}" opacity="0.8"/><circle cx="66" cy="50" r="1.2" fill="${color}" opacity="0.7"/><circle cx="58" cy="30" r="1" fill="${color}" opacity="0.6"/>` : ''
  return `<svg viewBox="0 0 100 100" style="width:100%;height:100%">
    <defs>
      <linearGradient id="${id}gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fff" stop-opacity="${0.3 + vitality * 0.4}"/><stop offset="100%" stop-color="${color}" stop-opacity="${0.15 + vitality * 0.5}"/></linearGradient>
      ${glowGradientDef(id + 'g', color)}
    </defs>
    ${glow}
    <g class="drift-y" transform="translate(50 58) scale(${s}) translate(-50 -58)">
      <path d="M50,28 C63,42 61,60 50,82 C39,60 37,42 50,28 Z" fill="none" stroke="${color}" stroke-width="1.8" opacity="${0.4 + vitality * 0.6}"/>
      <path d="M50,37 C58,46 57,58 50,72 C43,58 42,46 50,37 Z" fill="url(#${id}gr)"/>
    </g>
    ${sparkles}
  </svg>`
}

function athleteIcon({ growth, vitality }) {
  const id = uid()
  const color = mix('#4a4030', '#ffcf6b', vitality)
  const trailLen = 8 + growth * 42
  return `<svg viewBox="0 0 100 100" style="width:100%;height:100%">
    <defs>
      <linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${color}" stop-opacity="0"/><stop offset="100%" stop-color="${color}" stop-opacity="${0.5 + vitality * 0.4}"/></linearGradient>
      ${glowGradientDef(id + 'g', color)}
    </defs>
    <circle cx="62" cy="58" r="${9 + vitality * 5}" fill="url(#${id}g)"/>
    <line x1="${64 - trailLen}" y1="${60 + trailLen * 0.35}" x2="62" y2="58" stroke="url(#${id}t)" stroke-width="${3 + growth * 3}" stroke-linecap="round"/>
    <line x1="${58 - trailLen * 0.7}" y1="${55 + trailLen * 0.25}" x2="58" y2="54" stroke="url(#${id}t)" stroke-width="${1.6 + growth * 1.5}" stroke-linecap="round" opacity="0.8"/>
    <circle cx="62" cy="58" r="${3 + vitality * 2.6}" fill="${color}"/>
    <circle cx="62" cy="58" r="${1.2 + vitality}" fill="#fff" opacity="${0.5 + vitality * 0.4}"/>
  </svg>`
}

const ICONS = {
  fire: fireIcon,
  moon: moonIcon,
  warrior: warriorIcon,
  nature: natureIcon,
  robot: robotIcon,
  animal: animalIcon,
  plant: plantIcon,
  dragon: dragonIcon,
  spirit: spiritIcon,
  athlete: athleteIcon,
}

export default function ElementalCreature({ archetypeId, growth = 0.5, vitality = 0.7, muted = false, size = 96 }) {
  const render = ICONS[archetypeId] || ICONS.fire
  let svg
  try {
    svg = render({ growth: Math.min(1, Math.max(0, growth)), vitality: Math.min(1, Math.max(0, vitality)) })
  } catch {
    // Never let a single icon's generation take down the whole page.
    svg = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="currentColor" opacity="0.4"/></svg>`
  }
  return (
    <div style={{ width: size, height: size, opacity: muted ? 0.65 : 1, filter: muted ? 'saturate(0.6)' : 'none' }} dangerouslySetInnerHTML={{ __html: svg }} />
  )
}
