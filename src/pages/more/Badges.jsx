import { useEffect, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { computeBadges } from '../../utils/badges'
import { computeXP } from '../../utils/gamification'
import { getWeeklyChallenge } from '../../utils/challenges'
import { drawWeeklySummaryCard, shareOrDownloadCanvas } from '../../utils/shareCard'
import BackHeader from '../../components/BackHeader'
import LevelBar from '../../components/LevelBar'
import ChallengeCard from '../../components/ChallengeCard'
import Confetti from '../../components/Confetti'
import Icon from '../../components/Icon'

const SEEN_BADGES_KEY = 'lifestyle-tracker-seen-badges'

export default function Badges({ onBack }) {
  const { data } = useApp()
  const badges = computeBadges(data)
  const unlockedCount = badges.filter((b) => b.unlocked).length
  const xp = computeXP(data, unlockedCount)
  const challenge = getWeeklyChallenge(data)
  const [sharing, setSharing] = useState(false)
  const [confettiTick, setConfettiTick] = useState(0)

  useEffect(() => {
    const unlockedIds = badges.filter((b) => b.unlocked).map((b) => b.id)
    let seen = []
    try { seen = JSON.parse(localStorage.getItem(SEEN_BADGES_KEY) || '[]') } catch { /* ignore */ }
    const newlyUnlocked = unlockedIds.filter((id) => !seen.includes(id))
    if (newlyUnlocked.length > 0 && seen.length > 0) setConfettiTick((n) => n + 1)
    if (newlyUnlocked.length > 0 || seen.length !== unlockedIds.length) {
      localStorage.setItem(SEEN_BADGES_KEY, JSON.stringify(unlockedIds))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedCount])

  const handleShare = async () => {
    setSharing(true)
    try {
      const canvas = drawWeeklySummaryCard(data, xp)
      await shareOrDownloadCanvas(canvas, 'my-week.png')
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="page">
      <Confetti trigger={confettiTick} />
      <BackHeader eyebrow="More" title="Badges & Level" onBack={onBack} />

      <div className="card">
        <LevelBar xp={xp} />
        <button className="btn btn-secondary btn-block" style={{ marginTop: 16, gap: 8 }} disabled={sharing} onClick={handleShare}>
          <Icon name="share" size={16} />
          {sharing ? 'Preparing…' : 'Share my week'}
        </button>
      </div>

      <div className="section-title">This week's challenge</div>
      <ChallengeCard challenge={challenge} />

      <div className="section-title">Badges</div>
      <p className="muted text-sm" style={{ marginBottom: 14 }}>
        {unlockedCount} of {badges.length} unlocked — these fill in automatically as you build habits.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {badges.map((b) => (
          <div
            key={b.id}
            className="card"
            style={{
              textAlign: 'center', padding: '20px 12px',
              opacity: b.unlocked ? 1 : 0.5,
            }}
          >
            <div
              style={{
                width: 44, height: 44, margin: '0 auto', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: b.unlocked ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--surface-soft)',
                color: b.unlocked ? 'var(--accent)' : 'var(--text-faint)',
              }}
            >
              <Icon name={b.unlocked ? b.icon : 'lock'} size={22} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 13, marginTop: 8 }}>{b.name}</div>
            <div className="text-sm faint" style={{ marginTop: 4, lineHeight: 1.3 }}>{b.description}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
