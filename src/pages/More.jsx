import Weight from './more/Weight'
import Mood from './more/Mood'
import Nutrition from './more/Nutrition'
import Badges from './more/Badges'
import Insights from './more/Insights'
import Coach from './more/Coach'
import HabitContracts from './more/HabitContracts'
import LifestyleGPS from './more/LifestyleGPS'
import Settings from './more/Settings'
import Cycle from './more/Cycle'
import Budget from './more/Budget'
import Schedule from './more/Schedule'
import Icon from '../components/Icon'

const ITEMS = [
  { id: 'coach', label: 'Coach', desc: 'AI chat grounded in your data', icon: 'sparkle' },
  { id: 'gps', label: 'Lifestyle GPS', desc: 'Your phased roadmap', icon: 'compass' },
  { id: 'contracts', label: 'Habit Contracts', desc: 'If-then agreements with yourself', icon: 'handshake' },
  { id: 'weight', label: 'Weight', desc: 'Trend over time', icon: 'scale' },
  { id: 'mood', label: 'Mood', desc: 'Scale & notes', icon: 'faceGood' },
  { id: 'nutrition', label: 'Nutrition', desc: 'Daily checklist', icon: 'apple' },
  { id: 'cycle', label: 'Cycle', desc: 'Flow & symptoms', icon: 'droplet' },
  { id: 'schedule', label: 'Schedule', desc: 'Upcoming items', icon: 'calendar' },
  { id: 'budget', label: 'Budget', desc: 'Expenses & spending', icon: 'scale' },
  { id: 'insights', label: 'Insights', desc: 'Patterns in your data', icon: 'trendUp' },
  { id: 'badges', label: 'Badges & Level', desc: 'Achievements, XP, challenges', icon: 'trophy' },
  { id: 'settings', label: 'Settings', desc: 'Colors, theme, data', icon: 'gear' },
]

export default function More({ view, setView }) {
  if (view === 'weight') return <Weight onBack={() => setView(null)} />
  if (view === 'mood') return <Mood onBack={() => setView(null)} />
  if (view === 'nutrition') return <Nutrition onBack={() => setView(null)} />
  if (view === 'cycle') return <Cycle onBack={() => setView(null)} />
  if (view === 'budget') return <Budget onBack={() => setView(null)} />
  if (view === 'schedule') return <Schedule onBack={() => setView(null)} />
  if (view === 'insights') return <Insights onBack={() => setView(null)} />
  if (view === 'coach') return <Coach onBack={() => setView(null)} setView={setView} />
  if (view === 'contracts') return <HabitContracts onBack={() => setView(null)} />
  if (view === 'gps') return <LifestyleGPS onBack={() => setView(null)} />
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
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--accent) 12%, var(--surface-soft))',
                  color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon name={item.icon} size={19} />
                </span>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.label}</div>
                  <div className="text-sm faint">{item.desc}</div>
                </div>
              </div>
              <span className="faint" aria-hidden><Icon name="chevronRight" size={16} /></span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
