import Icon from './Icon'
import { useT } from '../i18n/useT'

export default function StreakBadge({ days, label }) {
  const { t } = useT()
  if (!days) {
    return <span className="text-sm faint">{t('streak.none')}</span>
  }
  return (
    <span className="text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
      <span aria-hidden style={{ color: 'var(--accent-workout)' }}><Icon name="flame" size={14} /></span>
      <span className="mono">{days}</span>
      <span className="muted" style={{ fontWeight: 500 }}>{label || t('streak.days')}</span>
    </span>
  )
}
