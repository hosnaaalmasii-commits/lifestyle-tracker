import WalletRail from '../components/WalletRail'
import FlightDial from '../components/FlightDial'
import WeeklyManifest from '../components/WeeklyManifest'
import BoardingPass from '../components/BoardingPass'
import PassportStamp from '../components/PassportStamp'
import CharacterCard from '../components/CharacterCard'
import CharacterErrorBoundary from '../components/CharacterErrorBoundary'
import { humanDateFull } from '../utils/dates'

const STAMP_COLORS = ['var(--fintech-grad-from)', 'var(--fintech-accent)', 'var(--fintech-grad-to)']

export default function OverviewTerminal({
  today, score, xp, levelInfo,
  wallet, dialRings, weekDays,
  workoutPass, stampBadges, streakTile, badgeTotals,
  onNavigate,
}) {
  return (
    <div className="terminal">
      <div className="terminal-radar" />
      <div className="terminal-topbar">
        <div>
          <div className="eyebrow"><span className="terminal-dot">●</span> TERMINAL 1 · {humanDateFull(today).toUpperCase()}</div>
          <h1 className="headline">Today</h1>
        </div>
      </div>

      <WalletRail cards={wallet} />

      <div className="flight-dial-section">
        <FlightDial rings={dialRings} score={score} label="Day Score" />
        <div className="dial-legend">
          {dialRings.map((r) => (
            <div className="dial-legend-item" key={r.key}>
              <span className="dial-swatch" style={{ background: r.color }} />
              <span className="dial-legend-label">{r.label}</span>
              <span className="dial-legend-value mono">{Math.round(r.ratio * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="section-title" style={{ margin: '20px 0 8px' }}>This week's manifest</div>
      <WeeklyManifest days={weekDays} />

      <div className="section-title" style={{ margin: '20px 0 8px' }}>Today's session</div>
      <BoardingPass {...workoutPass} onClick={() => onNavigate('workouts')} />

      <div className="section-title" style={{ margin: '20px 0 8px' }}>Passport stamps</div>
      {stampBadges.length > 0 ? (
        <div className="stamps-panel">
          {stampBadges.map((b, i) => (
            <PassportStamp key={b.id} label={b.name} color={STAMP_COLORS[i % STAMP_COLORS.length]} />
          ))}
        </div>
      ) : (
        <div className="stamps-panel stamps-empty">
          <p className="text-sm faint">No stamps yet — keep going.</p>
        </div>
      )}

      <div className="section-title" style={{ margin: '20px 0 8px' }}>Progress</div>
      <div className="bento">
        <CharacterErrorBoundary>
          <CharacterCard variant="bento" />
        </CharacterErrorBoundary>
        <button className="tile tile-xp" onClick={() => onNavigate('more', 'badges')} style={{ textAlign: 'left', cursor: 'pointer' }}>
          <div className="stat-label">Experience</div>
          <div className="stat-number tile-num">{xp.toLocaleString()} XP</div>
          <div className="xp-track"><div className="xp-fill" style={{ width: `${Math.round(levelInfo.ratio * 100)}%` }} /></div>
        </button>
        <div className="tile tile-streak">
          <div className="stat-label">Streak</div>
          <div className="stat-number tile-num" style={{ color: 'var(--success)' }}>{streakTile}</div>
        </div>
        <button className="tile tile-badges" onClick={() => onNavigate('more', 'badges')} style={{ textAlign: 'left', cursor: 'pointer' }}>
          <div className="stat-label">Badges</div>
          <div className="stat-number tile-num">{badgeTotals}</div>
        </button>
      </div>
    </div>
  )
}
