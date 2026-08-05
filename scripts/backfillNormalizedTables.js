// scripts/backfillNormalizedTables.js
// One-time, idempotent backfill from app_data (the whole-blob table) into
// the new normalized tables. Run locally only, with the service_role key
// (never commit this key):
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/backfillNormalizedTables.js
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey)

async function backfillUser(userId, data) {
  for (const [date, ml] of Object.entries(data.water || {})) {
    const { error } = await supabase.from('water_logs').upsert({ user_id: userId, date, ml }, { onConflict: 'user_id,date' })
    if (error) throw new Error(`water_logs upsert failed: ${error.message}`)
  }

  for (const [date, sleep] of Object.entries(data.sleep || {})) {
    const { error } = await supabase
      .from('sleep_logs')
      .upsert({ user_id: userId, date, hours: sleep.hours, quality: sleep.quality }, { onConflict: 'user_id,date' })
    if (error) throw new Error(`sleep_logs upsert failed: ${error.message}`)
  }

  for (const day of data.workouts?.schedule || []) {
    const { error } = await supabase
      .from('workout_schedule')
      .upsert({ user_id: userId, day: day.day, exercises: day.exercises, rest: !!day.rest }, { onConflict: 'user_id,day' })
    if (error) throw new Error(`workout_schedule upsert failed: ${error.message}`)
  }

  for (const [date, completed] of Object.entries(data.workouts?.completions || {})) {
    const { error } = await supabase
      .from('workout_completions')
      .upsert({ user_id: userId, date, completed: !!completed }, { onConflict: 'user_id,date' })
    if (error) throw new Error(`workout_completions upsert failed: ${error.message}`)
  }

  for (const [exerciseName, logs] of Object.entries(data.workouts?.exerciseLogs || {})) {
    for (const log of logs) {
      const { error } = await supabase.from('exercise_logs').upsert(
        { user_id: userId, client_id: log.id, exercise_name: exerciseName, date: log.date, weight: log.weight, reps: log.reps },
        { onConflict: 'user_id,client_id' }
      )
      if (error) throw new Error(`exercise_logs upsert failed: ${error.message}`)
    }
  }

  for (const w of data.weight || []) {
    const { error } = await supabase.rpc('insert_weight_log', {
      p_kg: w.kg, p_date: w.date, p_client_id: w.id, p_user_id: userId,
    })
    if (error) throw new Error(`weight_logs insert failed: ${error.message}`)
  }

  for (const m of data.mood || []) {
    const { error } = await supabase
      .from('mood_logs')
      .upsert({ user_id: userId, client_id: m.id, date: m.date, emoji: m.emoji, note: m.note }, { onConflict: 'user_id,client_id' })
    if (error) throw new Error(`mood_logs upsert failed: ${error.message}`)
  }

  for (const [date, n] of Object.entries(data.nutrition || {})) {
    const { error } = await supabase.from('nutrition_logs').upsert(
      { user_id: userId, date, breakfast: !!n.breakfast, lunch: !!n.lunch, dinner: !!n.dinner, vegetables: !!n.vegetables, snacks: !!n.snacks },
      { onConflict: 'user_id,date' }
    )
    if (error) throw new Error(`nutrition_logs upsert failed: ${error.message}`)
  }

  for (const c of data.cycle || []) {
    const { error } = await supabase.rpc('insert_cycle_log', {
      p_date: c.date, p_flow: c.flow || null, p_symptoms: c.symptoms || [], p_note: c.note || null,
      p_client_id: c.id, p_user_id: userId,
    })
    if (error) throw new Error(`cycle_logs insert failed: ${error.message}`)
  }

  for (const b of data.budget || []) {
    const { error } = await supabase.from('budget_entries').upsert(
      { user_id: userId, client_id: b.id, date: b.date, amount: b.amount, category: b.category, note: b.note },
      { onConflict: 'user_id,client_id' }
    )
    if (error) throw new Error(`budget_entries upsert failed: ${error.message}`)
  }

  for (const s of data.schedule || []) {
    const { error } = await supabase.from('schedule_items').upsert(
      { user_id: userId, client_id: s.id, date: s.date, time: s.time, text: s.text },
      { onConflict: 'user_id,client_id' }
    )
    if (error) throw new Error(`schedule_items upsert failed: ${error.message}`)
  }

  for (const n of data.notes || []) {
    const { error } = await supabase.rpc('insert_note', {
      p_date: n.date, p_text: n.text, p_client_id: n.id, p_user_id: userId,
    })
    if (error) throw new Error(`notes insert failed: ${error.message}`)
  }
}

async function main() {
  const { data: rows, error } = await supabase.from('app_data').select('user_id, data')
  if (error) throw error

  for (const row of rows) {
    console.log(`Backfilling user ${row.user_id}...`)
    await backfillUser(row.user_id, row.data)
  }

  console.log(`Done. Backfilled ${rows.length} user(s).`)
}

main().catch((err) => {
  console.error('Backfill failed:', err.message)
  process.exit(1)
})
