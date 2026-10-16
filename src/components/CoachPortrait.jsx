import { coachImage } from '../utils/coachAvatar'
import { ORB_BACKGROUND } from './CoachAvatar'

// The coach, waist-up, standing in a softly glowing glass arch on deep
// purple — after the user's own reference image. state: 'idle' breathes
// slowly, 'speaking' glows in rhythm, 'listening' sends out a soft ring
// (motion.css .coach-arch). Falls back to the orb when no face is chosen.
export default function CoachPortrait({ avatar, width = 200, state = 'idle', onClick, label }) {
  const img = coachImage(avatar)
  const height = Math.round(width * 1.3)
  const Tag = onClick ? 'button' : 'div'

  if (!img) {
    return (
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        aria-label={label}
        className={`coach-orb${state === 'speaking' ? ' speaking' : state === 'listening' ? ' listening' : ''}`}
        style={{ width: width * 0.66, height: width * 0.66, borderRadius: '50%', border: 'none', padding: 0, cursor: onClick ? 'pointer' : 'default', background: ORB_BACKGROUND, boxShadow: '0 0 40px color-mix(in srgb, var(--accent) 55%, transparent)' }}
      />
    )
  }

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={label}
      className={`coach-arch${state === 'speaking' ? ' speaking' : state === 'listening' ? ' listening' : ''}`}
      style={{
        position: 'relative', width, height, padding: 0, border: 'none', cursor: onClick ? 'pointer' : 'default',
        borderRadius: `${width / 2}px ${width / 2}px 22px 22px`, overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 30%, color-mix(in srgb, var(--accent) 45%, #2a1f5c) 0%, #1c1640 70%)',
      }}
    >
      <img src={img.src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: img.pos }} />
      {/* glass: a light sheen and a thin bright rim, like the reference's arch */}
      <span
        aria-hidden
        style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
          background: 'linear-gradient(160deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 35%, transparent 60%)',
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.35), inset 0 -40px 60px -30px color-mix(in srgb, var(--accent) 50%, transparent)',
        }}
      />
    </Tag>
  )
}
