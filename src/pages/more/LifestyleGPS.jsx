import { useApp } from '../../context/AppContext'
import { PHASES, getGPSStatus } from '../../utils/lifestyleGPS'
import BackHeader from '../../components/BackHeader'
import Icon from '../../components/Icon'

export default function LifestyleGPS({ onBack }) {
  const { data } = useApp()
  const { score, phaseIndex, current, next, progress } = getGPSStatus(data)

  return (
    <div className="page">
      <BackHeader eyebrow="More" title="Lifestyle GPS" onBack={onBack} />
      <p className="muted text-sm" style={{ marginBottom: 4 }}>
        A roadmap, not a race — your phase is based on your Consistency Score ({score}/100), which weighs the last 30 days.
      </p>

      {next && (
        <div className="card" style={{ marginTop: 16, marginBottom: 20 }}>
          <div className="row text-sm">
            <span className="muted">{current.label}</span>
            <span className="muted">{next.label}</span>
          </div>
          <div className="xp-bar-track" style={{ marginTop: 8 }}>
            <div className="xp-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="text-sm faint mono" style={{ marginTop: 6, textAlign: 'center' }}>
            {next.threshold - score > 0 ? `${next.threshold - score} points to ${next.label}` : `Ready for ${next.label}`}
          </div>
        </div>
      )}

      <div className="stack">
        {PHASES.map((phase, i) => {
          const state = i < phaseIndex ? 'past' : i === phaseIndex ? 'current' : 'locked'
          return (
            <div
              key={phase.id}
              className={`card${state === 'current' ? ' hero-card' : ''}`}
              style={{
                opacity: state === 'locked' ? 0.55 : 1,
                '--hero-tint': 'var(--accent)', '--hero-glow': 'var(--accent-gradient-end)',
              }}
            >
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <div className="row" style={{ gap: 12, justifyContent: 'flex-start', alignItems: 'flex-start' }}>
                  <span
                    style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: state === 'locked' ? 'var(--surface-soft)' : 'color-mix(in srgb, var(--accent) 14%, transparent)',
                      color: state === 'locked' ? 'var(--text-faint)' : 'var(--accent)',
                    }}
                  >
                    <Icon name={state === 'locked' ? 'lock' : phase.icon} size={20} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{phase.label}</div>
                    <p className="text-sm muted" style={{ marginTop: 4, lineHeight: 1.5, maxWidth: 260 }}>{phase.description}</p>
                  </div>
                </div>
                {state === 'current' && <span className="tag" style={{ background: 'var(--accent)', color: '#fff', whiteSpace: 'nowrap' }}>You are here</span>}
              </div>
              {state === 'locked' && (
                <div className="text-sm faint mono" style={{ marginTop: 8 }}>Unlocks at Consistency Score {phase.threshold}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
