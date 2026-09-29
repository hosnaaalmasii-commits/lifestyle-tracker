import Icon from './Icon'
import { tx } from '../i18n/tx'

export default function ComebackScreen({ gapDays, onContinue, onGoToWorkout }) {
  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', textAlign: 'center' }}>
      <div style={{ marginBottom: 18, color: 'var(--accent)' }}><Icon name="heart" size={40} /></div>
      <h1 style={{ fontSize: 26, marginBottom: 10 }}>{tx("Welcome back")}</h1>
      <p className="muted" style={{ maxWidth: 320, lineHeight: 1.6, marginBottom: 4 }}>
        {tx("It's been")} {gapDays} {tx("days — and nothing was lost. You're picking up exactly where you are today, not where you left off.")}
      </p>
      <p className="muted text-sm" style={{ maxWidth: 300, lineHeight: 1.6, marginTop: 12, marginBottom: 32 }}>
        {tx("Today's workout is already set to the Survival tier — 4 to 7 minutes, nothing more required.")}
      </p>
      <button className="btn btn-primary btn-block" style={{ maxWidth: 280 }} onClick={onGoToWorkout}>
        {tx("Start today, gently")}
      </button>
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={onContinue}>
        {tx("Skip for now")}
      </button>
    </div>
  )
}
