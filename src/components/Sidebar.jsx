import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import { MORE_SECTIONS } from '../data/moreMenu'
import './Sidebar.css'

// Same portal-to-body pattern as Sheet.jsx, for the same reason: a
// full-screen overlay rendered inline inside .page would size itself
// against .page's transformed containing block instead of the real
// viewport (see the CLAUDE.md note on Sheet.jsx). A slide-in drawer is
// exactly the kind of full-screen overlay that bug applies to.
export default function Sidebar({ open, onClose, onSelect }) {
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
        {MORE_SECTIONS.map((section, s) => (
          <div key={section.title} style={{ marginTop: s === 0 ? 0 : 32 }}>
            <div className="sidebar-section-title">{section.title}</div>
            {s > 0 && <div className="sidebar-divider" />}
            {section.items.map((item) => (
              <button
                key={item.id}
                className="sidebar-item"
                onClick={() => onSelect(item.id)}
              >
                <Icon name={item.icon} size={21} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>,
    document.body
  )
}
