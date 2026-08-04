import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import './Sheet.css'

export default function Sheet({ open, onClose, title, children }) {
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

  // Rendered via a portal straight to <body> — position: fixed only sizes
  // against the true viewport if nothing between it and the root has a
  // transform/filter/perspective. .page's entrance animation ends on
  // transform: translateY(0), which (despite being an identity transform)
  // still makes it a containing block per spec, sizing any fixed-position
  // descendant against the full page content height instead of the
  // screen. A portal sidesteps that regardless of what else the app ever
  // does with transforms, rather than depending on no ancestor ever using one.
  return createPortal(
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {title && <h3 className="sheet-title">{title}</h3>}
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}
