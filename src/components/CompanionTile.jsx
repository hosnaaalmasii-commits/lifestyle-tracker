import { useApp } from '../context/AppContext'
import { computeCharacter } from '../utils/characterEngine'
import { ARCHETYPE_NAMES, CONDITION_NAMES } from '../i18n'
import { useT } from '../i18n/useT'
import { useContentT } from '../i18n/useContentT'
import ElementalCreature from './ElementalCreature'
import CharacterCard from './CharacterCard'
import Icon from './Icon'

// The companion, small, on the Vandaag page — tapping it opens its own
// page (More → companion) where it's shown large. Until a companion has
// been chosen this renders CharacterCard, which shows the onboarding
// picker.
export default function CompanionTile({ onOpen }) {
  const { data } = useApp()
  const { t, pickLang } = useT()
  const { stageName } = useContentT()
  if (!data.character?.archetype) return <CharacterCard />

  const { archetype, condition, stage, growth } = computeCharacter(data)
  const name = pickLang(ARCHETYPE_NAMES[archetype.id]) || archetype.name
  const conditionName = pickLang(CONDITION_NAMES[condition.key]) || condition.name

  return (
    <button
      className="card row"
      onClick={onOpen}
      style={{ width: '100%', padding: '12px 16px', gap: 14, justifyContent: 'flex-start', cursor: 'pointer', textAlign: 'left' }}
    >
      <span style={{ position: 'relative', width: 52, height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          aria-hidden
          style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: `radial-gradient(circle, color-mix(in srgb, ${archetype.color} 45%, transparent) 0%, transparent 70%)` }}
        />
        <ElementalCreature archetypeId={archetype.id} growth={growth} vitality={condition.vitality} muted={condition.muted} size={52} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 700 }}>{name}</span>
        <span className="faint" style={{ display: 'block', fontSize: 12 }}>{stageName(archetype.id, stage.stageIndex, stage.name)} · {conditionName}</span>
      </span>
      <span className="faint" aria-label={t('comp.tap')}><Icon name="chevronRight" size={16} /></span>
    </button>
  )
}
