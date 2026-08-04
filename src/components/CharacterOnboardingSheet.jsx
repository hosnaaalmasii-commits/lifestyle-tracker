import { useState } from 'react'
import { ARCHETYPES } from '../utils/characterEngine'
import ElementalCreature from './ElementalCreature'
import Sheet from './Sheet'

// Doubles as both the forced first-time picker (no onClose — Skip is the
// only way through) and the later "change companion" picker (closable,
// no Skip, since backing out just means keeping the current one).
export default function CharacterOnboardingSheet({ open, onChoose, onClose, current }) {
  const [archetype, setArchetype] = useState(current || null)
  const selected = ARCHETYPES.find((a) => a.id === archetype)
  const canCancel = !!onClose

  return (
    <Sheet open={open} onClose={onClose || (() => {})} title={canCancel ? 'Change your companion' : 'Choose your companion'}>
      <p className="text-sm muted" style={{ marginTop: -4, marginBottom: 12 }}>
        Each one is its own real phenomenon — it grows with good habits and fades without them.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 10 }}>
        {ARCHETYPES.map((a) => {
          const on = archetype === a.id
          return (
            <button
              key={a.id}
              onClick={() => setArchetype(a.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                padding: '6px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: `1px solid ${on ? a.color : 'var(--border)'}`,
                background: on ? `color-mix(in srgb, ${a.color} 14%, var(--surface-soft))` : 'var(--surface-soft)',
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <ElementalCreature archetypeId={a.id} growth={0.6} vitality={0.75} size={28} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{a.name}</span>
            </button>
          )
        })}
      </div>

      <p className="text-sm faint" style={{ minHeight: 18, margin: '0 0 12px' }}>
        {selected ? selected.tagline : 'Pick one to see what it does.'}
      </p>

      <button
        className="btn btn-primary btn-block"
        disabled={!archetype || archetype === current}
        onClick={() => onChoose(archetype)}
      >
        {canCancel ? 'Switch' : 'Begin'}
      </button>
      {canCancel ? (
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={onClose}>
          Cancel
        </button>
      ) : (
        <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => onChoose('fire')}>
          Skip — pick for me
        </button>
      )}
    </Sheet>
  )
}
