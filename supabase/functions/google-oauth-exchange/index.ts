// Turns a one-time Google authorization code (from the client's
// initCodeClient popup, see src/utils/googleCalendar.js requestGoogleAuthCode)
// into a long-lived refresh token, stored server-side so the
// sync-calendar-tasks cron function can push calendar events without the
// user's browser being open.
//
// Deployed with JWT verification ON (unlike send-due-notifications) — this
// function has to know WHICH user is connecting, so it must be called with
// the user's own Supabase session token; the caller's identity comes from
// that token, not from anything in the request body.
//
// GOOGLE_CLIENT_SECRET is the one secret this function needs (Dashboard →
// Edge Functions → google-oauth-exchange → Secrets) — the Client ID itself
// isn't secret (same trust model as everywhere else in this app) so it's
// just passed in the request body instead of duplicating it as a second
// Supabase secret.

import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization') || ''
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: userData, error: userError } = await supabaseAuth.auth.getUser()
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Not authenticated.' }), { status: 401 })
  }
  const userId = userData.user.id

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400 })
  }
  const { code, clientId } = body
  if (!code || !clientId) {
    return new Response(JSON.stringify({ error: 'Missing code or clientId.' }), { status: 400 })
  }

  // 'postmessage' is Google's documented literal redirect_uri for the GIS
  // popup code-client flow — not a real URL, an exact required string.
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET'),
      redirect_uri: 'postmessage',
      grant_type: 'authorization_code',
    }),
  })
  const tokenJson = await tokenResp.json()

  if (!tokenResp.ok || !tokenJson.refresh_token) {
    // Google only issues a refresh_token on a consent screen the user
    // hasn't already approved for this app — if they'd previously granted
    // (and revoked) access without ever seeing prompt=consent again, no
    // refresh_token comes back. The client always requests with fresh
    // consent to avoid this, but surface a clear message just in case.
    return new Response(JSON.stringify({
      error: tokenJson.error_description || 'Google did not return a long-lived token. Try disconnecting Lifestyle Tracker at myaccount.google.com/permissions and reconnecting.',
    }), { status: 400 })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  )
  const { error: upsertError } = await supabaseAdmin
    .from('google_calendar_tokens')
    .upsert({ user_id: userId, refresh_token: tokenJson.refresh_token, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

  if (upsertError) {
    return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
})
