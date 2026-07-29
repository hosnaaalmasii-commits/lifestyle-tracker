import Icon from './Icon'

export default function ChallengeCard({ challenge }) {
  const ratio = challenge.target ? challenge.progress / challenge.target : 0
  return (
    <div className="card" style={{ borderColor: challenge.complete ? 'color-mix(in srgb, var(--success) 40%, var(--border-soft))' : undefined }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 10, justifyContent: 'flex-start' }}>
          <span style={{ color: 'var(--accent)' }}><Icon name={challenge.icon} size={20} /></span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{challenge.title}</div>
            <div className="text-sm faint">{challenge.description}</div>
          </div>
        </div>
        {challenge.complete && <span style={{ color: 'var(--success)' }}><Icon name="check" size={18} /></span>}
      </div>
      <div className="xp-bar-track" style={{ marginTop: 12 }}>
        <div
          className="xp-bar-fill"
          style={{ width: `${Math.round(ratio * 100)}%`, background: challenge.complete ? 'var(--success)' : 'var(--accent-fill)' }}
        />
      </div>
      <div className="text-sm faint mono" style={{ marginTop: 6, textAlign: 'right' }}>{challenge.progress}/{challenge.target}</div>
    </div>
  )
}
