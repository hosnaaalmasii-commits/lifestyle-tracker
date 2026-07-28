export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,18,10,0.45)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24,
      }}
      onClick={onCancel}
    >
      <div
        className="card"
        style={{ maxWidth: 340, width: '100%', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: 18, marginBottom: 8 }}>{title}</h3>
        <p className="muted text-sm" style={{ marginBottom: 20, lineHeight: 1.5 }}>{message}</p>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            style={{ flex: 1, border: danger ? '1px solid var(--danger)' : 'none', background: danger ? 'var(--danger)' : undefined, color: danger ? '#fff' : undefined }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
