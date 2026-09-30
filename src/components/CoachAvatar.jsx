import { coachImage } from '../utils/coachAvatar'

export const ORB_BACKGROUND = 'radial-gradient(circle at 40% 38%, #ffffff 0%, color-mix(in srgb, var(--accent) 55%, #ffffff) 30%, var(--accent) 62%, color-mix(in srgb, var(--accent) 60%, #000000) 100%)'

// Small round version of the coach's face (header, lists): zoomed in on
// the face of the waist-up portrait. The big version is CoachPortrait.jsx.
export default function CoachAvatar({ avatar, size = 48, style }) {
  const img = coachImage(avatar)
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'block', overflow: 'hidden', position: 'relative',
        background: img ? 'var(--surface)' : ORB_BACKGROUND,
        boxShadow: `0 0 ${Math.round(size / 2)}px color-mix(in srgb, var(--accent) 45%, transparent)`,
        border: img ? '2px solid color-mix(in srgb, var(--accent) 55%, transparent)' : 'none',
        ...style,
      }}
    >
      {img && (
        <img
          src={img.src}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            objectPosition: `${img.face[0]}% ${img.face[1]}%`,
            transform: 'scale(2.1)', transformOrigin: `${img.face[0]}% ${img.face[1]}%`,
          }}
        />
      )}
    </span>
  )
}
