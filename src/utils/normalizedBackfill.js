// One-time push of EXISTING local data into the normalized/encrypted
// Supabase tables (see supabase/normalized_tables.sql and
// supabase/encrypted_tables.sql). Going-forward writes are handled by
// syncNormalized() calls inline in AppContext.jsx's actions — this file
// is only for backfilling history that predates those calls, run once
// from Settings ("Backfill existing data" under Cloud Sync).
//
// Every table here has a unique(user_id, date) or unique(user_id,
// client_id) constraint and every write is an upsert (or an insert RPC
// that no-ops on conflict), so this is safe to run more than once —
// re-running just re-confirms rows that already exist rather than
// duplicating them.
import { upsertWaterLog } from '../services/waterService'
import { upsertSleepLog } from '../services/sleepService'
import { upsertWorkoutScheduleDay, setWorkoutCompletion, addExerciseLog } from '../services/workoutService'
import { addMoodLog } from '../services/moodService'
import { upsertNutritionLog } from '../services/nutritionService'
import { addBudgetEntry } from '../services/budgetService'
import { addScheduleItem } from '../services/scheduleService'
import { addWeightLog } from '../services/weightService'
import { addCycleLog } from '../services/cycleService'
import { addNote } from '../services/notesService'

// Runs a batch of thunks with limited concurrency (a handful of hundred
// entries fired all at once could overwhelm the connection or hit
// Supabase's default rate limits) and collects per-item errors instead of
// letting the first failure abort everything else.
async function runBatch(items, worker, concurrency = 5) {
  let ok = 0
  const errors = []
  let i = 0
  async function next() {
    while (i < items.length) {
      const item = items[i]
      i += 1
      try {
        await worker(item)
        ok += 1
      } catch (err) {
        errors.push({ item, message: err?.message || String(err) })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next))
  return { ok, errors }
}

export async function backfillNormalizedTables(data, url, anonKey, onProgress) {
  const results = {}
  const report = async (label, items, worker) => {
    onProgress?.(label)
    results[label] = await runBatch(items, worker)
  }

  await report('Water', Object.entries(data.water || {}), ([date, ml]) => upsertWaterLog(url, anonKey, date, ml))

  await report('Sleep', Object.entries(data.sleep || {}), ([date, s]) => upsertSleepLog(url, anonKey, date, s.hours, s.quality))

  await report('Workout schedule', data.workouts?.schedule || [], (s) => upsertWorkoutScheduleDay(url, anonKey, s.day, s.exercises, !!s.rest))

  await report('Workout completions', Object.entries(data.workouts?.completions || {}), ([date, completed]) => setWorkoutCompletion(url, anonKey, date, !!completed))

  const exerciseEntries = Object.entries(data.workouts?.exerciseLogs || {}).flatMap(([name, logs]) => logs.map((log) => ({ name, log })))
  await report('Exercise PRs', exerciseEntries, ({ name, log }) => addExerciseLog(url, anonKey, log.id, name, log.date, log.weight, log.reps))

  await report('Mood', data.mood || [], (m) => addMoodLog(url, anonKey, m.id, m.date, m.emoji, m.note))

  await report('Nutrition', Object.entries(data.nutrition || {}), ([date, item]) => upsertNutritionLog(url, anonKey, date, item))

  await report('Budget', data.budget || [], (b) => addBudgetEntry(url, anonKey, b.id, b.date, b.amount, b.category, b.note))

  await report('Schedule', data.schedule || [], (s) => addScheduleItem(url, anonKey, s.id, s.date, s.time, s.text))

  await report('Weight', data.weight || [], (w) => addWeightLog(url, anonKey, w.id, w.date, w.kg))

  await report('Cycle', data.cycle || [], (c) => addCycleLog(url, anonKey, c.id, c.date, c.flow, c.symptoms, c.note))

  await report('Notes', data.notes || [], (n) => addNote(url, anonKey, n.id, n.date, n.text))

  return results
}
