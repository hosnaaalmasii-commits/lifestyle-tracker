import './TabBar.css'

// Same five tabs and look as the Richting E design: a small dot above a
// word — no icons. The active tab gets an accent dot and bright label.
// Progress photos live in the side menu (More → Voortgangsfoto's).
const TABS = [
  { id: 'overview', label: 'Vandaag' },
  { id: 'water', label: 'Water' },
  { id: 'sleep', label: 'Slaap' },
  { id: 'workouts', label: 'Training' },
  { id: 'voeding', label: 'Voeding' },
]

export default function TabBar({ active, onChange }) {
  return (
    <nav className="tabbar">
      <div className="tabbar-inner">
        {TABS.map((tab) => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              className={`tab-btn${isActive ? ' active' : ''}`}
              onClick={() => onChange(tab.id)}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="tab-dot" aria-hidden />
              <span className="tab-label">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
