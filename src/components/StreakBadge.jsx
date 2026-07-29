import Icon from './Icon'

export default function StreakBadge({ days, label = 'day streak' }) {
  if (!days) {
    return <span className="text-sm faint">No streak yet</span>
  }
  return (
    <span className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
      <span aria-hidden style={{ color: 'var(--accent-workout)' }}><Icon name="flame" size={14} /></span>
      <span className="mono">{days}</span>
      <span className="muted" style={{ fontWeight: 500 }}>{label}</span>
    </span>
  )
}
