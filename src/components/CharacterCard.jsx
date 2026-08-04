import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { computeXP } from '../utils/gamification'
import { computeBadges } from '../utils/badges'
import { computeCharacter } from '../utils/characterEngine'
import ElementalCreature from './ElementalCreature'
import CharacterOnboardingSheet from './CharacterOnboardingSheet'
import Sheet from './Sheet'

const TIER_COLOR = {
  special: 'var(--text-soft)',
  damage: 'var(--danger)',
  caution: 'var(--warning)',
  positive: 'var(--success)',
}

export default function CharacterCard({ variant = 'hero' }) {
  const { data, chooseCharacter, changeArchetype } = useApp()
  const [open, setOpen] = useState(false)
  const [changing, setChanging] = useState(false)

  if (!data.character?.archetype) {
    const badges = computeBadges(data)
    const startingXp = computeXP(data, badges.filter((b) => b.unlocked).length)
    return (
      <CharacterOnboardingSheet
        open
        onChoose={(archetype) => chooseCharacter(archetype, startingXp)}
      />
    )
  }

  const character = computeCharacter(data)
  const { archetype, condition, stage, growth } = character

  const creatureProps = {
    archetypeId: archetype.id,
    growth,
    vitality: condition.vitality,
    muted: condition.muted,
  }

  const trigger = variant === 'bento' ? (
    <button className="tile tile-companion-state" onClick={() => setOpen(true)} style={{ cursor: 'pointer' }}>
      <div style={{ flexShrink: 0 }}>
        <ElementalCreature {...creatureProps} size={48} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="stat-label">{archetype.name} · {stage.name}</div>
        <div className="stat-number tile-num" style={{ fontSize: 18, marginTop: 2 }}>{condition.name}</div>
      </div>
    </button>
  ) : (
    <button className="card" onClick={() => setOpen(true)} style={{ textAlign: 'left', cursor: 'pointer', width: '100%', padding: '20px 18px' }}>
      <div className="row" style={{ alignItems: 'center', gap: 16 }}>
        <div style={{ flexShrink: 0 }}>
          <ElementalCreature {...creatureProps} size={64} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="text-sm muted">{archetype.name} · {stage.name}</div>
          <div style={{ fontWeight: 700, fontSize: 19, fontFamily: 'var(--font-heading)' }}>{condition.name}</div>
          <div className="text-sm faint" style={{ marginTop: 2 }}>{condition.headline}</div>
        </div>
      </div>
    </button>
  )

  return (
    <>
      {trigger}
      <Sheet open={open} onClose={() => setOpen(false)} title={`${archetype.name} — ${condition.name}`}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <ElementalCreature {...creatureProps} size={130} />
        </div>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 16, textAlign: 'center' }}>{condition.headline}</p>
        <p className="text-sm muted" style={{ margin: '0 0 4px', textAlign: 'center' }}>
          <span style={{ color: TIER_COLOR[condition.tier] }}>{condition.name}</span>
        </p>
        <p className="text-sm faint" style={{ margin: '0 0 20px', textAlign: 'center' }}>
          {stage.name}{stage.next ? ` · ${Math.round(stage.progress * 100)}% to ${stage.next}` : ' · fully grown'} · {character.weeklyFeedPoints} feed points this week
        </p>

        <div className="stack" style={{ gap: 10, marginBottom: 18 }}>
          {condition.drivers.map((d) => (
            <div key={d.key} className="row" style={{ fontSize: 13.5, gap: 10 }}>
              <span className="muted" style={{ width: 84, flexShrink: 0 }}>{d.label}</span>
              <span className="xp-bar-track" style={{ flex: 1 }}>
                <span className="xp-bar-fill" style={{ width: `${Math.round(d.ratio * 100)}%`, background: archetype.color }} />
              </span>
              <span className="mono text-sm faint" style={{ width: 100, textAlign: 'right', flexShrink: 0 }}>{d.valueLabel}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
          <div className="text-sm faint" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11, marginBottom: 4 }}>Next</div>
          <p style={{ margin: 0, fontSize: 14 }}>{condition.nextAction}</p>
        </div>

        <button
          className="btn btn-ghost btn-block"
          style={{ marginTop: 16 }}
          onClick={() => { setOpen(false); setChanging(true) }}
        >
          Change companion
        </button>
      </Sheet>

      <CharacterOnboardingSheet
        open={changing}
        current={archetype.id}
        onClose={() => setChanging(false)}
        onChoose={(newArchetype) => { changeArchetype(newArchetype); setChanging(false) }}
      />
    </>
  )
}
