import './TabBar.css'

const ICONS = {
  overview: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} />
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity={active ? 1 : 0.6} />
    </svg>
  ),
  water: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3.5c3 3.6 6.5 8 6.5 11.4a6.5 6.5 0 1 1-13 0c0-3.4 3.5-7.8 6.5-11.4Z"
        stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.18 : 0}
        strokeLinejoin="round"
      />
    </svg>
  ),
  sleep: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"
        stroke="currentColor" strokeWidth={active ? 2.2 : 1.8}
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.18 : 0}
        strokeLinejoin="round"
      />
    </svg>
  ),
  workouts: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M6.5 8v8M17.5 8v8M3.5 10.5v3M20.5 10.5v3M6.5 12h11"
        stroke="currentColor" strokeWidth={active ? 2.4 : 1.8} strokeLinecap="round" />
    </svg>
  ),
  progress: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="6" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} />
      <circle cx="12" cy="12.5" r="3.4" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} />
      <path d="M8.5 6l1-2h5l1 2" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  more: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="5.5" cy="12" r="1.7" fill="currentColor" opacity={active ? 1 : 0.75} />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" opacity={active ? 1 : 0.75} />
      <circle cx="18.5" cy="12" r="1.7" fill="currentColor" opacity={active ? 1 : 0.75} />
    </svg>
  ),
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'water', label: 'Water' },
  { id: 'sleep', label: 'Sleep' },
  { id: 'workouts', label: 'Workouts' },
  { id: 'progress', label: 'Progress' },
  { id: 'more', label: 'More' },
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
            >
              <span className="tab-icon">{ICONS[tab.id](isActive)}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
