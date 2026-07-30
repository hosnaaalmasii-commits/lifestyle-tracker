// Hand-drawn line creature for the Companion State feature — one blob
// outline, five faces/postures. Matches Icon.jsx's stroke weight (1.7-ish
// scaled up) and currentColor convention so it can be recolored per state
// via CSS custom properties without touching the markup.
const BLOB = 'M50,20 C75,15 100,30 105,55 C110,80 100,105 75,115 C55,122 30,115 20,95 C10,75 12,45 30,30 C36,25 43,22 50,20 Z'

const FACES = {
  energized: (
    <g transform="rotate(-4 60 62)">
      <path d={BLOB} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round" />
      <path d="M44,58 Q48,50 52,58" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M68,58 Q72,50 76,58" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M46,76 Q60,92 74,76" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M18,30 L24,38 M28,18 L30,28 M96,32 L90,40" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </g>
  ),
  balanced: (
    <g>
      <path d={BLOB} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round" />
      <circle cx="48" cy="58" r="3.4" fill="currentColor" />
      <circle cx="72" cy="58" r="3.4" fill="currentColor" />
      <path d="M48,80 Q60,88 72,80" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
    </g>
  ),
  tired: (
    <g transform="translate(0 4) rotate(3 60 62)">
      <path d={BLOB} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round" />
      <path d="M43,58 L53,60" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M67,60 L77,58" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M50,82 L70,82" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M84,28 L90,22 M90,34 L97,30 M92,42 L99,40" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.75" />
    </g>
  ),
  dehydrated: (
    <g transform="translate(60 62) scale(1.05 0.9) translate(-60 -62)">
      <path d={BLOB} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round" />
      <path d="M40,52 L52,55" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="72" cy="58" r="3" fill="currentColor" />
      <path d="M50,82 Q60,78 70,82" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M60,96 C65,101 65,107 60,111 C55,107 55,101 60,96 Z" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <path d="M60,101 L58,105" stroke="currentColor" strokeWidth="1.6" opacity="0.7" />
    </g>
  ),
  recovering: (
    <g transform="translate(0 -2) rotate(-1 60 62)">
      <path d={BLOB} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="round" />
      <circle cx="48" cy="58" r="3.2" fill="currentColor" />
      <path d="M68,60 Q72,54 76,60" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M49,79 Q60,86 71,80" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M92,80 L92,66 M92,66 L87,71 M92,66 L97,71" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
}

export default function CompanionCreature({ state, size = 84 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" style={{ color: `var(--state-${state})` }}>
      {FACES[state] || FACES.balanced}
    </svg>
  )
}
