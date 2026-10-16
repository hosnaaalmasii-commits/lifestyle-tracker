import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import { MORE_SECTIONS } from '../data/moreMenu'
import './Sidebar.css'
import { useT } from '../i18n/useT'
import { useApp } from '../context/AppContext'
import { tx } from '../i18n/tx'

// Same portal-to-body pattern as Sheet.jsx, for the same reason: a
// full-screen overlay rendered inline inside .page would size itself
// against .page's transformed containing block instead of the real
// viewport (see the CLAUDE.md note on Sheet.jsx). A slide-in drawer is
// exactly the kind of full-screen overlay that bug applies to.
export default function Sidebar({ open, onClose, onSelect }) {
  const { t } = useT()
  const { sync } = useApp()
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="sidebar-overlay" onClick={onClose}>
      <div className="sidebar-panel" onClick={(e) => e.stopPropagation()}>
        <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
          <Icon name="close" size={20} />
        </button>
        {/* Without signing in nothing is saved online — say so where it's seen. */}
        {!sync.signedIn && (
          <button type="button" className="card" onClick={() => onSelect('settings')} style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 24, cursor: 'pointer', color: 'var(--text)', border: '1px solid color-mix(in srgb, var(--warning) 55%, transparent)' }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{tx("Niet ingelogd")}</div>
            <div className="text-sm muted" style={{ marginTop: 2 }}>{tx("Je gegevens en instellingen staan nu alleen op dit toestel. Log in bij Cloud Sync om alles online te bewaren en op al je toestellen te hebben.")}</div>
            <div className="text-sm" style={{ marginTop: 6, color: 'var(--accent)', fontWeight: 700 }}>{tx("Inloggen")} ›</div>
          </button>
        )}
        {MORE_SECTIONS.map((section, s) => (
          <div key={section.title} style={{ marginTop: s === 0 ? 0 : 32 }}>
            <div className="sidebar-section-title">{t(`menuSection.${s}`)}</div>
            {s > 0 && <div className="sidebar-divider" />}
            {section.items.map((item) => (
              <button
                key={item.id}
                className="sidebar-item"
                onClick={() => onSelect(item.id)}
              >
                <Icon name={item.icon} size={21} />
                <span>{t(`menu.${item.id}`)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>,
    document.body
  )
}
