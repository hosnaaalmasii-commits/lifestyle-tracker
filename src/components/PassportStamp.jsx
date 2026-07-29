import { useId } from 'react'

// A circular "ink stamp" with the badge name arced along the top — stands
// in for a flat badge tile, borrowing the passport-stamp motif for
// achievements already earned.
export default function PassportStamp({ label, color }) {
  const pathId = useId()
  return (
    <svg className="stamp" viewBox="0 0 100 100">
      <defs><path id={pathId} d="M50,10 a40,40 0 1,1 -0.1,0" /></defs>
      <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="50" cy="50" r="34" fill="none" stroke={color} strokeWidth="1" />
      <text fontFamily="ui-monospace, monospace" fontSize="6.5" fill={color} letterSpacing="1.5">
        <textPath href={`#${pathId}`} startOffset="2">• {label.toUpperCase()} •</textPath>
      </text>
      <path d="M32,50 44,62 68,36" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
