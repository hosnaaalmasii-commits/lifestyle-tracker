import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey, currentWeekKeys, humanDate, weekdayShort, addDaysToKey, diffDays } from '../../utils/dates'
import { getTasksForDate, computeDayScore, dayMeetsThreshold } from '../../utils/taskSchedule'
import { streakFromDateSet, longestStreakFromDateSet } from '../../utils/streaks'
import BackHeader from '../../components/BackHeader'
import Sheet from '../../components/Sheet'
import ConfirmDialog from '../../components/ConfirmDialog'
import Ring from '../../components/Ring'

const CALORIE_REVIEW_DAYS = 28 // "elke 4 weken" from the transformatieplan spec

function scoreForDay(taskSchedule, taskCompletions, dateKey) {
  const tasks = getTasksForDate(taskSchedule, dateKey)
  if (!tasks.length) return null
  return computeDayScore(tasks, taskCompletions[dateKey])
}

// Builds the set of days (within `lookbackDays`) that clear the streak
// threshold, for both the current-streak and longest-streak calculations —
// same bounded-lookback reasoning as TodayTasks' computeTaskStreak.
function daysMeetingThreshold(taskSchedule, taskCompletions, thresholdPct, lookbackDays) {
  const dateSet = new Set()
  let key = todayKey()
  for (let i = 0; i < lookbackDays; i++) {
    if (dayMeetsThreshold(taskSchedule, taskCompletions, key, thresholdPct)) dateSet.add(key)
    key = addDaysToKey(key, -1)
  }
  return dateSet
}

function emptyMeasurementForm() {
  return { waist: '', hips: '', chest: '', thigh: '', arm: '' }
}

const MEASUREMENT_FIELDS = [
  { key: 'waist', label: 'Taille (cm)' },
  { key: 'hips', label: 'Heupen (cm)' },
  { key: 'chest', label: 'Borst (cm)' },
  { key: 'thigh', label: 'Dij (cm)' },
  { key: 'arm', label: 'Arm (cm)' },
]

export default function WeeklyProgress({ onBack }) {
  const { data, addMeasurement, deleteMeasurement, setCalorieTargets } = useApp()
  const [measurementOpen, setMeasurementOpen] = useState(false)
  const [form, setForm] = useState(emptyMeasurementForm())
  const [toDelete, setToDelete] = useState(null)
  const [calorieOpen, setCalorieOpen] = useState(false)
  const [calorieForm, setCalorieForm] = useState(() => ({
    rest_day_kcal: data.settings.calorieTargets?.rest_day_kcal || [1350, 1400],
    training_day_kcal: data.settings.calorieTargets?.training_day_kcal || [1500, 1550],
    protein_g: data.settings.calorieTargets?.protein_g || [115, 125],
  }))

  const today = todayKey()
  const weekDays = currentWeekKeys(today)
  const weekScores = weekDays.map((d) => ({ date: d, score: scoreForDay(data.taskSchedule, data.taskCompletions, d) }))
  const loggedWeekScores = weekScores.filter((d) => d.score != null)
  const weekAvg = loggedWeekScores.length
    ? Math.round(loggedWeekScores.reduce((sum, d) => sum + d.score, 0) / loggedWeekScores.length)
    : null

  const monthKeys = Array.from({ length: 30 }, (_, i) => addDaysToKey(today, -i))
  const monthScores = monthKeys.map((d) => scoreForDay(data.taskSchedule, data.taskCompletions, d)).filter((s) => s != null)
  const monthAvg = monthScores.length ? Math.round(monthScores.reduce((a, b) => a + b, 0) / monthScores.length) : null
  const threshold = data.settings.streakThresholdPct
  const monthDaysAboveThreshold = monthScores.filter((s) => s >= threshold).length

  const thresholdSet = daysMeetingThreshold(data.taskSchedule, data.taskCompletions, threshold, 365)
  const currentStreak = streakFromDateSet(thresholdSet)
  const longestStreak = longestStreakFromDateSet(thresholdSet)

  const measurements = [...data.measurements].sort((a, b) => b.date.localeCompare(a.date))
  const latestWeight = data.weight[data.weight.length - 1]

  const lastRevised = data.settings.calorieTargets?.lastRevisedAt
  const daysSinceRevision = lastRevised ? diffDays(lastRevised, today) : null
  const needsCalorieReview = !lastRevised || daysSinceRevision >= CALORIE_REVIEW_DAYS

  const openMeasurement = () => { setForm(emptyMeasurementForm()); setMeasurementOpen(true) }
  const saveMeasurement = () => {
    const entry = {}
    for (const f of MEASUREMENT_FIELDS) {
      if (form[f.key] !== '') entry[f.key] = Number(form[f.key])
    }
    if (Object.keys(entry).length === 0) return
    addMeasurement(entry)
    setMeasurementOpen(false)
  }

  const saveCalorieTargets = () => {
    setCalorieTargets(calorieForm)
    setCalorieOpen(false)
  }

  return (
    <div className="page">
      <BackHeader eyebrow="More" title="Voortgang" onBack={onBack} />

      <div className="section-title" style={{ marginTop: 0 }}>Deze week</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="row" style={{ gap: 12, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            {weekScores.map((d) => (
              <div key={d.date} style={{ textAlign: 'center', minWidth: 30 }}>
                <div className="text-sm faint">{weekdayShort(d.date)}</div>
                <div className="mono" style={{ fontWeight: 700, opacity: d.score == null ? 0.35 : 1 }}>
                  {d.score == null ? '—' : `${d.score}%`}
                </div>
              </div>
            ))}
          </div>
          {weekAvg != null && (
            <Ring value={weekAvg / 100} size={56} stroke={6}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{weekAvg}%</span>
            </Ring>
          )}
        </div>
        <div className="row" style={{ marginTop: 14, gap: 18, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div className="text-sm faint">Huidige streak</div>
            <div className="mono" style={{ fontWeight: 700 }}>{currentStreak} dagen</div>
          </div>
          <div>
            <div className="text-sm faint">Langste streak</div>
            <div className="mono" style={{ fontWeight: 700 }}>{longestStreak} dagen</div>
          </div>
        </div>
      </div>

      <div className="section-title">Deze maand</div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <div>
            <div className="text-sm faint">Gemiddelde score (30 dagen)</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 20 }}>{monthAvg != null ? `${monthAvg}%` : '—'}</div>
          </div>
          <div>
            <div className="text-sm faint">Dagen boven {threshold}%</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 20, textAlign: 'right' }}>{monthDaysAboveThreshold}</div>
          </div>
        </div>
      </div>

      <div className="section-title">Caloriedoelen</div>
      <div className="card" style={{ marginBottom: 16 }}>
        {needsCalorieReview && (
          <div className="text-sm" style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}>
            {lastRevised ? `${daysSinceRevision} dagen geleden herzien` : 'Nog nooit herzien'} — tijd om je caloriedoelen te herzien (elke 4 weken).
          </div>
        )}
        <div className="text-sm faint">Rustdag: {data.settings.calorieTargets?.rest_day_kcal?.join('–')} kcal</div>
        <div className="text-sm faint">Trainingsdag: {data.settings.calorieTargets?.training_day_kcal?.join('–')} kcal</div>
        <div className="text-sm faint">Eiwit: {data.settings.calorieTargets?.protein_g?.join('–')} g</div>
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => setCalorieOpen(true)}>Caloriedoelen bijstellen</button>
      </div>

      <div className="row" style={{ marginTop: 0 }}>
        <div className="section-title" style={{ marginTop: 0 }}>Omtrekmaten</div>
        <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }} onClick={openMeasurement}>+ Toevoegen</button>
      </div>
      {latestWeight && (
        <p className="text-sm faint" style={{ marginTop: -8, marginBottom: 10 }}>
          Laatste gewicht: {latestWeight.kg} {data.settings.weightUnit} ({humanDate(latestWeight.date)})
        </p>
      )}
      {measurements.length === 0 ? (
        <div className="empty-state"><p>Nog geen omtrekmaten gelogd.</p></div>
      ) : (
        <div className="stack" style={{ gap: 6, marginBottom: 16 }}>
          {measurements.map((m) => (
            <div key={m.id} className="card row" style={{ padding: '10px 14px' }}>
              <div>
                <div className="text-sm faint">{humanDate(m.date)}</div>
                <div className="text-sm">
                  {MEASUREMENT_FIELDS.filter((f) => m[f.key] != null).map((f) => `${f.label.split(' ')[0]} ${m[f.key]}cm`).join(' · ')}
                </div>
              </div>
              <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }} onClick={() => setToDelete(m)}>Verwijder</button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={measurementOpen} onClose={() => setMeasurementOpen(false)} title="Omtrekmaten toevoegen">
        {MEASUREMENT_FIELDS.map((f) => (
          <div className="field" key={f.key}>
            <label>{f.label}</label>
            <input
              className="input" type="number" inputMode="decimal" placeholder="optioneel"
              value={form[f.key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
          </div>
        ))}
        <button className="btn btn-primary btn-block" onClick={saveMeasurement}>Opslaan</button>
      </Sheet>

      <Sheet open={calorieOpen} onClose={() => setCalorieOpen(false)} title="Caloriedoelen bijstellen">
        <div className="field">
          <label>Rustdag kcal (min–max)</label>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" type="number" value={calorieForm.rest_day_kcal[0]} onChange={(e) => setCalorieForm((f) => ({ ...f, rest_day_kcal: [Number(e.target.value), f.rest_day_kcal[1]] }))} />
            <input className="input" type="number" value={calorieForm.rest_day_kcal[1]} onChange={(e) => setCalorieForm((f) => ({ ...f, rest_day_kcal: [f.rest_day_kcal[0], Number(e.target.value)] }))} />
          </div>
        </div>
        <div className="field">
          <label>Trainingsdag kcal (min–max)</label>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" type="number" value={calorieForm.training_day_kcal[0]} onChange={(e) => setCalorieForm((f) => ({ ...f, training_day_kcal: [Number(e.target.value), f.training_day_kcal[1]] }))} />
            <input className="input" type="number" value={calorieForm.training_day_kcal[1]} onChange={(e) => setCalorieForm((f) => ({ ...f, training_day_kcal: [f.training_day_kcal[0], Number(e.target.value)] }))} />
          </div>
        </div>
        <div className="field">
          <label>Eiwit g (min–max)</label>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" type="number" value={calorieForm.protein_g[0]} onChange={(e) => setCalorieForm((f) => ({ ...f, protein_g: [Number(e.target.value), f.protein_g[1]] }))} />
            <input className="input" type="number" value={calorieForm.protein_g[1]} onChange={(e) => setCalorieForm((f) => ({ ...f, protein_g: [f.protein_g[0], Number(e.target.value)] }))} />
          </div>
        </div>
        <button className="btn btn-primary btn-block" onClick={saveCalorieTargets}>Opslaan</button>
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        title="Meting verwijderen?"
        message="Deze meting wordt permanent verwijderd."
        confirmLabel="Verwijder"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { deleteMeasurement(toDelete.id); setToDelete(null) }}
      />
    </div>
  )
}
