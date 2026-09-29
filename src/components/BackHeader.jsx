import { useT } from '../i18n/useT'

export default function BackHeader({ eyebrow, title, onBack, action }) {
  const { t } = useT()
  return (
    <div className="page-header">
      <button
        onClick={onBack}
        className="btn-ghost"
        style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0 10px', color: 'var(--text-soft)', fontSize: 14, fontWeight: 600 }}
      >
        <span aria-hidden>‹</span> {t('common.back')}
      </button>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
        </div>
        {action}
      </div>
    </div>
  )
}
