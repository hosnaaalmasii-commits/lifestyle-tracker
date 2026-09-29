import { levelProgress, levelTitle } from '../utils/gamification'
import { tx } from '../i18n/tx'

export default function LevelBar({ xp, compact }) {
  const { level, ratio, xpIntoLevel, xpForNext } = levelProgress(xp)
  return (
    <div style={{ width: '100%' }}>
      <div className="row" style={{ marginBottom: 6 }}>
        <span className="text-sm" style={{ fontWeight: 700 }}>
          {tx("Level")} {level} <span className="muted" style={{ fontWeight: 500 }}>· {levelTitle(level)}</span>
        </span>
        {!compact && <span className="mono text-sm faint">{xpIntoLevel} / {xpForNext} {tx("XP")}</span>}
      </div>
      <div className="xp-bar-track">
        <div className="xp-bar-fill" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
    </div>
  )
}
