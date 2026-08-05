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
- **Three — and only three — external services get called, all
  bring-your-own-credential and all opt-in.** Everything else, including
  the voice pipeline below, reuses one of these three rather than adding a
  fourth:
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
    Services token flow, freebusy-only scope. A Google OAuth Client ID is
    *not* a secret (Google restricts it by authorized origins, not by
    hiding it), so it's fine to keep in `data.settings.googleClientId` —
    opposite trust model from the Anthropic key, don't conflate the two.
    The access token itself stays in memory only (a ref), never
    localStorage; a silent, non-prompting reconnect is attempted on load.
    Still not configured on the user's live site as of this note — optional.
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
- **Explicitly out of scope**, on purpose: calendar-integration-beyond-
  freebusy, social/multiplayer features (personal single-user app by
  explicit request), fridge/camera computer-vision features, real push
  notifications, a third paid network service for Safari speech-to-text,
  and a hand-written custom backend (Supabase covers cross-device sync
  instead — see above). A body-appearance/attractiveness axis for the
  Character System was explicitly proposed by the user once and declined
  on wellbeing grounds (tying a companion's look to hitting/missing health
  targets is a well-documented harmful pattern) — the "vitality" concept
  that shipped instead (posture/glow/energy, never size or attractiveness)
  was the counter-proposal that got approved.

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

## Current status (as of this note)

Everything is **committed, pushed, and deployed** — most recent commit on
`main` is `99890bb` ("Add a way to change your companion after picking
one"). No known open bugs; the `position:fixed`/portal fix (`01675ae`) is
the one most worth re-confirming with the user on both their phone and PC,
since it was found and fixed based on a screenshot rather than the user
explicitly re-testing afterward yet.

Shipped and stable this session, on top of the prior v1/v2 feature set:
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

1. **Re-confirm with the user, on both their iPhone and PC**, that
   companion onboarding/interaction now works correctly after the
   `position:fixed` portal fix — this was diagnosed and fixed via a
   screenshot rather than a live confirmed retest.
2. Not yet requested, but a plausible next ask given the pattern so far:
   extending the voice pipeline to also cover weight and sleep intents.
3. If asked to deepen the Character System's visuals further: Fire and
   Moon got the most polish; Warrior/Nature/Robot/Animal/Plant/Dragon/
   Spirit/Athlete each got one solid pass at the same
   gradient-plus-radial-glow technique but less iteration — a reasonable
   place to focus if the user wants more.
4. Google OAuth Client ID still not configured — optional, unchanged from
   earlier in the project.
5. If the user ever wants real protein/fiber tracking (currently just the
   5-item nutrition checklist used as a proxy everywhere it's needed,
   including as a Character System growth input), that's new scope, not a
   tweak.
6. If asked to touch Fintech or Character System visuals again, get a
   concrete reference (named app/brand/image) before building — abstract
   adjectives alone took six rounds to converge last time.
