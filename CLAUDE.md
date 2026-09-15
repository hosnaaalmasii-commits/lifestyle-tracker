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
- **Wallpaper** (`Wallpaper.jsx` + `Wallpaper.css`, toggled in Settings →
  Wallpaper, applies to every page — the user's explicit choice when this
  was scoped): three real-photography backgrounds (Stars/Sea/Rain, all
  Unsplash, license-verified "Free Photo" before downloading, resized/
  compressed via `scripts/optimize-wallpapers.mjs`), went through many
  rounds of "make it more realistic/darker/more cohesive" before landing.
  Load-bearing details, not stylistic:
  - **DOM-order stacking, not `z-index`**: `#wallpaper-root` is the first
    child of `<body>` in `index.html`, before `#root`, so the wallpaper
    paints behind everything by plain paint order. A negative `z-index`
    was tried first and proved unreliable for full-page-behind-content
    stacking in this environment — don't revert to it.
  - **A wallpaper forces the dark palette, regardless of the user's own
    Light/Dark/System theme choice** (`global.css`,
    `:root[data-wallpaper]:not([data-wallpaper="none"])`, higher
    specificity than `:root[data-theme="light"]`). Found from a real bug
    report: Light theme's cream `--surface`/dark `--text` values, read by
    the same translucent-card and on-wallpaper-text rules, produced pale
    washed-out cards and invisible dark-on-dark headings over a night-sky
    photo. Wallpapers were always meant to be a dark, moody look on
    purpose — this makes that true unconditionally instead of only when
    the user happens to also have Dark theme selected.
  - **Every wallpaper shares one neutral off-white accent** (`Wallpaper.jsx`,
    `NEUTRAL_ACCENT`), not a per-photo matched color — an earlier version
    used saturated per-photo colors (gold/teal/amber) and every button/
    ring/tab across the whole app read as that one color, which the user
    flagged as "everything is orange." The neutral accent fixed that but
    created a second problem: hardcoded `color: #fff` text (on
    `.btn-primary`, `.chip.selected`, the Settings segmented-control
    active state, the Coach chat bubble, tags, the voice-log mic button)
    went illegible on a near-white background. Fixed once, centrally, via
    a **`--accent-contrast` CSS variable** (`theme.css` default `#fff`,
    overridden to a dark color by the same wallpaper-active block in
    `global.css`) — every accent-background element reads this instead of
    hardcoding a color, so a future accent-background component gets
    correct contrast for free instead of needing its own fix.
  - **Filled buttons/chips go translucent-dark under a wallpaper, not a
    solid accent fill** — after the contrast fix made them legible, the
    user still flagged them as a stark bright block against the otherwise
    all-dark UI (screenshotted against the Oura app as the reference for
    "how this should look" — see the Overview hierarchy note in Design
    system below for the same reference point reused). `.btn-primary`/
    `.chip.selected`/`.segmented-btn.active` get a `[data-wallpaper]`-scoped
    override to the same translucent-card treatment as everything else,
    with the accent surviving only as a subtle border/tint.
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
2. **No Anthropic API key is configured on the user's live site** — the
   user asked to set one up, got as far as understanding the cost
   (Claude API billing is separate from any Claude.ai subscription;
   realistic personal use of this app's AI features is roughly $1-2/
   month on Sonnet 5, under $1 on Haiku 4.5) and explicitly said to hold
   off before a key was actually created. Nothing was created — pick this
   back up only if the user brings it up again. Without a key, AI Coach,
   meal-photo macro analysis, and voice-logging's AI-parse step are all
   inactive (the app degrades gracefully — manual logging and everything
   else works with zero key).

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
4. If asked to deepen the Character System's visuals further, or touch
   Fintech visuals: get a concrete reference (named app/brand/image)
   before building — abstract adjectives alone have repeatedly taken
   many rounds to converge (six rounds for the original Character System
   direction; the Oura screenshots this session are the model for how a
   concrete reference should look going in).
5. **Re-confirm with the user, on both their iPhone and PC**, that
   companion onboarding/interaction still works correctly after the
   `position:fixed` portal fix from an earlier session — this was
   diagnosed and fixed via a screenshot rather than a live confirmed
   retest, and it's easy for this to get lost among newer work.
