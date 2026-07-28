import { useApp } from '../../context/AppContext'
import { computeBadges } from '../../utils/badges'
import BackHeader from '../../components/BackHeader'

export default function Badges({ onBack }) {
  const { data } = useApp()
  const badges = computeBadges(data)
  const unlockedCount = badges.filter((b) => b.unlocked).length

  return (
    <div className="page">
      <BackHeader eyebrow="More" title="Badges" onBack={onBack} />
      <p className="muted text-sm" style={{ marginBottom: 18 }}>
        {unlockedCount} of {badges.length} unlocked — these fill in automatically as you build habits.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {badges.map((b) => (
          <div
            key={b.id}
            className="card"
            style={{
              textAlign: 'center', padding: '20px 12px',
              opacity: b.unlocked ? 1 : 0.5,
            }}
          >
            <div style={{ fontSize: 30, filter: b.unlocked ? 'none' : 'grayscale(1)' }}>{b.unlocked ? b.icon : '🔒'}</div>
            <div style={{ fontWeight: 600, fontSize: 13, marginTop: 8 }}>{b.name}</div>
            <div className="text-sm faint" style={{ marginTop: 4, lineHeight: 1.3 }}>{b.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
