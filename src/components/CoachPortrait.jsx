import { coachImage } from '../utils/coachAvatar'
import { ORB_BACKGROUND } from './CoachAvatar'

// How a photo fills a round window: centred on the face, zoomed so head
// and shoulders fill the circle (zoom 1 = the whole waist-up photo).
export function roundPhotoStyle(img, zoom = 1.45) {
  const [fx, fy] = img.face
  return {
    position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
    objectPosition: `${fx}% ${fy}%`,
    transform: `scale(${zoom})`, transformOrigin: `${fx}% ${Math.max(0, fy - 4)}%`,
  }
}

// The coach in a round, softly glowing glass window (round at the user's
// request, 2026-10-16 — it used to be a tall arch). state: 'idle' breathes
// slowly, 'speaking' glows in rhythm, 'listening' sends out a soft ring
// (motion.css .coach-arch). Falls back to the orb when no face is chosen.
export default function CoachPortrait({ avatar, width = 200, state = 'idle', onClick, label }) {
  const img = coachImage(avatar)
  const Tag = onClick ? 'button' : 'div'
  const stateClass = state === 'speaking' ? ' speaking' : state === 'listening' ? ' listening' : ''

  if (!img) {
    return (
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        aria-label={label}
        className={`coach-orb${stateClass}`}
        style={{ width: width * 0.66, height: width * 0.66, borderRadius: '50%', border: 'none', padding: 0, cursor: onClick ? 'pointer' : 'default', background: ORB_BACKGROUND, boxShadow: '0 0 40px color-mix(in srgb, var(--accent) 55%, transparent)' }}
      />
    )
  }

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={label}
      className={`coach-arch${stateClass}`}
      style={{
        position: 'relative', width, height: width, padding: 0, border: 'none', cursor: onClick ? 'pointer' : 'default',
        borderRadius: '50%', overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--accent) 45%, #2a1f5c) 0%, #1c1640 70%)',
      }}
    >
      <img src={img.src} alt="" style={roundPhotoStyle(img)} />
      {/* glass: a light sheen and a thin bright rim */}
      <span
        aria-hidden
        style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
          background: 'linear-gradient(160deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 35%, transparent 60%)',
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.35), inset 0 -30px 50px -24px color-mix(in srgb, var(--accent) 50%, transparent)',
        }}
      />
    </Tag>
  )
}
