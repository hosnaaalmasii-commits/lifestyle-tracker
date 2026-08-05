// scripts/verifyRlsIsolation.js
// Signs in as the demo user with the ANON key (the same trust level the
// real app uses) and confirms a query returns only that user's own rows
// — proving RLS isolation from the client's actual vantage point, not
// the trusted service-role vantage point used by the seed/backfill
// scripts. Requires the demo user's password; since seedDemoUser.js
// generates a random one, pass it via env when seeding differently, or
// reset it once via the Dashboard for this one manual check.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... DEMO_PASSWORD=... node scripts/verifyRlsIsolation.js
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY
const password = process.env.DEMO_PASSWORD
if (!url || !anonKey || !password) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY, and DEMO_PASSWORD before running.')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

async function main() {
  const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'seed-demo@lifestyle-tracker.test',
    password,
  })
  if (signInError) throw signInError

  const demoUserId = signIn.user.id
  const { data: rows, error } = await supabase.from('water_logs').select('user_id')
  if (error) throw error

  const foreignRows = rows.filter((r) => r.user_id !== demoUserId)
  if (foreignRows.length > 0) {
    console.error(`RLS FAILURE: saw ${foreignRows.length} row(s) not owned by the demo user.`)
    process.exit(1)
  }
  console.log(`RLS isolation confirmed: all ${rows.length} visible row(s) belong to the demo user.`)
}

main().catch((err) => {
  console.error('Verification failed:', err.message)
  process.exit(1)
})
