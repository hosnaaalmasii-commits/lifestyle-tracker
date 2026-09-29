import { useApp } from '../../context/AppContext'
import { computeInsights } from '../../utils/insights'
import BackHeader from '../../components/BackHeader'
import Icon from '../../components/Icon'
import { tx } from '../../i18n/tx'

export default function Insights({ onBack }) {
  const { data } = useApp()
  const insights = computeInsights(data)

  return (
    <div className="page">
      <BackHeader eyebrow={tx("More")} title={tx("Insights")} onBack={onBack} />
      <p className="muted text-sm" style={{ marginBottom: 18 }}>
        {tx("Patterns spotted in your own data — computed on your device, nothing sent anywhere.")}
      </p>
      {insights.length === 0 ? (
        <div className="empty-state">
          <div className="icon"><Icon name="sparkle" size={26} /></div>
          <p>{tx("Keep logging — insights show up once there's enough data to compare.")}</p>
        </div>
      ) : (
        <div>
          {insights.map((ins) => (
            <div key={ins.id} className={`insight-card tone-${ins.tone}`}>
              <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }}><Icon name={ins.icon} size={16} /></span>
              <span className="text-sm" style={{ lineHeight: 1.5 }}>{tx(ins.text)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
