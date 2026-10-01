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
sentence, it becomes structured log entries), one dark visual style
("Richting E", with a user-selectable colour theme — see Design system)
and a full **Character System**: a companion that grows or fades
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
  all opt-in** (five since 2026-09-30: ElevenLabs for the coach's voice,
  see the Coach voice notes under Design system) (was "three, and only three" until the transformation-plan
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
    The **manual** sync (7 days ahead, re-run on demand — auto-resync
    happens on reconnect but not on a timer) still works exactly as
    before; `data.googleCalendarEventIds` (`{date: {taskId:
    eventId}}`) is what makes re-syncing update in place instead of
    duplicating events — don't drop that map without also handling
    duplicate-event cleanup. A Google OAuth Client ID is *not* a secret
    (Google restricts it by authorized origins, not by hiding it), so it's
    fine to keep in `data.settings.googleClientId` — opposite trust model
    from the Anthropic key, don't conflate the two. The access token itself
    stays in memory only (a ref), never localStorage; a silent,
    non-prompting reconnect is attempted on load. **A second, automatic
    sync path was added on top of this — see "Automatic Google Calendar
    sync" below** — the manual button and its token flow are unchanged and
    still the fallback if the user never enables auto-sync.
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
  - **A second, normalized layer sits on top of `app_data`, added in a
    2026-09-15 session**: `supabase/normalized_tables.sql` (9 plain
    tables — water_logs, sleep_logs, workout_schedule,
    workout_completions, exercise_logs, mood_logs, nutrition_logs,
    budget_entries, schedule_items) and `supabase/encrypted_tables.sql`
    (weight_logs, cycle_logs, notes — encrypted at rest via a Supabase
    Vault key + security-definer RPCs, so even Supabase itself can't read
    the plaintext) were built by an **earlier, undocumented session**
    (last touched 2026-08-05) with a full CRUD layer in `src/services/`,
    but were never connected to the app and never written up here — pure
    dead code until this session found and finished it. **Confirmed live**
    on the Tessera project (all 16 tables present, checked directly via
    the SQL Editor) before wiring anything. Every relevant `AppContext.jsx`
    action now fires a best-effort dual-write to the matching table
    (`syncNormalized()` helper — silently no-ops unless signed into Cloud
    Sync, catches and logs failures, never surfaces them to the user or
    touches local state) alongside the existing whole-blob write. **The
    whole-blob `app_data` sync above is untouched and remains the actual
    source of truth** for local state, cross-device sync, and
    Export/Import — this normalized layer is a purely additive mirror,
    not a replacement. A few service-layer gaps got filled while wiring
    this up: delete functions were missing for 6 of the 9 plain tables
    (added, keyed on `client_id`), and the three encrypted-table delete
    functions took the row's own Supabase-generated id, which the app
    never actually has — switched to `client_id` too. A one-time
    **"Backfill existing data"** button (Settings → Cloud Sync, shown
    once signed in) pushes everything logged before this session into
    the same tables; safe to re-run since every write is an upsert or a
    no-op-on-conflict insert. **Why keep both systems**: this was scoped
    as "finish what was already half-built," not a deliberate architecture
    decision to move away from whole-blob sync — if asked to go further
    (e.g. read from the normalized tables instead of local state, or
    retire `app_data`), that's a much bigger, separate undertaking with
    real risk to live data, not a natural next step to take unprompted.
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
- **One visual style ("Richting E"), colour theme selectable** — see
  Design system below. The earlier Classic/Fintech style switch, light/
  dark theme, wallpapers, colour pickers, font and density options were
  **all removed on 2026-09-29 at the user's explicit request** ("oude
  design en kleur mag je allemaal volledig verwijderen"), along with
  Fintech's alternate Overview (`OverviewTerminal`, WalletRail,
  FlightDial, WeeklyManifest, BoardingPass, PassportStamp). Don't bring
  any of it back; old saved settings keys are stripped on load
  (`RETIRED_SETTINGS` in `AppContext.jsx`).
- **The Character System** (`characterEngine.js` + `ElementalCreature.jsx`
  + `CharacterCard.jsx` + `CharacterOnboardingSheet.jsx`) replaced the
  earlier Spark mascot and Companion State daily-mood card **entirely** —
  one companion now, chosen once at onboarding, shown on Overview. This went
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
    other eight each got a second pass in a later session (forge-glow/
    fuller for Warrior, bark/roots for Nature, floor-glow/vents for Robot,
    a tail for the fox, layered inner petals for Plant, wing membranes/
    horns for Dragon, a wisp tail for Spirit, extra motion trails for
    Athlete) — still one notch below Fire/Moon's iteration count, but no
    longer a single bare pass. Worth another look only if the user asks
    for more, not proactively.
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
    the existing 5-item daily checklist (`NUTRITION_KEYS`) still drives
    growth — the newer per-meal macro logging (see "Meal macro tracking"
    below) exists as a separate, real number the user can see, but nothing
    wires it into `characterEngine.js`'s weighting yet. That's a plausible
    next step, not done.
- **Meal macro tracking** (`mealAnalysis.js`, `data.meals`, Nutrition
  page's "Log a meal" sheet): real per-meal calories/protein/carbs/fat,
  distinct from the older 5-item nutrition checklist proxy. One Claude
  call (vision, when a photo is attached) estimates macros from a name
  and/or photo — mirrors the voice-logging pipeline's pattern (strict-JSON
  system prompt, always returns a best-guess estimate with a confidence
  level rather than refusing on thin input). Gated on `hasApiKey()`, same
  optional-AI pattern as voice logging. Rides the existing whole-blob
  Supabase sync automatically (`data.meals` is just another top-level
  array) — no new table.
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

## Day replanning & pantry ("smart day" assistant, no-AI layer)

The user asked (2026-09-29) for an assistant that replans the fixed day
around last-minute appointments (agenda + travel time) and swaps meals
to what's at home when a shopping trip falls through. Scoped in three
phases; **this session built everything that doesn't need an API key**,
fully rule-based:

- **`data.dayOverrides`** (`{ [date]: { tasks?, appointments?, meals? } }`)
  — a per-date deviation from the weekly template. `getTasksForDate` /
  `getMealsForDate` / `dayMeetsThreshold` take it as an optional last
  arg; every caller passes `data.dayOverrides`. The weekly template is
  never modified by a replan. Moved tasks keep their ids so completions,
  push dedup and Calendar event ids carry over.
- **`utils/dayReplan.js`**: `replanDay()` moves colliding tasks to the
  nearest free slot (training first, then meals with a 60-min gap and a
  max 150-min shift, else "meenemen"; training falls back to a 30-min
  version before being dropped), always recomputed from the *template*.
  `parseAppointmentText()` regex-parses Dutch phrasing ("van 17:30 tot
  19:00 etentje in Amsterdam, 30 minuten rijden").
- **`DayReplanSheet.jsx`** (from TodayTasks "+ Afspraak / dag
  aanpassen"): dictate/type → form → optional import of today's Google
  Calendar events (`fetchEventsForDate`, filters out the app's own
  synced tasks) → editable preview → apply. Travel time is **manual** for
  now — the Maps/routing phase is not built.
- **`utils/pantry.js` + More → Voorraad & Menu (`Pantry.jsx`)**:
  `data.pantry`, keyword matching of the free-text rotation meals
  against it (synonyms, generic "groenten"/"fruit", dish-name bases like
  kipwrap → wrap), swap suggestions from the *same slot of the user's
  own rotation* (keeps calories roughly on target without macro math),
  and a 7-day shopping list. Heuristic by design — the UI always shows
  have/missing so the user can judge.
- `DictateButton.jsx`: Dutch (`nl-NL`) SpeechRecognition mic; hidden on
  Safari/iOS, where the keyboard's dictation mic is the fallback.
- **Edge Functions `send-due-notifications` and `sync-calendar-tasks`
  were updated in source to honor `dayOverrides`, but must be redeployed
  via the Supabase Dashboard** (no CLI auth) — until then push fires at
  template times on replanned days.
- **AI layer (built 2026-09-29, once the user had created an Anthropic
  key)**: `utils/smartDay.js` — `aiReplanDay()` (free-form Dutch sentence
  + template + known appointments → full replan incl. **Claude-estimated
  travel time** from `settings.homeLocation`, flagged `travelEstimated`)
  and `aiMealIdeas()` (3 pantry-based meals near the planned meal's
  kcal/protein). Both use **structured outputs** (`schema` param on
  `sendToClaude` → `output_config.format`), and the reply is still
  validated against real task ids / HH:MM before use. The AI proposal is
  dropped (rule-based planner takes over) as soon as the user edits
  appointments by hand, so the preview never disagrees with the list.
  Tested only against a mocked fetch — no real key in the dev env.
- `sendToClaude` also gained `effort` (skipped for Haiku, which rejects
  it) and refusal / max_tokens handling. Model picker moved to Sonnet 5.5
  (default) / Haiku 4.5 / Opus 5.5, with old saved values mapped forward
  (`LEGACY_MODELS`).
- **Real route travel time (built 2026-10-01)**: `utils/routing.js`,
  OpenRouteService, BYOK (`lifestyle-tracker-ors-key`, secret-sync slot
  `ors`; Settings → "Reistijd (route)" with key, vertrekpunt and
  `settings.travelMode` auto/fiets/lopen). `fillRouteTravel()` chains
  home → appt → … → home (direct between appointments < 2 h apart, else
  via home), resolves saved place names/"thuis", caches geocodes in
  localStorage, rounds up to 5 min, never throws (returns `error`).
  It only overwrites travel that is empty/0, `travelEstimated`, or
  `travelSource: 'route'` — anything typed/edited is `travelSource:
  'manual'` and left alone. Wired into DayReplanSheet (auto after add /
  agenda import, a "Reistijd berekenen via route" button; in AI mode
  known appointments are routed before the call, new ones after, and if a
  route is *longer* than the AI guess the AI replans once more with the
  route numbers marked fixed) and into voice appointments (applied at
  once, re-applied silently when the route returns). Tested with mocked
  fetch + a Playwright smoke test only — the sandbox can't reach
  api.openrouteservice.org and there's no real key yet. ORS has no public
  transport profile. **Needs once in Supabase**: re-run
  `supabase/user_secrets.sql` (widens the name check to allow `ors`),
  otherwise key sync for this one key just logs a warning.

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
  Dashboard's Edge Function secret `VAPID_PRIVATE_KEY` themselves.
  **Confirmed set in a later session** (checked the Supabase Secrets page
  directly — it was genuinely missing, which is exactly why push had never
  fired; the user gave explicit go-ahead to paste it in, mirroring the
  same "never type a secret without asking" rule). If push still isn't
  arriving, check next: the user is on the installed home-screen PWA (not
  a Safari tab), has tapped "Meldingen inschakelen op dit apparaat", and
  `cron.job_run_details` in Supabase for actual invocation errors.
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

## Automatic Google Calendar sync

A second exception to "no custom backend," same reasoning as push
notifications: the existing manual Calendar sync (see Architecture above)
only ever has a short-lived, in-memory access token — nothing a
background job with the browser closed can use. Automatic sync needed a
Google **refresh token**, which only comes from the authorization-code
flow, exchanged server-side with a client secret that can never live in
the browser.

- **Google Cloud setup, done from scratch in this session** — the
  project had never been configured before this, despite the manual
  Calendar feature existing in code (CLAUDE.md previously said "still not
  configured on the user's live site," which was accurate). New Google
  Cloud project **"Lifestyle Tracker"** (`eighth-service-508709-n0`),
  Calendar API enabled, OAuth consent screen configured (External /
  Testing mode — a personal Gmail account can't use Internal, which needs
  a Workspace org; the user's own email is added as the one test user),
  and a **Web application** OAuth client (`465688798119-
  td67kk2kealvlj1gjdtj6snon20m0dbc.apps.googleusercontent.com`,
  authorized JavaScript origin `https://hosnaaalmasii-commits.github.io`).
  The ToS acceptance and the "buy usage credits"/billing screens were
  explicitly left to the user to click through themselves — Claude
  navigated everything else (Skip for now was used to bypass billing
  entirely; it isn't needed just to create OAuth credentials).
- **`src/utils/googleCalendar.js` — `requestGoogleAuthCode()`**: Google
  Identity Services' **popup code-client** flow (`initCodeClient`),
  separate from the existing token-client flow the manual connect/sync
  uses (that one is untouched). Returns a one-time authorization code,
  not a token.
- **`supabase/functions/google-oauth-exchange`**: JWT-verified Edge
  Function (needs to know *which* user is connecting, so unlike push
  notifications it must be called with the user's own Supabase session
  token) that exchanges the code for a refresh token via
  `https://oauth2.googleapis.com/token` — `redirect_uri: 'postmessage'`
  is Google's documented literal string for the GIS popup flow, not a
  real URL — and stores it in a new `google_calendar_tokens` table.
  `GOOGLE_CLIENT_SECRET` is the one Supabase secret this needs (and
  `sync-calendar-tasks` below reuses the same value); the Client ID
  itself isn't secret, so it's passed in the request body instead of
  duplicating it as a second Supabase secret.
- **`supabase/functions/sync-calendar-tasks`**: JWT verification **OFF**
  (same reasoning as `send-due-notifications` — only ever invoked by
  pg_cron inside this project), runs **once daily** via
  `supabase/calendar_auto_sync.sql`'s cron job (`sync-calendar-tasks-daily`,
  06:17 UTC — deliberately not once a minute like push notifications,
  to stay well inside Calendar API rate limits and minimize the
  whole-blob-write race window against a device actively using the app).
  For every stored refresh token: mints a fresh access token, reads that
  user's `taskSchedule` from `app_data`, upserts the next 7 days of
  Calendar events (a Deno port of `syncTasksToCalendar`'s logic — this
  function can't import the Vite app's `src/` modules directly), writes
  the updated `googleCalendarEventIds` map back.
- **`supabase/calendar_auto_sync.sql`**: creates `google_calendar_tokens`
  (`user_id` primary key, `refresh_token`, RLS enabled) and the cron
  job. **One client-facing RLS policy on purpose**: a signed-in user can
  `delete` their own row (self-revoke, via the normal supabase-js client
  respecting RLS — `disableCalendarAutoSync()`), but there's no
  select/insert/update policy — writing the refresh token only ever
  happens through `google-oauth-exchange`'s service-role client, which
  bypasses RLS entirely.
- **`enableCalendarAutoSync`/`disableCalendarAutoSync`** (`AppContext.jsx`)
  and a **"Automatic sync" toggle** (Settings → Google Calendar, below
  the existing manual sync button) — gated on being signed into Cloud
  Sync, same reasoning as push notifications (a server job needs
  somewhere to look up whose schedule to sync).
- **Everything above was deployed and smoke-tested successfully**
  (`sync-calendar-tasks` invoked directly, returned `{"synced":0,"note":
  "no connected accounts"}` as expected with nobody connected yet). **Not
  yet confirmed working end-to-end**: the user hit `401 — the OAuth
  client was not found` when actually trying to connect from the app.
  The client genuinely exists (re-checked directly in Google Cloud
  Console right after the error) — most likely cause is Google's own
  documented propagation delay ("5 minutes to a few hours to take
  effect" per the console's own warning, and the client was only a few
  minutes old when the error hit). **If this comes up again: first ask
  the user to retry**, then double-check the pasted Client ID matches
  exactly (no truncation/whitespace) before assuming anything is broken
  server-side — the backend itself is confirmed deployed and correct.

## Design system

- **The style ("Richting E", chosen 2026-09-29)**: designed first in the
  user's Figma file (see memory / `reference-figma-design-file`; section
  "Richting E") from a dark purple chat-app reference the user picked.
  Near-black background with a soft coloured radial **glow** at the
  bottom of every screen (`body::before` in `global.css`), dark cards
  with a thin border, **filled pill** primary buttons in `--accent`,
  **outlined pill** chips/secondary buttons in a *second* colour
  (`--second`), Plus Jakarta Sans for everything (headings 800 weight).
- **Colour themes** (`utils/colorThemes.js`, Settings → Kleur): Paars
  (default), Warm, Neon — same style, different colours. Each theme sets
  the full variable set (bg/surface/text/accent/second/glow/category
  colours), pushed onto `<html>` by one effect in `AppContext.jsx`
  (`settings.colorTheme`). `theme.css` holds the Paars values as the
  pre-JS fallback. Adding a theme = one more entry in `COLOR_THEMES`.
  **Exception to the CSS-variable pattern**: each Character System
  archetype's palette is hardcoded per-icon inside `ElementalCreature.jsx`
  (real-fire colors, real-moon colors, etc.) — deliberate.
- **Overview layout** follows the Figma mockup: greeting with avatar
  (`settings.displayName`, optional), one hero card with the *task* day
  score ring + streak chip, a row of quick-action pills, three stat cards
  (water/sleep/protein), the Vandaag checklist (`TodayTasks`), the
  companion, a coach prompt bar, then quieter secondary info.
- **The other Figma pages are built to match their mockups** (the user
  explicitly rejected pages that only inherited the colours — "ik wil
  die pagina's en indeling ook gelijk als op Figma"): **Voeding** is now
  a tab (`pages/Voeding.jsx`, replacing Progress in the tab bar; progress
  photos moved to More → Voortgangsfoto's) — week day pills, kcal/macro
  card from logged `data.meals`, one card per rotation meal with an
  in-huis/mist pantry chip, kcal/protein per dish AI-estimated once and
  cached in `data.mealEstimates`, tap → "Gegeten" logs it. **Training**
  (`Workouts.jsx`) follows the *transformation plan's* training task for
  whether/when you train (the generated workout only supplies exercises —
  the two used to disagree), hero card + 3 stats + week dots +
  exercises. **Coach** is a chat with orb header, bubbles, quick-reply
  pills (one opens the replan sheet) and a pill input. **Je figuurtje**
  (`pages/more/Companion.jsx`, opened by tapping the small
  `CompanionTile` on Vandaag).
- **Vandaag extras the user asked back** (after the strict-mockup pass):
  flame streak chip, the larger `CharacterCard`, Insights, and the
  level / GPS phase / micro-habit card sit below the coach bar. Greeting
  shows `settings.displayName`, else the Cloud Sync email's first part.
- **Voice input from the sparkle avatar** (Vandaag, `VoiceLogSheet`):
  `voiceLogging.js` now also handles sleep, weight, `food` (named meal +
  estimated macros → `data.meals`), `appointment` (appends to today's
  `dayOverrides` and re-runs `replanDay`), `place` (→ `data.places`,
  "home" also sets `settings.homeLocation`; places feed `aiReplanDay`),
  `task_done` (matched against today's task ids sent in the prompt) and
  `note`. "Praat met de coach" hands the text to Coach via
  sessionStorage `COACH_PREFILL`.
  **Saving is direct (2026-09-30)**: parsed entries are written straight
  away and the sheet shows where each landed (`CATEGORY_DESTINATION`);
  the review list only appears when a follow-up question is needed.
  Without an API key (or when the call fails) `utils/localVoiceParser.js`
  does the parsing rule-based: a ~60-item Dutch/English food table with
  per-portion kcal/macros (quantities and grams scale it), water/coffee,
  alcohol, sleep, weight, mood, workout/PR, expenses, task-done matching;
  anything unplaced becomes a note.
- **Coach voice** (`utils/speechOutput.js`, browser `speechSynthesis`,
  no key/service): mic in the input bar (sends on stop), a speaker toggle
  in the header (read typed replies aloud), "Voorlezen" per reply, and
  "Praat met je coach" — a hands-free loop (listen → reply → speak →
  listen) in a Sheet. Anything spoken gets a short spoken-style reply
  (`SPOKEN_STYLE` prompt suffix). `unlockSpeech()` must run inside a tap
  for iOS to allow the later async speech. The loop needs
  SpeechRecognition, so it's hidden on Safari/iOS; read-aloud still works
  there. **Voice choice** (`CoachVoicePicker.jsx`, Settings → AI Coach
  and "Stem kiezen" in the talk sheet): device voice + speed, per device.
- **ElevenLabs** (`utils/elevenLabs.js`, added 2026-09-30 at the user's
  explicit request for "echt goede en natuurlijke stemmen" — a **fifth**
  BYOK external service, chosen over OpenAI TTS and the free Edge/iOS
  premium-voice route). Key in its own localStorage slot
  (`lifestyle-tracker-elevenlabs-key`), never in `data`/export, wiped by
  Clear everything — same trust model as the Anthropic key. With a key,
  `speak()` plays ElevenLabs mp3 (voice list from `/v1/voices`, model
  multilingual_v2 "Mooiste klank" or flash_v2_5 "Snelste reactie");
  on any failure it falls back to the device voice and reports why.
  `unlockSpeech()` also primes a shared `<audio>` element for iOS.
  Tested only against a mocked fetch — no real key in the dev env.
- **OpenAI TTS** (`utils/openaiTts.js`, same day — a **sixth** BYOK
  service, user asked for both): `gpt-4o-mini-tts`, 13 fixed voices
  (marin/cedar recommended), ~1.5 ct/min, pace + coach tone via
  `instructions` (the model ignores `speed`). Key in
  `lifestyle-tracker-openai-key`. The user picks the provider in
  `CoachVoicePicker` — Toestel / OpenAI / ElevenLabs
  (`lifestyle-tracker-coach-voice-provider`; unset + ElevenLabs key =
  ElevenLabs for backward compat). A cloud provider without a key or
  with a failing call falls back to the device voice.
  **Tempo** is applied at playback for OpenAI/ElevenLabs
  (`audio.playbackRate` + `defaultPlaybackRate`, `preservesPitch`) —
  asking the services for a speed was barely audible (user complaint);
  device voices use `utterance.rate`. 5 steps 0.75–1.3.
  **Conversation language** (`SPEECH_LANGS`, `lifestyle-tracker-speech-lang`,
  "Taal van het gesprek" in the picker; default = app language): used for
  speech recognition (DictateButton, VoiceLogSheet, coach), for TTS, and
  as `sendToClaude({ language })` so the coach replies in it.
- **Coach face — preset people in a glass arch** (`utils/coachAvatar.js`,
  `CoachPortrait.jsx`, `CoachAvatar.jsx`, `CoachAvatarPicker.jsx`;
  2026-09-30). `data.settings.coachAvatar` = `{ type: 'preset', id }`
  (six AI-generated people the user hand-picked from a Pixabay gallery —
  Sofie, Lina, Lucas, Daan, Sem, Thomas — in `public/coaches/`, resized to
  ≤1000 px JPEG with sharp; Pixabay Content License, no attribution
  required, no real people), `{ type: 'photo', image }` (own upload, 3:4
  JPEG data URL, synced) or null = the orb. `CoachPortrait` renders the
  person waist-up in a glass arch on deep purple (the user's reference
  image), above the chat (tap = start talking) and big in the talk sheet;
  it breathes / glows while speaking (`.coach-arch` in motion.css) — no
  lip movement. `CoachAvatar` is the small round face-zoomed version
  (per-preset `face` focus point).
  **Rejected on the way, don't re-propose without a new reference**:
  DiceBear drawn avatars ("te cartoon"), a free talking 3D person via
  TalkingHead/Ready Player Me ("niet mooi", game-like), a round-cropped
  photo ("te koud"), and a free in-browser mouth animation (mesh warp over
  MediaPipe landmarks — "mondbeweging niet goed"). LivePortrait video
  loops were tried next: the Hugging Face Spaces need 360 s of ZeroGPU
  (free tier can't), and on the user's PC (Ryzen 5 7530U, no NVIDIA) one
  7-second video took 20+ min on CPU — stopped and fully uninstalled at
  the user's request. **Open lead: Spatius** (spatius.ai — on-device 3D
  Gaussian-splat avatars with real lip-sync, BYO TTS incl. ElevenLabs, web
  SDK, free plan ~12k credits/yr). Waiting on the user to create a free
  account; unknowns: custom avatar from a photo on the free plan,
  watermark, whether it needs a server-side token (would go in a Supabase
  Edge Function). Brief: "realistisch, classy, rustgevend, dat ik de
  neiging heb om mee te praten", **nothing paid**.
- **Coach memory** (`utils/coachMemory.js`, `CoachSettingsSheet.jsx`,
  2026-09-30): the conversation lives in `data.coach.messages` (synced,
  last 300; was per-browser localStorage, migrated once on first open),
  and every 3 user messages — plus when a spoken conversation ends — one
  Haiku 4.5 call (structured output) rewrites `data.coach.memory`, a list
  of ≤50 durable facts about the user. Each reply gets the last 30
  messages + those facts + the coach's name (`coachName()`:
  `settings.coachName` or the preset's name) + the data snapshot, which
  now also covers today's plan tasks, food vs. calorie/protein targets,
  recent notes and body measurements (`coachContext.js`). Coach page →
  tap the coach (face/name — **no gear or speaker buttons, and no coach
  pickers in Settings: the user wants only the coach on screen**) →
  "Coach instellen" (also reachable, tucked away, as menu → Account → "Je
  coach instellen" = More view `coachsettings`): Claude key (first, while
  missing), read-aloud switch,
  Gezicht & naam / Stem / Geheugen (see
  and delete facts, "Gesprek wissen", "Alles vergeten"). Mic errors
  (`micErrorText()` in speechInput.js) now show a clear message instead of
  failing silently.
  The spoken conversation is a full-screen view (`CoachTalkView.jsx`,
  portal): portrait centred with a slow drift/zoom + breathing/glow, and
  captions typed out underneath — the user's words live, the coach's reply
  in step with `getSpeechProgress()` (typewriter fallback). The service
  worker now also checks for updates when the app returns to the
  foreground and every 30 min (`main.jsx`) — an open pane/PWA kept showing
  an old build after deploys.
  A second launch config `vite-preview-build` (port 4173) serves the
  production build — use it for anything that might differ once bundled.
- **API keys sync across devices, encrypted** (`utils/secretSync.js`,
  `supabase/user_secrets.sql` — **run and confirmed on Tessera 2026-09-30**).
  User request ("ik moet elke key telkens opnieuw ingeven"), knowingly
  changing the old "keys never leave the device" rule: keys still live
  and are used from their own localStorage slots and are still never in
  `data`/export, but while signed in to Cloud Sync each one is also stored
  in `user_secrets` (pgp_sym_encrypt with the existing Vault key, only
  reachable via `set_user_secret`/`get_user_secrets` RPCs acting as
  auth.uid(); no select policy at all). On sign-in: missing local keys
  are filled, local-only keys uploaded; setters push changes (debounced);
  Clear everything also deletes the synced copies. The built-in browser
  pane loses localStorage when previews restart — that, not a bug, was
  why keys "kept disappearing" there.
- **Spending guard** (`utils/usageGuard.js` + Settings → Kostenlimieten,
  2026-09-30, user asked for "absoluut nergens onverwachte kosten"):
  per-device monthly ceilings checked *before* every paid call — Claude
  $ (from response `usage` × list price, default $2), OpenAI TTS $
  (default $1), ElevenLabs characters (default 10k) — plus Claude caps of
  150 calls/day and 20/minute against runaway loops. Limit 0 = blocked.
  The automatic translation calls (`tx.js`, `useContentT.js`) now try
  each string at most twice per session instead of re-queuing forever.
  Automatic (non-tap) Claude calls in the app: those translations and
  Voeding's one-time kcal estimate per dish; everything else is user-
  initiated. `sendToClaude` defaults to effort `low` and ≥2048
  max_tokens (Sonnet/Opus 5.5 always think; a tiny cap returned only a
  thinking block → "empty response").
- **Motion** (`src/styles/motion.css`, `utils/useCountUp.js`): staggered
  `.page > *` rise-in, breathing bottom glow, bar-grow on `.xp-bar-fill`,
  ring sweep from 0 (Ring uses setTimeout, not rAF — rAF is paused in a
  background tab and left it stuck), count-ups with a hidden-tab/timeout
  fallback, check-dot pop + tick draw, tab-dot pop, sheet spring, sparkle
  halo (`.speak-btn`), companion float (`.float-soft`), flame flicker. All
  disabled under prefers-reduced-motion.
- **Figma**: section "App — huidige versie (bewerkbaar)" (node 15:2) holds
  the current screens as editable layers bound to the "Kleuren" variable
  collection (modes Paars/Warm/Neon). Workflow: user edits there, sends a
  frame link, Claude implements it.
- **Languages** (`src/i18n/index.js` + `useT()` hook, Settings → Taal):
  nl (default) / en / fr / de / es. Every string is one key with five
  versions in that fixed order; dates use `Intl` with the language's
  locale. `claudeApi.setAiLanguage()` (set from an AppContext effect)
  makes every Claude reply come back in the chosen language. Three layers:
  1. **Hand-written dictionary** (`t()`): tab bar, menu, Vandaag, Voeding,
     Training, Water, Slaap, Coach, companion, Settings' top.
  2. **Plan content** (`i18n/content.js` + `useContentT().tc()`): fixed
     tables for the seeded task labels and all 50 companion stage names;
     meals/exercises/workout hints are AI-translated once and cached.
  3. **Everything else** (`i18n/tx.js`, `tx("…")`): all menu sub-pages,
     sheets and Settings' long text were wrapped by the codemod
     `scripts/wrap-tx.cjs` (JSX text, text-ish attributes, ?:/&& string
     results, `.label`/`.desc`/`.headline`-style members with
     `WRAP_MEMBERS=1`). Strings are batch-translated by Claude and cached
     in `data.contentTranslations[lang]` (shared with layer 2). Needs an
     API key; without one the original text shows. **For new UI**: use
     `t()` for main screens, or run the codemod on the file.
  User-typed content (notes, pantry items, recipe names) is deliberately
  left untranslated. The dev server here repeatedly served stale module
  transforms after edits — restart it (preview_stop/start) before
  concluding an edit didn't take.
- **Icons: `src/components/Icon.jsx`, a hand-drawn line-icon set
  (~55 icons, including `mic`), replacing emoji throughout the app.**
  Consistent stroke weight (1.7), 24×24 viewBox, `currentColor`. When
  adding new UI, use an existing `Icon name="..."` where a reasonable
  match exists before inventing a new glyph. Persisted mood values
  (`data.mood[].emoji`) are still raw emoji strings for backward
  compatibility — only the *display* layer maps them to icons; don't "fix"
  the stored format.
- **"Wall of same-weight cards" is a recurring visual complaint — the fix
  pattern, not just a one-off Overview change.** The user sent screenshots
  of the Oura app as a concrete reference (per the Character System note
  above, concrete references converge fast; abstract adjectives don't) and
  named what Oura does that this app didn't: one dominant hero number with
  generous whitespace, everything else quiet, never many same-weight
  bordered boxes stacked with equal visual priority. Applied to Overview:
  the hero score ring got bigger/more padded to stay the obvious focal
  point (`Ring` 168px → 196px, the number 36px → 54px); several groups of
  small "icon + one line + chevron" cards that used to each be their own
  bordered `.card` (calendar status/level bar/GPS phase; the At-a-glance
  mini stats; the Today's-focus water/sleep/workout rows) were collapsed
  into **one shared `.card` with a thin divider between rows/columns**
  instead — same info, far fewer competing borders/shadows. `MiniCard`
  and `SummaryRow` both dropped their own card chrome and take a
  `divider` prop for this. The default `.card + .card` gap
  (`global.css`) also went from 12px to 20px, app-wide. **Reuse this
  divided-single-card pattern** the next time a page reads as "too many
  boxes" instead of introducing a new visual treatment — it's now the
  established fix, not a one-off.

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

**A later session, same Windows PC, different harness** (Claude Code
desktop app rather than the surface used above) found `git` genuinely
installed but **not on PATH for this shell** — don't conclude it needs
`winget install` again. It's at
`$env:LOCALAPPDATA\Programs\Git\cmd\git.exe`; call it via
`$git = "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"; & $git <args>`
rather than a bare `git` command. Also true in this harness:

- **The desktop app's "Claude in Chrome" browser tool runs on this same
  machine** — a file it downloads (e.g. a Google Cloud "Download JSON"
  for an OAuth client secret) lands in the normal Windows Downloads
  folder and is readable with the regular file-reading tool immediately
  after. Delete it once the value is captured — don't leave a secret
  sitting in Downloads as plaintext.
- **Navigating a Claude-in-Chrome tab away from a page with unsaved
  edits (e.g. the Supabase SQL Editor with an untyped query) throws a
  "Leave site?" block**, and a `force` navigation flag did not bypass it
  in practice. Opening a fresh tab instead of reusing the stale one was
  the reliable fix every time this came up.
- **The `computer` screenshot action in that same browser tool
  intermittently timed out** (`CDP sendCommand "Page.captureScreenshot"
  timed out`) on otherwise-fine pages, especially right after a click.
  A bare retry of the same screenshot call, or falling back to
  `get_page_text`/`read_page` for that step, worked every time — this
  wasn't a sign the page or action had actually failed.
- **This harness's own dev-server error/log tool (`preview_logs`)
  returned one specific stale cached error message repeatedly, unchanged
  timestamp, across multiple full page reloads and re-checks**, well
  after the underlying syntax error had actually been fixed and
  confirmed fixed via DOM checks and screenshots. This is the same
  known-stale-tooling class documented earlier in this file for a
  different harness — same fix: trust a direct DOM check
  (`document.body.innerText.includes(...)`, a real screenshot of
  rendered content) over what the log tool reports before concluding a
  fix didn't take.

## Current status (as of this note)

**Latest (2026-10-01 session)**: OpenRouteService route travel time
(see "Real route travel time" under the smart day planner), on branch
`claude/gifted-fermi-c120i6`. Still open: redeploy the two Edge
Functions via the Supabase Dashboard (no CLI auth here), re-run
`user_secrets.sql`, and a real-key test of auto-translation, voice
parsing and routing.

**Latest (2026-09-29 session)**: day replanning + pantry (rule-based and
AI layers), the Google Calendar Client-ID and `freeBusy` fixes, and a
full redesign to the single "Richting E" style with Paars/Warm/Neon
colour themes (Classic/Fintech/wallpapers removed). **Next up**: build
the Voeding, Training, Coach and companion page layouts from the Figma
mockups; redeploy the two Edge Functions so push/auto-sync honour
`dayOverrides`. Older notes below describe earlier sessions — where they
mention Fintech, wallpapers or colour pickers, that's history.

Everything is **committed, pushed, and deployed** to `main`. This note's
session shipped, in order: the wallpaper feature (real-photography
backgrounds, dark-palette-forced-under-wallpaper fix, the
`--accent-contrast` contrast fix, translucent-not-solid buttons), a fix
confirming and setting the previously-unconfirmed `VAPID_PRIVATE_KEY`
secret (push notifications should now actually fire), Fintech's
`OverviewTerminal` now showing `TodayTasks`, a second visual pass on the
eight less-polished Character System archetypes, real per-meal macro
tracking (`data.meals`, AI-analyzed from name/photo), a full **automatic
Google Calendar sync** build (new Google Cloud project + two new Edge
Functions + new Supabase table — deployed and smoke-tested, but not yet
confirmed working end-to-end, see "Automatic Google Calendar sync"
above), and an Overview-page hierarchy pass referencing the Oura app
(hero ring enlarged, several card groups consolidated into single
divided cards — see the "wall of same-weight cards" note in Design
system above).

**Two genuinely open items from this session** (not bugs, just
unfinished):
1. **Automatic Calendar sync isn't confirmed working yet** — the user hit
   a `401 OAuth client not found` error connecting from the app,
   most likely Google's own propagation delay on a brand-new OAuth
   client (created minutes before the error). Ask the user to retry; see
   "Automatic Google Calendar sync" above for the full troubleshooting
   note before assuming anything is broken server-side.
2. **Anthropic API key: the user created one on 2026-09-29** (walked
   through console.anthropic.com themselves; advised $5 credit,
   auto-reload off, a monthly limit). It lives per-browser, so it has to
   be pasted into Settings → AI Coach on each device (iPhone and PC)
   separately.

Also discovered (not caused) in an earlier session: the user's Supabase
project "Tessera" had **auto-paused from inactivity**, which is why it
looked empty on first glance — once resumed, the whole schema was
already live with real synced data. Don't re-run schema-setup SQL files
from scratch if this comes up again, just check whether the project
needs resuming.

Shipped and stable from earlier sessions, on top of the prior feature
set: voice logging works with zero API key configured (mic + "Save as
note" → `data.notes`, AI parsing is an optional upgrade layer);
Hydration Autopilot; cycle-aware coaching; Cloud Sync (fully configured
and verified on the user's own live Supabase project); the full
Character System, replacing Spark and Companion State; the full
transformation-plan tracker (task schedule, meal rotation, push
notification backend, manual Calendar write-sync, Oura integration,
progress rollup).

## Next steps

1. **Follow up on the automatic Calendar sync 401** — ask the user to
   retry connecting now that time has passed since the OAuth client was
   created. If it still fails, re-verify the exact Client ID pasted into
   the app matches `465688798119-td67kk2kealvlj1gjdtj6snon20m0dbc.apps.googleusercontent.com`
   before assuming the backend is broken (it was smoke-tested and works).
2. **If the user wants AI features (Coach, meal-photo analysis, AI voice
   parsing) working**, they still need to create and paste in an
   Anthropic API key — this was scoped and explained but deliberately
   not done. Don't create one without the user explicitly asking again.
3. Not yet requested, but a plausible next ask given the pattern so far:
   wiring the new real meal-macro data (`data.meals`) into the Character
   System's growth weighting as a second nutrition signal alongside the
   existing 5-item checklist proxy — or extending the voice pipeline to
   also cover weight/sleep intents.
4. If asked to deepen the Character System's visuals further, or change
   the app's look: get a concrete reference (named app/brand/image)
   before building — abstract adjectives alone have repeatedly taken
   many rounds to converge (six rounds for the original Character System
   direction; the Oura screenshots this session are the model for how a
   concrete reference should look going in).
5. **Re-confirm with the user, on both their iPhone and PC**, that
   companion onboarding/interaction still works correctly after the
   `position:fixed` portal fix from an earlier session — this was
   diagnosed and fixed via a screenshot rather than a live confirmed
   retest, and it's easy for this to get lost among newer work.
