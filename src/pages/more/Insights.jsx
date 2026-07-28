import { useApp } from '../../context/AppContext'
import { computeInsights } from '../../utils/insights'
import BackHeader from '../../components/BackHeader'

export default function Insights({ onBack }) {
  const { data } = useApp()
  const insights = computeInsights(data)

  return (
    <div className="page">
      <BackHeader eyebrow="More" title="Insights" onBack={onBack} />
      <p className="muted text-sm" style={{ marginBottom: 18 }}>
        Patterns spotted in your own data — computed on your device, nothing sent anywhere.
      </p>
      {insights.length === 0 ? (
        <div className="empty-state">
          <div className="icon">✨</div>
          <p>Keep logging — insights show up once there's enough data to compare.</p>
        </div>
      ) : (
        <div>
          {insights.map((ins) => (
            <div key={ins.id} className={`insight-card tone-${ins.tone}`}>
              <span style={{ fontSize: 18 }}>{ins.icon}</span>
              <span className="text-sm" style={{ lineHeight: 1.5 }}>{ins.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
