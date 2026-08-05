// scripts/seedDemoUser.js
// Creates (or reuses) one clearly-fake demo user in the SAME live
// Supabase project, and seeds 14 days of realistic sample data across
// every normalized table. RLS makes it structurally impossible for this
// to touch any other user's rows, even if run incorrectly, since every
// insert targets only the demo user's own id. Run locally with the
// service_role key (never commit it):
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/seedDemoUser.js
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey)
const DEMO_EMAIL = 'seed-demo@lifestyle-tracker.test'
const DAYS = 14

function dateKeyDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

async function getOrCreateDemoUser() {
  const { data: existing, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) throw listError
  const found = existing.users.find((u) => u.email === DEMO_EMAIL)
  if (found) return found.id

  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: crypto.randomUUID(),
    email_confirm: true,
  })
  if (error) throw error
  return data.user.id
}

async function seed(userId) {
  const exerciseName = 'Push-up'

  for (let i = 0; i < DAYS; i++) {
    const date = dateKeyDaysAgo(i)

    await supabase.from('water_logs').upsert({ user_id: userId, date, ml: 1500 + (i % 5) * 100 }, { onConflict: 'user_id,date' })
    await supabase.from('sleep_logs').upsert({ user_id: userId, date, hours: 6.5 + (i % 3) * 0.5, quality: i % 2 === 0 ? 'good' : 'okay' }, { onConflict: 'user_id,date' })
    await supabase.from('workout_completions').upsert({ user_id: userId, date, completed: i % 2 === 0 }, { onConflict: 'user_id,date' })
    await supabase.from('nutrition_logs').upsert(
      { user_id: userId, date, breakfast: true, lunch: true, dinner: true, vegetables: i % 2 === 0, snacks: i % 3 === 0 },
      { onConflict: 'user_id,date' }
    )

    const { error: weightError } = await supabase.rpc('insert_weight_log', {
      p_kg: 68 + (i % 4) * 0.2, p_date: date, p_client_id: `seed-weight-${i}`, p_user_id: userId,
    })
    if (weightError) throw new Error(`weight seed failed: ${weightError.message}`)

    const { error: moodError } = await supabase.from('mood_logs').upsert(
      { user_id: userId, client_id: `seed-mood-${i}`, date, emoji: i % 3 === 0 ? '😞' : '🙂', note: null },
      { onConflict: 'user_id,client_id' }
    )
    if (moodError) throw new Error(`mood seed failed: ${moodError.message}`)

    const { error: exerciseError } = await supabase.from('exercise_logs').upsert(
      { user_id: userId, client_id: `seed-exercise-${i}`, exercise_name: exerciseName, date, weight: null, reps: 12 + (i % 5) },
      { onConflict: 'user_id,client_id' }
    )
    if (exerciseError) throw new Error(`exercise_logs seed failed: ${exerciseError.message}`)

    const { error: budgetError } = await supabase.from('budget_entries').upsert(
      { user_id: userId, client_id: `seed-budget-${i}`, date, amount: 8 + (i % 6), category: 'food', note: null },
      { onConflict: 'user_id,client_id' }
    )
    if (budgetError) throw new Error(`budget_entries seed failed: ${budgetError.message}`)

    const { error: scheduleError } = await supabase.from('schedule_items').upsert(
      { user_id: userId, client_id: `seed-schedule-${i}`, date, time: '09:00', title: 'Morning check-in', note: null },
      { onConflict: 'user_id,client_id' }
    )
    if (scheduleError) throw new Error(`schedule_items seed failed: ${scheduleError.message}`)

    const { error: noteError } = await supabase.rpc('insert_note', {
      p_date: date, p_text: `Demo note for day ${i}`, p_client_id: `seed-note-${i}`, p_user_id: userId,
    })
    if (noteError) throw new Error(`notes seed failed: ${noteError.message}`)

    if (i % 5 === 0) {
      const { error: cycleError } = await supabase.rpc('insert_cycle_log', {
        p_date: date, p_flow: 'light', p_symptoms: ['cramps'], p_note: null,
        p_client_id: `seed-cycle-${i}`, p_user_id: userId,
      })
      if (cycleError) throw new Error(`cycle_logs seed failed: ${cycleError.message}`)
    }
  }

  const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  for (const [idx, day] of weekdays.entries()) {
    const rest = idx >= 5
    await supabase.from('workout_schedule').upsert(
      { user_id: userId, day, rest, exercises: rest ? [] : [{ name: exerciseName, sets: 3, reps: '12' }] },
      { onConflict: 'user_id,day' }
    )
  }
}

async function main() {
  const userId = await getOrCreateDemoUser()
  console.log(`Seeding demo user ${userId}...`)
  await seed(userId)
  console.log(`Done. Seeded ${DAYS} days of data for ${DEMO_EMAIL}.`)
}

main().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
