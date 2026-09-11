# CLAUDE.md — Lifestyle Tracker

Working notes for Claude Code sessions on this repo. See [README.md](README.md)
for the file-by-file structure and data model reference — this file is about
*why* things are built the way they are, and where things currently stand.

## What this is

A personal, installable (PWA) lifestyle tracker — water, sleep, workouts,
weight, mood, nutrition, progress photos, cycle, budget, schedule, notes —
plus a layer of habit-formation features (insights, Consistency Score,
Habit Contracts, Comeback Mode, Lifestyle GPS, Hydration Autopilot,
cycle-aware coaching) loosely inspired by a product-strategy exercise the
user asked for early in this project (a hypothetical app called "Tessera"
— see chat history if that name resurfaces; it's not part of this app's
branding, just the design doc it was scoped from — the user's own Supabase
org/project also happens to be named "Tessera," which is unrelated and not
worth "fixing"). It also has a voice/text-logging pipeline (say or type a
sentence, it becomes structured log entries), two selectable visual styles
— Classic and a dark "Fintech" style with a genuinely different Overview
layout — and a full **Character System**: a companion that grows or fades
with the user's real habits (see below).

A later session added a second, parallel system on top of all this: a
**personalized transformation-plan tracker** — a structured daily task
checklist (meals/training/supplements/recovery at fixed times, editable in
the app), a rotating A/B/C/D meal plan, background push notifications at
each task's time, a Google Calendar write-sync, an Oura ring integration,
and a week/month progress rollup with a 4-weekly calorie-target review
nudge. This is deliberately a *separate* system from Consistency
Score/badges/etc. above (a fixed personal schedule with real clock-time
push reminders is a different shape of feature than "derived score from
whatever you happened to log") — see "Transformation-plan tracker" below.

Live at: **https://hosnaaalmasii-commits.github.io/lifestyle-tracker/**
Repo: **github.com/hosnaaalmasii-commits/lifestyle-tracker**

## Architecture, and why

- **Vite + React, plain JavaScript (no TypeScript).** Chosen for low friction
  on future "change this or that" style requests — no type ceremony to fight.
- **Fully client-side, no custom backend, deployed to GitHub Pages via
  GitHub Actions** (`.github/workflows/deploy.yml`, runs on every push to
  `main`). GitHub Pages was picked specifically because the user already
  needed a GitHub account for the repo — no second service/account to
  manage. When cross-device sync was requested later, a **hand-written
  server was explicitly considered and rejected** in favor of Supabase
  (see below) — the user has no coding background and didn't want ongoing
  infra to maintain; keep defaulting to managed/BYOK services over custom
  servers for this project.
- **`vite.config.js` uses `base: './'`** (relative paths) so the build works
  from any GitHub Pages project path without hardcoding the repo name.
- **All data lives in one `localStorage` blob** (`AppContext.jsx`,
  key `lifestyle-tracker-data-v1`). Settings → Export/Import round-trips
  that exact JSON. `mergeWithDefaults()` (used by `loadData`, `importData`,
  and cloud-sync pulls) is the one place new top-level fields get backfilled
  for old saved data — add new `DEFAULT_DATA` fields there, not three places.
- **"Derived, not stored" is the house rule for anything computed.** XP/
  levels, badges, weekly challenges, insights, Consistency Score, workout
  tier suggestions, Lifestyle GPS phase, the Character System's entire
  growth/condition state, and today's micro-habit are all recomputed live
  from the raw logs on every render — nothing about them is persisted. This
  was a deliberate choice made repeatedly through the project: it means new
  derived features never need a migration and can never drift out of sync
  with the underlying data. When adding a new "smart" feature, default to
  this pattern before adding stored state. The Character System pushed this
  further than anything before it — even "growth over time" is a *derived*
  decayed rolling average (see below), not a stored counter that increments.
- **Four external services get called, all bring-your-own-credential and
  all opt-in** (was "three, and only three" until the transformation-plan
  session added Oura — see below; still the same principle, just one more
  entry). Everything else, including the voice pipeline below, reuses one
  of these rather than adding a new one:
  - **Claude API** (`claudeApi.js`): direct browser fetch to
    `api.anthropic.com` using the user's own API key and the
    `anthropic-dangerous-direct-browser-access` header. The key is a real
    secret — stored in its own localStorage key, deliberately excluded from
    `data`/export, wiped by "Clear everything". **Never** embed a shared key
    here; anything in client code is publicly extractable. `sendToClaude()`
    is the one call site — the **AI Coach** (`coachContext.js`) and the
    **voice-logging pipeline** (`voiceLogging.js`) both call through it with
    different system prompts, rather than each rolling their own fetch.
    Voice logging's AI parsing step is **optional** — the mic and "Save as
    note" work with zero API key configured; only the auto-categorize-into-
    structured-entries step needs one (see Voice-logging pipeline below).
  - **Google Calendar** (`googleCalendar.js`): client-side Google Identity
    Services token flow. Originally freebusy-only; the transformation-plan
    session broadened the scope to `calendar.freebusy` +
    `calendar.events` (still not the broad `calendar` management scope) so
    scheduled tasks can be pushed in as real events, via
    `syncTasksToCalendar()` (More → Settings → "Taken syncen naar agenda").
    It's a **manual** sync (7 days ahead, re-run on demand — auto-resync
    happens on reconnect but not on a timer), because a client-only PWA has
    no scheduler; `data.googleCalendarEventIds` (`{date: {taskId:
    eventId}}`) is what makes re-syncing update in place instead of
    duplicating events — don't drop that map without also handling
    duplicate-event cleanup. A Google OAuth Client ID is *not* a secret
    (Google restricts it by authorized origins, not by hiding it), so it's
    fine to keep in `data.settings.googleClientId` — opposite trust model
    from the Anthropic key, don't conflate the two. The access token itself
    stays in memory only (a ref), never localStorage; a silent,
    non-prompting reconnect is attempted on load. Still not configured on
    the user's live site as of this note — optional.
  - **Oura** (`ouraApi.js`): BYOK Personal Access Token
    (cloud.ouraring.com/personal-access-tokens), same storage/trust model
    as the Anthropic key — own localStorage slot, never in `data`/export.
    `fetchOuraToday()` pulls sleep score, readiness, active calories;
    shown on the Vandaag/TodayTasks card and fed into `workoutTiers.js`'s
    existing `suggestTier()` heuristic (low readiness nudges a lighter
    tier, same style as its sleep/mood/calendar/alcohol checks — reused,
    not a parallel readiness system). **Apple HealthKit was considered and
    ruled out** for the same slot: it's a native-only iOS framework, not
    reachable from a web page even installed as a PWA — getting HealthKit
    data would mean wrapping this app natively (e.g. Capacitor), out of
    scope unless the user explicitly asks to go native.
  - **Supabase** (`supabaseClient.js` + `cloudSync.js`), for **Cloud Sync**
    across devices: the user's own free Supabase project, connected via
    Project URL + publishable key (`data.settings.supabaseUrl` /
    `supabaseAnonKey` — neither is a secret, Supabase's security model is
    RLS-based, so same "safe to keep in settings" treatment as the Google
    Client ID). Auth is Supabase's own email/password, one row per user in
    a single `app_data` table (`supabase/schema.sql` — RLS-scoped to
    `auth.uid()`) holding the whole JSON blob. Sync is **whole-blob,
    last-write-wins** by timestamp (`markLocalModified()` /
    `getLocalLastModified()`), not field-level merge — simple and
    predictable for one person's own devices, with one known tradeoff:
    editing two devices offline in the same window before either syncs
    keeps only the later write. The Supabase session persists itself in
    its own localStorage key (not ours to manage). **This user's actual
    project is live and connected already** — org "hosnaa.almasii@gmail.com's
    Org", project "Tessera", ref `lsxyejppowqdtcchzhjt`, one confirmed user
    account. Don't re-walk the whole setup from scratch if sync comes up
    again; it's already working.
- **Voice-logging pipeline** (`voiceLogging.js` + `VoiceLogSheet.jsx`,
  entry point: "Log by voice" button on Overview): capture (mic or typed
  text) and AI parsing are **deliberately decoupled**. The mic (native
  `SpeechRecognition`, see Speech capture below) and a **"Save as note"**
  button work with zero configuration — the transcript gets saved as a
  plain dated entry in `data.notes` (More → Notes page), no AI involved.
  If a Claude API key *is* configured, an additional "Parse with AI" step
  (and auto-parse-on-mic-stop) turns the sentence into structured entries
  across 7 categories — meal, drink, mood, workout, cycle, schedule,
  budget — via one Claude call. Every extracted field is tagged
  `exact` / `estimated` / `unknown` / `needs_confirmation`. **The rule for
  when to interrupt the user with a follow-up question**: only when a
  field is genuinely ambiguous *and* it feeds a real downstream number
  (water ml total, a workout PR's weight/reps, an expense amount) — never
  for cosmetic fields (mood intensity, meal slot, cycle flow, schedule
  time). Resolved intents write through the exact same `AppContext` actions
  the manual log forms use (`addWater`, `setNutritionItem`, `addCycleEntry`,
  etc.), so a voice-logged entry is indistinguishable from a manual one
  afterward.
  - `cycle`, `budget`, `schedule`, and `notes` are real tracked categories
    (`data.cycle`/`budget`/`schedule`/`notes`, arrays of dated entries).
    The first three exist because the voice pipeline needed somewhere to
    write those intents to; `notes` exists specifically so voice/text
    capture never has a dead end without an API key. Each has a minimal
    page under More following the same log-entry-list-plus-Sheet pattern
    as `Weight.jsx`.
  - Not yet extended to weight/sleep intents — both already have full
    pages and `AppContext` actions, so this would follow the existing
    category shape rather than needing new infrastructure, if asked.
- **Speech capture** (`speechInput.js`): wraps the browser's native
  `SpeechRecognition` API for a real "tap and talk" mic button in
  `VoiceLogSheet`. **Safari — desktop and iOS — has never implemented this
  API.** `SPEECH_SUPPORTED` is computed once at module load; when false,
  the mic button doesn't render and the sheet falls back to its text box,
  with a note pointing at the OS keyboard's own dictation microphone.
  `onEnd` — not just a detected "final" result — is what triggers parsing,
  deduped against the final-result path with a ref flag; a manually
  aborted (sheet-closed) session is explicitly suppressed from
  auto-parsing via a separate flag.
- **Sheets render through a React portal straight to `document.body`**
  (`Sheet.jsx`, via `createPortal`) — **this is load-bearing, not
  stylistic.** `.page`'s entrance animation ends on
  `transform: translateY(0)`, and per the CSS spec *any* `transform` value
  on an ancestor (even a no-op identity one) makes that ancestor the
  containing block for `position: fixed` descendants instead of the real
  viewport. Before the portal fix, every sheet rendered inline inside
  `.page` was sizing its "full-screen" overlay against the *page's full
  content height* rather than the actual screen — invisible on short pages,
  catastrophic on tall ones (Overview specifically, being the longest page,
  pushed a sheet's primary button hundreds of pixels below the visible
  screen with no obvious way to scroll to it, on *every* browser — this
  was mistaken for a Safari-only bug for several rounds because it was
  first reported on an iPhone, and confirmed on desktop Chrome only once
  the user sent a DevTools screenshot). If you ever build a full-screen
  overlay/modal *without* going through `Sheet.jsx`, it needs the same
  portal treatment — don't reintroduce this by rendering `position: fixed`
  inline in the component tree.
- **UI style system** (`data.settings.uiStyle`: `'classic'` | `'fintech'`):
  independent of light/dark theme (`themeMode`), toggled in Settings → App
  style. Fintech sets `data-style="fintech"` on `<html>`; `fintech.css` is
  scoped entirely under that attribute so it never leaks into Classic.
  - A gradient picker (`fintechGradients.js`: Nebula/Ion/Wealth) drives not
    just hero-card backgrounds but the app's actual accent CSS variables
    when Fintech is active — set in the same `AppContext.jsx` effect that
    already pushes Classic's user-picked colors.
  - **Fintech's Overview is a structurally different layout**
    (`OverviewTerminal.jsx`): a swipeable wallet-card carousel
    (`WalletRail.jsx`), a 3-ring "flight dial" (`FlightDial.jsx`), a weekly
    seat-map (`WeeklyManifest.jsx`), a torn boarding-pass ticket
    (`BoardingPass.jsx`), passport-stamp badges (`PassportStamp.jsx`), and
    a bento grid for the companion/XP/streak/badges.
- **The Character System** (`characterEngine.js` + `ElementalCreature.jsx`
  + `CharacterCard.jsx` + `CharacterOnboardingSheet.jsx`) replaced the
  earlier Spark mascot and Companion State daily-mood card **entirely** —
  one companion now, chosen once at onboarding, shown on Overview in both
  Classic (hero card) and Fintech (full-width bento tile). This went
  through **six rejected visual directions** before landing (abstract blob
  creature → human "poppet" figure → botanical bloom poppet → Duolingo-
  style bold flat mascot → a minimal luxury-brand crest/emblem → **the one
  that stuck**: each archetype rendered as its own real elemental
  phenomenon). If asked to touch this area's visuals again, get a concrete
  reference (a named app/brand/image) before building anything — abstract
  style adjectives ("creative," "aesthetic," "classy") did not converge
  here until the user could point at something concrete.
  - **Ten archetypes** (`ARCHETYPES` in `characterEngine.js`), each its own
    phenomenon, not a shared shape recolored: Fire (a real campfire that
    grows more flames and heats up), Moon (real lunar phases, new → full),
    Warrior (a blade being forged/sharpened), Nature creature (a tree
    filling out its canopy), Robot (a frame assembling/powering up),
    Animal companion (a fox growing fuller/more alert), Plant (a stem
    coming into bloom), Dragon (hatchling → full wingspan), Spirit (a wisp
    brightening into a glow), Athlete (a comet building a longer trail).
    Fire and Moon got the deepest polish (multiple rounds of "make it look
    more real" — layered gradients, embers, lunar shading/craters); the
    other eight got one solid pass at the same technique but slightly less
    iteration — worth another look if asked to refine further.
  - Each archetype has its **own fitting 5 stage names**
    (`ARCHETYPE_STAGE_NAMES`) over the *same* shared point thresholds —
    Fire's Spark→Kindle→Rise→Flourish→Radiant, Moon's real phase names,
    etc. Don't reuse one archetype's names for another; design a fitting
    set per phenomenon if more archetypes are ever added.
  - **Growth is a decayed 90-day rolling measure, explicitly not a
    lifetime cumulative total** (`GROWTH_WINDOW_DAYS` / `GROWTH_DECAY` in
    `characterEngine.js`) — this was a specific, deliberate user request:
    the companion has to be able to grow *and* genuinely fade back down
    over weeks-to-months of neglect, the same way a real fire needs
    ongoing fuel. `totalFeedPoints()` caps its lookback window at how long
    the character has actually existed (`daysSinceCreated`) — **don't
    remove that cap**; without it, a brand-new character reads pre-
    creation days (which default to a neutral "rest day" workout ratio) as
    real history and starts partway leveled-up. This exact regression
    happened once already and was fixed.
  - The `vitality` value (0–1, from the existing 14-state daily-condition
    system carried over from Companion State — priority-ordered, damage
    states require both the 7-day *and* 30-day windows to agree, never
    from one bad day, supportive copy throughout) is independent of
    `growth` (stage progress) — a character can be young-but-thriving or
    long-established-but-struggling. Every icon function in
    `ElementalCreature.jsx` takes both as separate params.
  - **No SVG `<filter>`/`feGaussianBlur` anywhere in `ElementalCreature.jsx`
    — this is deliberate, not an oversight.** Safari (especially iOS) has
    long-standing bugs rendering many simultaneous SVG blur filters,
    particularly combined with transforms; the onboarding grid renders all
    ten archetypes at once (~15+ simultaneous filters previously), which
    silently blanked the whole element instead of just failing to blur.
    All glow effects use `radialGradient`-to-transparent fills instead —
    same soft look, no filter primitive. If adding a new icon or archetype,
    follow this pattern; don't reach for `feGaussianBlur`.
  - `CharacterErrorBoundary.jsx` wraps every `<CharacterCard />` usage —
    if anything in the Character System throws for any reason, it shows a
    small card with the actual error text instead of taking the rest of
    Overview down, and (unlike a silent fallback) gives something
    screenshot-able to diagnose from a device that can't be tested
    directly.
  - Migration: choosing an archetype for the first time converts any
    existing Spark XP 1:1 into `feedPointCredit`, which itself decays with
    the same `GROWTH_DECAY` factor from `createdAt` — a fading head start,
    not a permanent floor.
  - Changing archetypes later (`changeArchetype()`, reached via "Change
    companion" at the bottom of the character detail sheet) deliberately
    does **not** touch `createdAt` or `feedPointCredit` — the same
    underlying daily logs just get re-read through a different archetype's
    weight profile, so switching never resets progress to zero.
  - "Nutrition" as a growth input is a **proxy**, not real macro tracking:
    the existing 5-item daily checklist (`NUTRITION_KEYS`), since this app
    doesn't track protein/fiber directly. If the user ever wants literal
    protein/fiber tracking, that's new scope (a real nutrition subsystem),
    not a tweak to the existing weighting.
- **Explicitly out of scope**, on purpose: social/multiplayer features
  (personal single-user app by explicit request), fridge/camera
  computer-vision features, a third paid network service for Safari
  speech-to-text. Two items that were on this list earlier were
  **deliberately superseded** by explicit user request in the
  transformation-plan session: calendar-integration-beyond-freebusy (now
  has write access, see above) and "real push notifications, no custom
  backend" (see "Push notifications" below — a Supabase Edge Function is
  now the one exception to "no hand-written backend," scoped as narrowly
  as possible: one cron-triggered function, no exposed API surface). If
  either of these comes up again, this is *not* stale guidance to revert
  to — the supersession was intentional and shipped. A
  body-appearance/attractiveness axis for the
  Character System was explicitly proposed by the user once and declined
  on wellbeing grounds (tying a companion's look to hitting/missing health
  targets is a well-documented harmful pattern) — the "vitality" concept
  that shipped instead (posture/glow/energy, never size or attractiveness)
  was the counter-proposal that got approved.

## Transformation-plan tracker

Added in one session from a pasted spec (Dutch) plus a JSON data file the
user provided — `src/data/transformatieplan-data.json` (personal calorie
targets, a 4-week A/B/C/D meal rotation, a full weekday task schedule with
times/categories/notify flags, supplement timing notes, training phases).
That file is the **seed**, not the live source of truth:

- `AppContext.jsx`'s `seedTaskSchedule()` converts
  `daily_schedules_by_weekday` into `DEFAULT_DATA.taskSchedule` (`{mon:
  [...], ..., sun: [...]}`, each task getting a stable `${day}-${i}` id at
  seed time) and `meal_rotation`/`calorie_targets` are `structuredClone`d
  straight in. Once a user has ever saved (i.e. always, after first load),
  `mergeWithDefaults()`'s top-level spread means *their* saved/edited copy
  wins over the seed from then on — same idiom as every other top-level
  `DEFAULT_DATA` field, no special-casing needed. **Don't re-seed on every
  load** — that would silently discard edits.
- `src/utils/taskSchedule.js` is the shared logic: `weekdayKeyForDate()`
  (Mon-first, matching the data file's shape — not JS's Sun-first
  `getDay()`), `mealCycleLetterForDate()` (counts whole weeks since
  `meal_rotation.reference_monday`), `getTasksForDate()`,
  `computeDayScore()`, `dayMeetsThreshold()`. Both `TodayTasks.jsx` and
  `WeeklyProgress.jsx` build their streak calculations from
  `dayMeetsThreshold()` + the existing `streaks.js` primitives
  (`streakFromDateSet`/`longestStreakFromDateSet`) rather than duplicating
  streak math — reuse this if adding another view.
- **UI surfaces**: `TodayTasks.jsx` (a card at the top of Overview, above
  the existing hero-card score ring — a deliberate second, differently-
  scoped "score" living on the same page; don't merge them, they measure
  different things) for today's checklist + score + streak + Oura panel;
  More → **Dagschema & Menu** (`DailySchedule.jsx`) to add/edit/remove
  tasks per weekday, edit the meal rotation, set the streak threshold and
  per-category notification toggles; More → **Voortgang**
  (`WeeklyProgress.jsx`) for the week/month rollup, manual omtrekmaten
  (body measurements — `data.measurements`, its own array, not folded into
  `data.weight`), and the calorie-target editor with a nudge banner once
  `settings.calorieTargets.lastRevisedAt` is 28+ days old (`meta.doel`'s
  "revise every 4 weeks").
- Everything here rides the existing whole-blob Supabase sync
  automatically — no new tables were needed for this part (only for push
  subscriptions, see below), since it's all just more top-level fields in
  the same `data` object that already syncs.
- Fintech's `OverviewTerminal.jsx` does **not** show `TodayTasks` yet — it
  was only wired into the Classic Overview layout. If the user uses
  Fintech style day-to-day, this is a gap worth closing.

## Push notifications

The one deliberate exception to "no custom backend" (see Explicitly out of
scope above — this was a considered supersession, not scope creep).
Real, OS-level push, working even when the app is closed, required a
tiny always-on trigger a static GitHub Pages site can't provide on its own:

- **`supabase/functions/send-due-notifications/index.ts`**: a Deno Edge
  Function, deployed via the Supabase Dashboard's in-browser function
  editor (no `supabase` CLI auth was available in that session — if it is
  in a future one, redeploying via `supabase functions deploy` works the
  same). Runs every minute via **pg_cron** (`supabase/push_notifications.sql`
  sets up the `pg_cron`/`pg_net` extensions and `cron.schedule(...)`,
  job name `send-due-notifications-every-minute`). For each row in
  `push_subscriptions`, it reads that user's `app_data.data` (via the
  service-role key, which bypasses RLS — this function is the one place
  in the whole project that reads another table's data across users on
  purpose), computes their local weekday/time from
  `settings.timezone` (auto-captured client-side once via
  `Intl.DateTimeFormat().resolvedOptions().timeZone` — there's no other
  way for the function to know a user's timezone), finds tasks whose
  `time` matches *now*, and skips ones already completed
  (`taskCompletions`) or already notified today
  (`sent_task_notifications` — the dedup table; without it a task that
  stays "due" across several 1-minute ticks would spam).
- **Deployed with JWT verification OFF** for this one function
  (Dashboard → the function → Settings → "Verify JWT" toggle) —
  deliberate: it means the cron job's SQL never has to embed a service-role
  key or any secret (`net.http_post` just POSTs with no Authorization
  header). The tradeoff is the endpoint is technically callable by anyone
  who knows the URL, but it does nothing sensitive (no data returned, and
  every action it takes is idempotent/dedup'd) — an acceptable tradeoff
  for a personal single-user project. Don't "fix" this by adding auth
  without also solving where the secret would live.
- **VAPID keys**: generated once locally (`npx web-push generate-vapid-keys`).
  The **public** key is hardcoded in both `src/utils/push.js` and the Edge
  Function source (`BCIrdZknLohRuIYK64oE0z5iqeH6vJtp_tGOZdlR4XM7O04eWEU-_KaM3DC5pCYdNf1KON2yqlq6G6sxS-ovHzQ`)
  — not a secret, same trust model as the Google Client ID. The **private**
  key is a real secret and was deliberately never typed into any command,
  SQL editor, or web form by automation in that session — it was written to
  a local file and handed to the project owner to paste into the Supabase
  Dashboard's Edge Function secret `VAPID_PRIVATE_KEY` themselves. **As of
  the end of that session it was unconfirmed whether the user had actually
  set that secret yet** — if push notifications aren't firing, check that
  first before debugging the function logic.
- **Client side**: `vite.config.js` switched `vite-plugin-pwa` from
  `generateSW` to **`strategies: 'injectManifest'`** (`srcDir: 'src'`,
  `filename: 'sw.js'`) specifically so `src/sw.js` could carry custom
  `push`/`notificationclick` listeners — `generateSW` produces a fully
  auto-generated service worker with no room for custom event handlers.
  Verified via a real `npm run build` (not just dev mode) that
  `dist/sw.js` actually contains both listeners — dev mode doesn't
  reliably exercise the injectManifest pipeline. `src/utils/push.js`
  handles `Notification.requestPermission()` +
  `PushManager.subscribe()` + upserting the subscription into
  `push_subscriptions` (RLS-scoped to `auth.uid()`, one row per
  device/endpoint — a phone and a laptop each need their own row).
  Enabling push is gated on being signed into Cloud Sync
  (`enablePushNotifications()` in `AppContext.jsx` throws if
  `sessionUserRef.current` is null) since the Edge Function has no other
  way to find a subscription's owner's schedule. UI: More → Dagschema &
  Menu → "Meldingen inschakelen op dit apparaat."
- **iOS specifically**: Web Push only works on iOS 16.4+ **and only for a
  PWA installed via Safari's "Add to Home Screen"** — a normal Safari tab
  cannot receive push at all. This app has been installable that way for a
  while (see README), so this should already be satisfied, but it's worth
  confirming with the user if push reports "not working" on their iPhone
  specifically — the fix might just be "open the home-screen icon, not
  Safari."

## Design system

- Fonts: Fraunces (headings), Inter (body), IBM Plex Mono (numbers/data) —
  loaded via Google Fonts `<link>` in `index.html`. Fintech style overrides
  the heading font to a clean sans-serif stack rather than using Fraunces,
  on purpose — a serif read as "warm/classic," not "fintech."
- Colors: CSS custom properties in `theme.css` for Classic (light/dark via
  `prefers-color-scheme` + a `data-theme` override), `fintech.css` for the
  Fintech style. Section accent colors are pushed onto
  `document.documentElement` at runtime from an effect in `AppContext.jsx`.
  **Exception to the CSS-custom-property pattern**: each Character System
  archetype's palette is hardcoded per-icon inside `ElementalCreature.jsx`
  (real-fire colors, real-moon colors, etc.) rather than themeable CSS
  vars — deliberate, since the whole point is each one looking like the
  authentic thing it depicts, not a recolorable accent.
- **Icons: `src/components/Icon.jsx`, a hand-drawn line-icon set
  (~55 icons, including `mic`), replacing emoji throughout the app.**
  Consistent stroke weight (1.7), 24×24 viewBox, `currentColor`. When
  adding new UI, use an existing `Icon name="..."` where a reasonable
  match exists before inventing a new glyph. Persisted mood values
  (`data.mood[].emoji`) are still raw emoji strings for backward
  compatibility — only the *display* layer maps them to icons; don't "fix"
  the stored format.
- Color presets: `colorPresets.js` — grouped into named families rather
  than one flat list. `ColorPicker.jsx` shows a compact "quick pick" row
  by default with a "More shades" expand toggle.

## Known environment quirks (don't re-debug these)

- **`position: fixed` breaks if *any* ancestor has a `transform` (even an
  identity one like `translateY(0)` left behind by a finished CSS
  animation)** — the transformed ancestor becomes the containing block
  instead of the viewport. This is standard CSS spec behavior, not a
  browser bug, so it reproduces identically everywhere (this project's own
  `.page` entrance animation triggered it — see Sheet portal note above).
  Symptom: a "full-screen" fixed overlay sizes itself against total page
  content height instead of the screen, pushing anything inside it far out
  of view with no obvious way to scroll to it. If a full-screen overlay
  ever seems to "not show its content," check `getBoundingClientRect()` on
  the overlay itself before assuming a JS/logic bug — compare its height
  to `window.innerHeight`.
- **DOM-text-presence checks (`get_page_text`, `document.body.innerText`)
  do not verify that an element is actually *visible on screen* or
  positioned correctly** — only that it exists somewhere in the document.
  The `position: fixed` bug above went undiagnosed for several rounds
  specifically because every check confirmed the sheet's buttons existed
  in the DOM; none checked *where*. When debugging "user says X is
  missing/broken" and text-presence checks pass, follow up with
  `getBoundingClientRect()` on the relevant elements before ruling out a
  positioning bug.
- The **screenshot tool and `read_console_messages`** in this dev
  environment have repeatedly returned **stale/cached results** — same
  content across server restarts and page navigations, including phantom
  console errors referencing already-fixed code, and in at least one case a
  badly mis-scaled render. **Trust DOM-level verification instead**:
  `javascript_tool` calls doing `document.querySelectorAll(...)`,
  `getBoundingClientRect()`, `.innerText` checks, etc.
- **Real user-reported bugs on a device that can't be tested directly are
  genuinely hard to diagnose from code review alone** — this project's
  worst repeat-offender bug (the `position:fixed` issue above) took
  multiple wrong hypotheses (Safari-specific SVG filter bugs, stale PWA
  cache, browser extension interference — the last of which *was* real but
  a red herring for this particular report) before the user's own Chrome
  DevTools screenshot (Network tab, then a follow-up screenshot of the
  actual rendered sheet) gave the real signal. **Ask the user for a
  screenshot early**, and once one arrives, look at it literally rather
  than pattern-matching to the previous hypothesis — a Network tab
  screenshot incidentally revealed an unrelated browser-extension overlay
  that looked identical to the real bug's symptoms.
- **Rapid consecutive DOM reads right after a navigating `.click()` can
  return the pre-render snapshot.** Insert a short `setTimeout` (≥800ms has
  been reliable) before reading `document.querySelector(...)` after a tab
  switch or similar.
- **Synthetic `MouseEvent`/`PointerEvent` dispatch needs realistic timing.**
  Firing `pointerdown` → `pointermove` → `pointerup` all synchronously in
  one script tick happens *before* React's `useEffect` (which attaches the
  real listeners on state change) gets a chance to run. Space them with
  small `setTimeout` gaps, or prefer `.click()` on the real element/plain
  `computer` clicks over hand-built pointer event sequences.
- **`let`/`const` declared in one `javascript_tool` call can persist into
  the next call in the same page context** — reusing a variable name
  across separate `javascript_tool` calls throws `Identifier '...' has
  already been declared`. Use a fresh variable name per call, or wrap in
  an IIFE, if re-running similar diagnostic snippets.
- **No real Anthropic API key is configured in this dev environment.** To
  test Claude-dependent features (Coach, voice-logging's AI-parse step)
  without a real key, mock `window.fetch` for URLs containing
  `api.anthropic.com` and set a fake value under the
  `lifestyle-tracker-anthropic-key` localStorage key.
- Client-side hash-only navigation (`location.hash = '#x'`) does **not**
  reload the page/remount React — only a real `navigate()`/reload does.
- No `gh` CLI available in this environment; GitHub setup was done by
  walking the user through the browser UI. `git push` from this sandbox
  works without interactive auth (credentials already cached somehow) —
  don't assume that's true in a different environment.
- `python3`/`python` are not available in this shell; use Node or plain
  `Edit`/`Bash` text tools instead of Python one-liners.
- To preview a standalone concept file (not part of the app) with the
  reliable local dev server instead of the flaky screenshot tool against
  `file://`/artifact URLs: copy it into `public/` temporarily, hit it via
  `http://localhost:5173/<file>.html` through the already-running Vite
  preview, then delete it from `public/` again before committing anything.

**The paragraphs above describe an earlier (non-Windows) sandbox — the
transformation-plan session ran on the user's own Windows PC via a
different Claude Code surface, where none of git/node/npm/gh/uv were
preinstalled.** What's true there instead:

- **Every dev tool had to be installed via `winget`** (Git, Node.js LTS,
  GitHub CLI, uv) — none were present. `winget install` can silently land
  a package in either `C:\Program Files\<tool>` (when it can elevate) or
  `%LOCALAPPDATA%\Programs\<tool>` (per-user, no elevation) — don't assume
  which; check both, or `winget list --id <id>` then search for the
  binary. PATH updates from `winget`/`uv tool update-shell` only apply to
  *new* shells — the current PowerShell tool call's session needs
  `$env:PATH` prepended manually for that same call and every one after
  until the harness's own session picks up the change.
- **`gh auth login --web` needs a real interactive browser round-trip**:
  it prints a device code, needs that code entered at
  github.com/login/device, then — separately — GitHub's own step-up
  "sudo mode" check (device confirmation via the GitHub Mobile app *or* an
  emailed one-time code), independent of already being signed in. The
  device code has a short timeout; if the sudo-mode step drags (waiting on
  the user to check email/phone), the original `gh auth login` process
  will time out (`context deadline exceeded`) even after the user
  completes the browser side — just restart `gh auth login --web` for a
  fresh code once they're through the sudo-mode check, it goes fast the
  second time since sudo mode is now satisfied for that browser session.
- **Typing into GitHub's segmented device-code input** (one `<input>` per
  character) via a generic "type a string" automation action only fills
  the first box — click each box and type one character at a time.
- **A commit message containing literal `"` characters, passed to
  `git commit -m` from PowerShell, gets re-tokenized/split by the native
  command boundary** even inside a `@'...'@` (single-quoted, non-
  interpolating) here-string — PowerShell's native-argument passing does
  its own requoting. Write the message to a file and use
  `git commit -F <file>` instead of `-m` for anything with embedded quotes
  or that's more than a couple of lines.
- **The Supabase Dashboard's own SQL Editor and Table Editor can show
  stale/cached results**, same failure class as the Vite-dev-tab staleness
  above but in a completely different app — a `select count(*)` re-run in
  a *new* query tab got a fresh, correct result after an old tab's result
  panel was stuck showing a stale row count. If a Supabase dashboard
  result looks wrong or surprising (e.g. "tables disappeared"), open a
  fresh query tab and re-run before concluding data was actually lost.
- **Typing multi-line source into a Monaco-based code editor** (both the
  Supabase SQL Editor and its Edge Function code editor use Monaco) via a
  generic "type text" automation action **gets corrupted by
  auto-bracket-closing** — an opening `(`/`{` auto-inserts its own closing
  pair, so anything typed keystroke-by-keystroke ends up with duplicated/
  misplaced closing brackets. Reliable fix used repeatedly this session:
  `window.monaco.editor.getEditors()[0].setValue(exactText)` via the
  browser JS-eval tool, not simulated typing. For text containing
  backticks/`${}` (breaks a JS template-literal wrapper) or other characters
  awkward to inline into a JS string literal, base64-encode it first and
  decode+`setValue` in the same JS call.
- The Supabase **Table Editor**'s default landing view ("Create a table" /
  "Recent items") does not show a schema/table list at the viewport width
  this environment renders at — don't take an empty-looking Table Editor
  as evidence of no tables; verify via the SQL Editor instead.

## Current status (as of this note)

Everything is **committed, pushed, and deployed** — most recent commit on
`main` is `0c62b9e` ("Add weekly/monthly progress rollup, measurements,
calorie review (item 6)"). No known open bugs in the older feature set;
the `position:fixed`/portal fix (`01675ae`) is still worth re-confirming
with the user on both their phone and PC if it comes up, since it was
found and fixed based on a screenshot rather than a live confirmed retest.

The **transformation-plan tracker session** (this note's main update)
shipped all six items from the user's spec, verified with real production
builds and dev-preview testing throughout, across these commits:
`4caa3ae` (task schedule + meal rotation + editable schema, items 1/3),
`e25e5d3` (moved the seed data file to `src/data/`), `89e185f` +
`1788c5f` (push notification backend + client, item 2), `ac6db38`
(Google Calendar write-sync + Oura, items 4/5), `0c62b9e` (progress
rollup, item 6). See "Transformation-plan tracker" and "Push
notifications" above for the full architecture. **Open loose end**: the
`VAPID_PRIVATE_KEY` Supabase secret was handed off to the user to set
manually and was unconfirmed as done by the end of that session — real
push notifications won't fire until it is.

Also discovered (not caused) this session: the user's Supabase project
"Tessera" had **auto-paused from inactivity**, which is why it looked
empty on first glance — once resumed, it turned out the whole
`app_data`/normalized/encrypted schema was already live with real
synced data (2 users, logged water/weight rows). Nothing was actually
broken or lost; don't re-run the schema-setup SQL files as if from
scratch if this comes up again, just check whether the project needs
resuming.

Shipped and stable in earlier sessions, on top of the prior v1/v2 feature
set:
- **Voice logging works with zero API key configured** (mic + "Save as
  note" → `data.notes`); AI parsing remains an optional upgrade layer.
- **Hydration Autopilot** (Water page): an adjusted daily target (baseline
  + workout/cycle bumps) with a status label and one action, not a raw ml
  readout.
- **Cycle-aware coaching**: phase estimation (`cyclePhase.js`, always
  estimate-qualified copy, never diagnostic), feeding a hydration nudge, a
  workout-readiness nudge (extends the existing `suggestTier` heuristic,
  and specifically backs off if the user's own logged history shows they
  train through their period fine — generic template only applies until
  real personal data overrides it), and a Nutrition-page tip.
- **Cloud Sync**: fully configured and verified end-to-end on the user's
  own live Supabase project (see Architecture above).
- **The full Character System**, replacing Spark and Companion State.

## Next steps

1. **Confirm the `VAPID_PRIVATE_KEY` Supabase secret got set** (More →
   Edge Functions → send-due-notifications → Secrets) — this is the one
   thing standing between the push-notification backend and it actually
   sending anything. If notifications still don't arrive after that's
   confirmed set, check next: the user is using the **installed
   home-screen PWA** on iOS (not a Safari tab — push silently can't work
   there), they've tapped "Meldingen inschakelen op dit apparaat" in More
   → Dagschema & Menu, and `cron.job_run_details` in Supabase for
   actual invocation errors.
2. Fintech's `OverviewTerminal.jsx` doesn't show `TodayTasks` (the new
   day-screen checklist) — only the Classic Overview layout has it. Worth
   wiring in if the user uses Fintech style day-to-day.
3. Google Calendar sync (item 4) is manual-only (a button, not a
   background job) — if the user wants it automatic, that would mean
   either a second cron-triggered Edge Function (same pattern as push
   notifications) or accepting the manual-button tradeoff long-term;
   worth asking which before building anything.
4. **Re-confirm with the user, on both their iPhone and PC**, that
   companion onboarding/interaction still works correctly after the
   `position:fixed` portal fix from an earlier session — this was
   diagnosed and fixed via a screenshot rather than a live confirmed
   retest, and it's easy for this to get lost among newer work.
5. Not yet requested, but a plausible next ask given the pattern so far:
   extending the voice pipeline to also cover weight and sleep intents.
6. If asked to deepen the Character System's visuals further: Fire and
   Moon got the most polish; Warrior/Nature/Robot/Animal/Plant/Dragon/
   Spirit/Athlete each got one solid pass at the same
   gradient-plus-radial-glow technique but less iteration — a reasonable
   place to focus if the user wants more.
7. If the user ever wants real protein/fiber tracking (currently just the
   5-item nutrition checklist used as a proxy everywhere it's needed,
   including as a Character System growth input), that's new scope, not a
   tweak.
8. If asked to touch Fintech or Character System visuals again, get a
   concrete reference (named app/brand/image) before building — abstract
   adjectives alone took six rounds to converge last time.
