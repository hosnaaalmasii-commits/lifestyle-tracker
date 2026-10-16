import './TabBar.css'
import { useT } from '../i18n/useT'

// The Richting E tab bar: a small dot above a word — no icons. Six tabs
// since 2026-10-16 (Coach joined at the user's request). The active tab gets an accent dot and bright label.
// Progress photos live in the side menu (More → Voortgangsfoto's).
const TABS = [
  { id: 'overview', label: 'Vandaag' },
  { id: 'water', label: 'Water' },
  { id: 'sleep', label: 'Slaap' },
  { id: 'workouts', label: 'Training' },
  { id: 'voeding', label: 'Voeding' },
  { id: 'coach', label: 'Coach' },
]

export default function TabBar({ active, onChange }) {
  const { t } = useT()
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
              aria-label={t(`tab.${tab.id}`)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="tab-dot" aria-hidden />
              <span className="tab-label">{t(`tab.${tab.id}`)}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
