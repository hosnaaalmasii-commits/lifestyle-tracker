import { getMascotTier } from '../utils/mascotTiers'

// The evolving companion — a featured gradient hero card, same visual
// weight as the main stat hero card. The "avatar" is a placeholder abstract
// orb (core + orbiting rays that grow with tier) built purely from SVG, so
// it can be swapped for real character art later without touching the tier
// logic or layout.
export default function MascotCard({ xp, onClick }) {
  const tier = getMascotTier(xp)
  const size = 92
  const cx = size / 2
  const cy = size / 2
  const coreR = 15 * tier.core

  const rays = Array.from({ length: tier.rays }, (_, i) => {
    const angle = (i / tier.rays) * Math.PI * 2 - Math.PI / 2
    const dist = coreR + 14
    const x = cx + Math.cos(angle) * dist
    const y = cy + Math.sin(angle) * dist
    const r = 2.4 + (i % 2) * 1.2
    return { x, y, r, key: i }
  })

  return (
    <button className="card hero-card mascot-card" onClick={onClick} style={{ textAlign: 'left', cursor: onClick ? 'pointer' : 'default', width: '100%' }}>
      <div className="row" style={{ alignItems: 'center', gap: 16 }}>
        <div className="mascot-orb-wrap" style={{ width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {rays.map((r) => (
              <circle key={r.key} cx={r.x} cy={r.y} r={r.r} fill="#fff" opacity={0.85} />
            ))}
            <circle cx={cx} cy={cy} r={coreR + 6} fill="#fff" opacity={0.16} />
            <circle cx={cx} cy={cy} r={coreR} fill="#fff" opacity={0.95} />
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="stat-label" style={{ color: 'rgba(255,255,255,0.75)' }}>Your companion</div>
          <div className="stat-number" style={{ fontSize: 26, color: '#fff' }}>{tier.name}</div>
          <div className="text-sm" style={{ color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
            Level {tier.level}{tier.next ? ` · ${tier.levelsToNext} to evolve` : ' · Max form'}
          </div>
        </div>
      </div>
    </button>
  )
}
