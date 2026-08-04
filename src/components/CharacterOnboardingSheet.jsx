import { useState } from 'react'
import { ARCHETYPES } from '../utils/characterEngine'
import ElementalCreature from './ElementalCreature'
import Sheet from './Sheet'

export default function CharacterOnboardingSheet({ open, onChoose }) {
  const [archetype, setArchetype] = useState(null)
  const selected = ARCHETYPES.find((a) => a.id === archetype)

  return (
    <Sheet open={open} onClose={() => {}} title="Choose your companion">
      <p className="text-sm muted" style={{ marginTop: -4, marginBottom: 16 }}>
        Each one is its own real phenomenon — it grows with good habits and fades without them, same
        as the real thing.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
        {ARCHETYPES.map((a) => {
          const on = archetype === a.id
          return (
            <button
              key={a.id}
              onClick={() => setArchetype(a.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                padding: '10px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                border: `1px solid ${on ? a.color : 'var(--border)'}`,
                background: on ? `color-mix(in srgb, ${a.color} 14%, var(--surface-soft))` : 'var(--surface-soft)',
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <ElementalCreature archetypeId={a.id} growth={0.6} vitality={0.75} size={40} />
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.2 }}>{a.name}</span>
            </button>
          )
        })}
      </div>

      {selected && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <ElementalCreature archetypeId={selected.id} growth={0.6} vitality={0.85} size={72} />
          <div>
            <div style={{ fontWeight: 700, fontFamily: 'var(--font-heading)' }}>{selected.name}</div>
            <div className="text-sm faint" style={{ marginTop: 2 }}>{selected.tagline}</div>
          </div>
        </div>
      )}

      <button
        className="btn btn-primary btn-block"
        disabled={!archetype}
        onClick={() => onChoose(archetype)}
      >
        Begin
      </button>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={() => onChoose('fire')}>
        Skip — pick for me
      </button>
    </Sheet>
  )
}
