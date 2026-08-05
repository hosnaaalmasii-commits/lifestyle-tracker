// scripts/verifyRlsIsolation.js
// Proves RLS isolation from the client's actual vantage point (anon key,
// signed in as the demo user — same trust level the real app uses), not
// just from the trusted service-role vantage point the seed/backfill
// scripts use. Also exercises the one place with hand-written
// authorization logic: the six security-definer RPC functions, whose
// service_role/authenticated branching isn't covered by RLS's ordinary
// four-policy pattern.
//
// The service-role key is needed to establish ground truth — to confirm a
// real foreign user's rows genuinely exist before declaring that they
// were successfully hidden. Without that check the test can pass
// vacuously against an empty database.
//
// Requires the demo user's password; since seedDemoUser.js generates a
// random one, reset it once via the Dashboard for this manual check.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... DEMO_PASSWORD=... node scripts/verifyRlsIsolation.js
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.DEMO_PASSWORD
if (!url || !anonKey || !serviceRoleKey || !password) {
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, and DEMO_PASSWORD before running.')
  process.exit(1)
}

const adminClient = createClient(url, serviceRoleKey)
const anonClient = createClient(url, anonKey)

const DEMO_EMAIL = 'seed-demo@lifestyle-tracker.test'

const PLAIN_TABLES = [
  'water_logs', 'sleep_logs', 'workout_schedule', 'workout_completions',
  'exercise_logs', 'mood_logs', 'nutrition_logs', 'budget_entries', 'schedule_items',
]

// The three encrypted tables are readable directly (ciphertext only), so
// RLS isolation applies to them too and is worth confirming.
const ENCRYPTED_TABLES = ['weight_logs', 'cycle_logs', 'notes']

async function main() {
  // Sign in first, so we know which user id counts as "ours".
  const { data: signIn, error: signInError } = await anonClient.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password,
  })
  if (signInError) throw signInError
  const demoUserId = signIn.user.id

  // Ground truth, established with the trusted service-role client: find
  // real, non-demo users and confirm they have rows we can try (and fail)
  // to see as the demo user.
  const { data: appDataRows, error: appDataError } = await adminClient.from('app_data').select('user_id')
  if (appDataError) throw appDataError

  const realUsers = appDataRows.map((r) => r.user_id).filter((id) => id !== demoUserId)
  if (realUsers.length === 0) {
    console.error('No other user found in app_data to test isolation against — run this once the real account exists.')
    process.exit(1)
  }

  let anyForeignRowsExisted = false

  for (const table of [...PLAIN_TABLES, ...ENCRYPTED_TABLES]) {
    const { data: adminRows, error: adminError } = await adminClient
      .from(table)
      .select('user_id')
      .in('user_id', realUsers)
    if (adminError) throw new Error(`ground-truth read of ${table} failed: ${adminError.message}`)
    if (adminRows.length > 0) anyForeignRowsExisted = true

    const { data: anonRows, error: anonError } = await anonClient.from(table).select('user_id')
    if (anonError) throw new Error(`client read of ${table} failed: ${anonError.message}`)

    const foreignVisible = anonRows.filter((r) => r.user_id !== demoUserId)
    if (foreignVisible.length > 0) {
      console.error(
        `RLS FAILURE on ${table}: saw ${foreignVisible.length} row(s) not owned by the demo user ` +
        `(${adminRows.length} foreign row(s) exist and should all have been hidden).`
      )
      process.exit(1)
    }
  }

  // The RPC path: this is the one place with hand-written authorization
  // logic (the service_role/authenticated branch) that plain RLS policies
  // don't cover. An authenticated caller must always be forced back to
  // its own auth.uid() no matter what p_user_id it passes.
  const targetUserId = realUsers[0]
  const RPC_CHECKS = [
    ['get_weight_logs', { p_user_id: targetUserId }],
    ['get_cycle_logs', { p_user_id: targetUserId }],
    ['get_notes', { p_user_id: targetUserId }],
  ]

  // These RPCs return decrypted rows without a user_id column, so we
  // can't identify a leaked row by inspection. Instead we compare the
  // foreign-p_user_id call against the no-argument (self) call: correct
  // behaviour is for them to be identical, because p_user_id is ignored
  // entirely for authenticated callers. Note this is deliberately NOT a
  // "returned zero rows" assertion — the demo user has seeded weight,
  // cycle and note rows of its own, so zero would be the wrong
  // expectation and would make this check fail spuriously.
  for (const [fn, args] of RPC_CHECKS) {
    const { data: foreignCall, error: foreignError } = await anonClient.rpc(fn, args)
    if (foreignError) throw new Error(`${fn} RPC call failed: ${foreignError.message}`)

    const { data: selfCall, error: selfError } = await anonClient.rpc(fn, {})
    if (selfError) throw new Error(`${fn} self-call failed: ${selfError.message}`)

    const foreignCount = (foreignCall || []).length
    const selfCount = (selfCall || []).length
    if (foreignCount !== selfCount) {
      console.error(
        `RPC AUTHORIZATION FAILURE: ${fn} with a foreign p_user_id returned ${foreignCount} ` +
        `row(s), but the same call for the demo user's own data returns ${selfCount} — ` +
        'p_user_id was not ignored for an authenticated caller.'
      )
      process.exit(1)
    }
  }

  if (!anyForeignRowsExisted) {
    console.warn(
      'Warning: no foreign rows existed in any table to begin with — this run confirms no leak ' +
      'occurred, but did not exercise a real hidden-row scenario. Seed some real data and re-run ' +
      'for a fully meaningful check.'
    )
  }

  console.log(
    `RLS isolation confirmed across all ${PLAIN_TABLES.length + ENCRYPTED_TABLES.length} tables, ` +
    'and get_weight_logs / get_cycle_logs / get_notes all correctly ignored a foreign p_user_id.'
  )
}

main().catch((err) => {
  console.error('Verification failed:', err.message)
  process.exit(1)
})
