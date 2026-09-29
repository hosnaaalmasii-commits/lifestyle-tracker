import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey } from '../../utils/dates'
import { computeCharacter, STAGES } from '../../utils/characterEngine'
import { getTasksForDate, getMealsForDate } from '../../utils/taskSchedule'
import ElementalCreature from '../../components/ElementalCreature'
import CharacterOnboardingSheet from '../../components/CharacterOnboardingSheet'
import { useT } from '../../i18n/useT'
import { useContentT } from '../../i18n/useContentT'
import { ARCHETYPE_NAMES, CONDITION_NAMES } from '../../i18n'

// "Je figuurtje" — the companion's own page, after the Richting E Figma
// mockup: the creature large and centred in its own glow, stage/vitality
// pills, progress to the next stage, and what feeds it today.
export default function Companion() {
  const { data, changeArchetype } = useApp()
  const { t, pickLang, locale } = useT()
  const { stageName } = useContentT()
  const [changing, setChanging] = useState(false)

  if (!data.character?.archetype) {
    return (
      <div className="page">
        <p className="muted">{t('comp.chooseFirst')}</p>
      </div>
    )
  }

  const today = todayKey()
  const character = computeCharacter(data)
  const { archetype, condition, stage, growth } = character
  const name = pickLang(ARCHETYPE_NAMES[archetype.id]) || archetype.name
  const liters = (ml) => (ml / 1000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const hUnit = t('unit.h')
  const nextMin = STAGES[stage.stageIndex + 1]?.min
  const pointsLeft = nextMin != null ? Math.max(0, Math.ceil(nextMin - character.totalFeedPoints)) : 0

  const water = data.water[today] || 0
  const sleep = data.sleep[today]
  const tasks = getTasksForDate(data.taskSchedule, today, data.dayOverrides)
  const training = tasks.find((t) => t.category === 'training')
  const trainingDone = training ? !!data.taskCompletions[today]?.[training.id] : false
  const plannedMeals = Object.keys(getMealsForDate(data.mealRotation, today, data.dayOverrides)?.meals || {}).length
  const eatenMeals = data.meals.filter((m) => m.date === today).length

  const feeds = [
    { label: t('stat.water'), value: `${liters(water)} / ${liters(data.settings.waterGoalMl)} L`, done: water >= data.settings.waterGoalMl },
    { label: t('tr.title'), value: training ? (trainingDone ? t('comp.done') : t('comp.planned', { t: training.time })) : t('ov.restDay'), done: !training || trainingDone },
    { label: t('stat.sleep'), value: sleep ? `${Math.floor(sleep.hours)}${hUnit} ${String(Math.round((sleep.hours % 1) * 60)).padStart(2, '0')}${sleep.hours >= data.settings.sleepGoalHours ? ' ✓' : ''}` : t('comp.notLogged'), done: !!sleep && sleep.hours >= data.settings.sleepGoalHours },
    { label: t('comp.food'), value: plannedMeals ? t('comp.meals', { a: Math.min(eatenMeals, plannedMeals), b: plannedMeals }) : t('comp.logged', { n: eatenMeals }), done: plannedMeals > 0 && eatenMeals >= plannedMeals },
  ]

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="faint" style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', marginTop: 8 }}>{t('comp.eyebrow')}</div>
      <h1 style={{ fontSize: 30, marginTop: 2 }}>{name}</h1>

      <div style={{ position: 'relative', width: 260, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0 4px' }}>
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: `radial-gradient(circle, color-mix(in srgb, ${archetype.color} 55%, transparent) 0%, color-mix(in srgb, var(--accent) 22%, transparent) 45%, transparent 72%)`,
          }}
        />
        <ElementalCreature archetypeId={archetype.id} growth={growth} vitality={condition.vitality} muted={condition.muted} size={190} />
      </div>

      <div className="row" style={{ gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <span className="chip" style={{ padding: '5px 12px', fontSize: 12, cursor: 'default' }}>{t('comp.phase', { n: stage.stageIndex + 1, total: STAGES.length, stage: stageName(archetype.id, stage.stageIndex, stage.name) })}</span>
        <span className="chip" style={{ padding: '5px 12px', fontSize: 12, cursor: 'default' }}>{t('comp.vitality', { x: pickLang(CONDITION_NAMES[condition.key]) || condition.name })}</span>
      </div>

      <div style={{ width: '100%', marginTop: 14 }}>
        <div className="xp-bar-track" style={{ height: 8 }}>
          <div className="xp-bar-fill" style={{ width: `${Math.round(stage.progress * 100)}%`, background: 'linear-gradient(90deg, var(--accent), var(--second))', boxShadow: 'none' }} />
        </div>
        <p className="text-sm faint" style={{ textAlign: 'center', marginTop: 8 }}>
          {stage.next ? t('comp.pointsLeft', { n: pointsLeft, next: stageName(archetype.id, stage.stageIndex + 1, stage.next) }) : t('comp.fullyGrown')}
        </p>
      </div>

      <div className="card" style={{ width: '100%', marginTop: 14, padding: '16px 16px 6px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{t('comp.feeds', { name })}</div>
        {feeds.map((f) => (
          <div key={f.label} className="row" style={{ gap: 12, padding: '10px 0', justifyContent: 'flex-start' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: f.done ? 'var(--second)' : 'color-mix(in srgb, var(--text) 25%, transparent)' }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{f.label}</span>
            <span className="text-sm" style={{ color: f.done ? 'var(--second)' : 'var(--text-faint)' }}>{f.value}</span>
          </div>
        ))}
      </div>

      <button className="btn btn-ghost btn-sm" style={{ marginTop: 16 }} onClick={() => setChanging(true)}>{t('comp.change')}</button>

      <CharacterOnboardingSheet
        open={changing}
        current={archetype.id}
        onClose={() => setChanging(false)}
        onChoose={(id) => { changeArchetype(id); setChanging(false) }}
      />
    </div>
  )
}
