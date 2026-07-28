import Weight from './more/Weight'
import Mood from './more/Mood'
import Nutrition from './more/Nutrition'
import Badges from './more/Badges'
import Insights from './more/Insights'
import Coach from './more/Coach'
import Settings from './more/Settings'

const ITEMS = [
  { id: 'coach', label: 'Coach', desc: 'AI chat grounded in your data', icon: '✨' },
  { id: 'weight', label: 'Weight', desc: 'Trend over time', icon: '⚖️' },
  { id: 'mood', label: 'Mood', desc: 'Emoji scale & notes', icon: '🙂' },
  { id: 'nutrition', label: 'Nutrition', desc: 'Daily checklist', icon: '🥗' },
  { id: 'insights', label: 'Insights', desc: 'Patterns in your data', icon: '📈' },
  { id: 'badges', label: 'Badges & Level', desc: 'Achievements, XP, challenges', icon: '🏅' },
  { id: 'settings', label: 'Settings', desc: 'Colors, theme, data', icon: '⚙️' },
]

export default function More({ view, setView }) {
  if (view === 'weight') return <Weight onBack={() => setView(null)} />
  if (view === 'mood') return <Mood onBack={() => setView(null)} />
  if (view === 'nutrition') return <Nutrition onBack={() => setView(null)} />
  if (view === 'insights') return <Insights onBack={() => setView(null)} />
  if (view === 'coach') return <Coach onBack={() => setView(null)} setView={setView} />
  if (view === 'badges') return <Badges onBack={() => setView(null)} />
  if (view === 'settings') return <Settings onBack={() => setView(null)} />

  return (
    <div className="page">
      <div className="page-header">
        <div className="eyebrow">More</div>
        <h1>Everything else</h1>
      </div>
      <div className="stack">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            className="card"
            style={{ textAlign: 'left', cursor: 'pointer' }}
            onClick={() => setView(item.id)}
          >
            <div className="row">
              <div className="row" style={{ gap: 14, justifyContent: 'flex-start' }}>
                <span style={{
                  width: 40, height: 40, borderRadius: '50%', background: 'var(--surface-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                }}>
                  {item.icon}
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.label}</div>
                  <div className="text-sm faint">{item.desc}</div>
                </div>
              </div>
              <span className="faint" aria-hidden>›</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
