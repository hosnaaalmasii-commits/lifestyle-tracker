// A single cohesive line-icon set replacing emoji throughout the app —
// consistent stroke weight, consistent geometry vocabulary, so the whole
// app reads as one designed system instead of relying on OS emoji glyphs
// (which render inconsistently across platforms and skew informal).

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const ICONS = {
  droplet: <path {...stroke} d="M12 3.5c3 3.6 6.5 8 6.5 11.4a6.5 6.5 0 1 1-13 0c0-3.4 3.5-7.8 6.5-11.4Z" />,
  moon: <path {...stroke} d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />,
  flame: (
    <path {...stroke} d="M12 21.5c-4 0-6.5-2.7-6.5-6.2 0-3.3 2.2-5.3 3.4-7.6.6 2.1 1.8 2.8 1.8 2.8-.4-3 .9-6 3.3-8 .3 3 1.6 4.6 2.8 6.6 1 1.7 1.7 3.4 1.7 6.2 0 3.5-2.5 6.2-6.5 6.2Z" />
  ),
  dumbbell: (
    <g {...stroke}>
      <path d="M3.5 9.5v5M6 8v8M18 8v8M20.5 9.5v5" />
      <path d="M6 12h12" strokeWidth={3.2} />
    </g>
  ),
  trophy: (
    <g {...stroke}>
      <path d="M7 4h10v6a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4.5a2 2 0 0 0 0 4H7M17 6h2.5a2 2 0 0 1 0 4H17" />
      <path d="M12 15v3M9 21h6M9.5 18h5l.5 3H9l.5-3Z" />
    </g>
  ),
  crown: (
    <g {...stroke}>
      <path d="M4 18h16M5 18l-1.5-9L9 12l3-6 3 6 5.5-3L19 18" />
    </g>
  ),
  medal: (
    <g {...stroke}>
      <circle cx="12" cy="15" r="5.5" />
      <path d="M12 12v6M9.5 13.5l5 3M14.5 13.5l-5 3" />
      <path d="M9 3 6.5 9.5M15 3l2.5 6.5" />
    </g>
  ),
  shield: <path {...stroke} d="M12 3.5 19 6v6c0 4.5-3 7.7-7 8.5-4-.8-7-4-7-8.5V6l7-2.5Z" />,
  mountain: (
    <g {...stroke}>
      <path d="M3 19 9.5 8l3.5 5.5L15.5 10 21 19H3Z" />
      <path d="M8.2 15.5 9.5 13.4l1.9 3" />
    </g>
  ),
  star: <path {...stroke} d="m12 3.5 2.4 5.2 5.6.6-4.2 3.9 1.2 5.6L12 15.9l-5 2.9 1.2-5.6-4.2-3.9 5.6-.6L12 3.5Z" />,
  gem: <path {...stroke} d="M7 4h10l3.5 5L12 20.5 3.5 9 7 4Z M3.5 9h17M9 4l-2 5 5 11.5M15 4l2 5-5 11.5" />,
  camera: (
    <g {...stroke}>
      <path d="M3.5 8h4l1.5-2.2h6L16.5 8h4a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.6" />
    </g>
  ),
  images: (
    <g {...stroke}>
      <rect x="3.5" y="3.5" width="13" height="13" rx="2" />
      <path d="m3.5 13 3.3-3.3a1.5 1.5 0 0 1 2.1 0l4.6 4.6" />
      <path d="M8 16.5h8.5a1 1 0 0 0 1-1V8" strokeDasharray="0" />
      <circle cx="8" cy="7.5" r="1.3" />
      <path d="M20.5 6.5v11a1 1 0 0 1-1 1H8" />
    </g>
  ),
  share: (
    <g {...stroke}>
      <path d="M12 15V4M8.5 7.5 12 4l3.5 3.5" />
      <path d="M5.5 12v6.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V12" />
    </g>
  ),
  compass: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m14.8 9.2-1.6 4.4-4.4 1.6 1.6-4.4 4.4-1.6Z" />
    </g>
  ),
  leaf: <path {...stroke} d="M6 19c-1.5-5.5 1-11.5 12-13-1 10-6.5 13.5-12 13ZM6.5 18.5 15 10" />,
  handshake: (
    <g {...stroke}>
      <path d="M2.5 11.5 6 8l4 3-1.7 1.7a1.2 1.2 0 0 0 1.7 1.7L13.5 11l4 3.2" />
      <path d="M9.7 13.7 12 16a1.2 1.2 0 0 0 1.7-1.7M12 16.3a1.2 1.2 0 0 0 1.7 1.6l.8-.8" />
      <path d="M6 8 3 10.5v4L6.5 17M18 8l3 2.5v4L17.5 17" />
      <path d="M14 8l2-1.7-2.3-2.3L11 6.5" />
    </g>
  ),
  heart: <path {...stroke} d="M12 20s-7.5-4.6-9.5-9.4C1.2 7.4 3 4.5 6.2 4.2c2-.2 3.6.9 5.8 3 2.2-2.1 3.8-3.2 5.8-3 3.2.3 5 3.2 3.7 6.4C19.5 15.4 12 20 12 20Z" />,
  sparkle: (
    <g {...stroke}>
      <path d="M12 3.5c.6 3 2 4.4 5 5-3 .6-4.4 2-5 5-.6-3-2-4.4-5-5 3-.6 4.4-2 5-5Z" />
      <path d="M18.5 15c.35 1.6 1.05 2.3 2.65 2.65-1.6.35-2.3 1.05-2.65 2.65-.35-1.6-1.05-2.3-2.65-2.65 1.6-.35 2.3-1.05 2.65-2.65Z" />
    </g>
  ),
  search: (
    <g {...stroke}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m19.5 19.5-4.3-4.3" />
    </g>
  ),
  trendUp: (
    <g {...stroke}>
      <path d="M3.5 16.5 9.5 10l4 4 6.5-7.5" />
      <path d="M15.5 6h4.5v4.5" />
    </g>
  ),
  trendDown: (
    <g {...stroke}>
      <path d="M3.5 7.5 9.5 14l4-4 6.5 7.5" />
      <path d="M15.5 18h4.5v-4.5" />
    </g>
  ),
  scale: (
    <g {...stroke}>
      <rect x="3.5" y="5.5" width="17" height="14" rx="3" />
      <circle cx="12" cy="12.5" r="3.4" />
      <path d="M12 12.5 14.2 10.6" />
    </g>
  ),
  gear: (
    <g {...stroke}>
      <path d="M4.5 6.5h9.5M18 6.5h1.5M4.5 12h3.5M12 12h7.5M4.5 17.5h11M19.5 17.5h0" />
      <circle cx="16" cy="6.5" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="17.5" r="2" />
    </g>
  ),
  calendar: (
    <g {...stroke}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
    </g>
  ),
  alertTriangle: (
    <g {...stroke}>
      <path d="M12 4 21.5 20h-19L12 4Z" />
      <path d="M12 10v4.2" />
      <circle cx="12" cy="17" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth="1.6" />
    </g>
  ),
  lock: (
    <g {...stroke}>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </g>
  ),
  check: <path {...stroke} d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  chevronRight: <path {...stroke} d="M9 5.5 16 12l-7 6.5" />,
  repeat: (
    <g {...stroke}>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.7-5.4L19.5 8" />
      <path d="M19.5 4v4.5H15" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.7 5.4L4.5 16" />
      <path d="M4.5 20v-4.5H9" />
    </g>
  ),
  timer: (
    <g {...stroke}>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4.3l3 2M10 2.5h4" />
    </g>
  ),
  trash: (
    <g {...stroke}>
      <path d="M5 7h14M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2" />
      <path d="M6.5 7 7.3 19a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7" />
      <path d="M10.2 11v6M13.8 11v6" />
    </g>
  ),
  chat: <path {...stroke} d="M4 5.5h16v10.5H9.5L5 20v-4H4V5.5Z" />,
  sun: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M17.7 17.7l-1.4-1.4M7.7 7.7 6.3 6.3" />
    </g>
  ),
  sandwich: (
    <g {...stroke}>
      <path d="M3.5 11h17l-1.5 7.5h-14L3.5 11Z" />
      <path d="M4.5 11c.5-4 3-6.5 7.5-6.5s7 2.5 7.5 6.5" />
      <path d="M3.5 11h17" />
    </g>
  ),
  utensils: (
    <g {...stroke}>
      <path d="M6.5 3.5v7a2 2 0 0 0 4 0v-7M8.5 3.5v17M4.5 3.5v5" />
      <path d="M16.5 3.5c-1.5 0-2.5 2-2.5 5s1 4.5 2.5 4.5v7.5" />
    </g>
  ),
  carrot: (
    <g {...stroke}>
      <path d="M20 4c-3 0-5.5 1-7 2.5C10 9.5 4 15.5 4 15.5a2.6 2.6 0 0 0 3.7 3.7S13.5 13 16.5 10c1.5-1.5 2.5-4 3.5-6Z" />
      <path d="M13.5 7 17 10.5M17.5 4l1 3M20 5.5l-3 1" />
    </g>
  ),
  apple: (
    <g {...stroke}>
      <path d="M12 8.5c-2.4-2-6-1-6.8 2.2-.8 3.4 1.3 8.3 4.3 8.3.9 0 1.4-.5 2.5-.5s1.6.5 2.5.5c3 0 5.5-5.3 4.3-8.6-1-2.8-4.2-3.6-6.3-1.8Z" />
      <path d="M12 8.2c-.3-1.8.5-3.2 2.3-4" />
    </g>
  ),
  faceRough: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 10.3h1.8M13.7 10.3h1.8M8.5 15.5c1.3-1.3 5.7-1.3 7 0" />
    </g>
  ),
  faceLow: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 10.5h1.8M13.7 10.5h1.8M8.7 15.3c1.2-.7 5.4-.7 6.6 0" />
    </g>
  ),
  faceOkay: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 10.5h1.8M13.7 10.5h1.8M8.7 14.8h6.6" />
    </g>
  ),
  faceGood: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 10.5h1.8M13.7 10.5h1.8M8.7 14c1.2 1.1 5.4 1.1 6.6 0" />
    </g>
  ),
  faceGreat: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 10.7q.8-1 1.8 0M13.9 10.7q.8-1 1.8 0M7.7 13.5c1 1.8 7.6 1.8 8.6 0" />
    </g>
  ),
  moodStressed: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M7.5 9.5 10 11l-2.5 1.5M16.5 9.5 14 11l2.5 1.5M8.5 16c1.2-1.3 5.8-1.3 7 0" />
    </g>
  ),
  moodTired: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8 10.5q1.2-1 2.4 0M13.6 10.5q1.2-1 2.4 0M9 15.3h6" />
    </g>
  ),
  moodAngry: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M7.8 9.8 10.3 11M16.2 9.8 13.7 11M8.5 16c1.2-1.6 5.8-1.6 7 0" />
    </g>
  ),
  moodSad: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 10.3h1.8M13.7 10.3h1.8M8.7 16.3c1.2-1.1 5.4-1.1 6.6 0" />
      <path d="M9.3 12.3v2.2" />
    </g>
  ),
  moodLazy: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 11h2M13.7 11h2M9 15h6" />
      <path d="M15.5 6.5h2.2M16.8 5.3v2.4" opacity="0.001" />
    </g>
  ),
  moodUnmotivated: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 11h1.8M13.7 11h1.8M8.7 14.7h6.6" />
    </g>
  ),
  moodInsecure: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 10.8h1.8M13.7 10.8h1.8" />
      <path d="M9.5 15.3q2.5-1.5 5 0" />
    </g>
  ),
  moodEnergetic: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.3 10.6q.9-1.1 1.8 0M13.9 10.6q.9-1.1 1.8 0M8.2 14c1.4 1.6 6.2 1.6 7.6 0" />
    </g>
  ),
}

export default function Icon({ name, size = 18, className, style, title }) {
  const inner = ICONS[name]
  if (!inner) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {inner}
    </svg>
  )
}
