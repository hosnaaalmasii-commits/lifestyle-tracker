# CLAUDE.md — Lifestyle Tracker

Working notes for Claude Code sessions on this repo. See [README.md](README.md)
for the file-by-file structure and data model reference — this file is about
*why* things are built the way they are, and where things currently stand.

## What this is

A personal, installable (PWA) lifestyle tracker — water, sleep, workouts,
weight, mood, nutrition, progress photos, cycle, budget, schedule — plus a
layer of habit-formation features (insights, gamification, Consistency
Score, Habit Contracts, Comeback Mode, Lifestyle GPS) loosely inspired by a
product-strategy exercise the user asked for early in this project (a
hypothetical app called "Tessera" — see chat history if that name
resurfaces, it's not part of this app's branding, just the design doc it
was scoped from). It also has a voice/text-logging pipeline (say or type a
sentence, it becomes structured log entries) and two selectable visual
styles — Classic and a dark "Fintech" style with a genuinely different
Overview layout, not just a reskin.

Live at: **https://hosnaaalmasii-commits.github.io/lifestyle-tracker/**
Repo: **github.com/hosnaaalmasii-commits/lifestyle-tracker**

## Architecture, and why

- **Vite + React, plain JavaScript (no TypeScript).** Chosen for low friction
  on future "change this or that" style requests — no type ceremony to fight.
- **Fully client-side, no backend, deployed to GitHub Pages via GitHub
  Actions** (`.github/workflows/deploy.yml`, runs on every push to `main`).
  GitHub Pages was picked specifically because the user already needed a
  GitHub account for the repo — no second service/account to manage.
- **`vite.config.js` uses `base: './'`** (relative paths) so the build works
  from any GitHub Pages project path without hardcoding the repo name.
- **All data lives in one `localStorage` blob** (`AppContext.jsx`,
  key `lifestyle-tracker-data-v1`). Settings → Export/Import round-trips
  that exact JSON.
- **"Derived, not stored" is the house rule for anything computed.** XP/
  levels, badges, weekly challenges, insights, Consistency Score, MVW tier
  suggestions, Lifestyle GPS phase, mascot tier, and today's micro-habit are
  all recomputed live from the raw logs on every render — nothing about
  them is persisted. This was a deliberate choice made repeatedly through
  the project: it means new derived features never need a migration and
  can never drift out of sync with the underlying data. When adding a new
  "smart" feature, default to this pattern before adding stored state.
- **Two — and only two — external services get called, both bring-your-
  own-credential and both opt-in.** Everything else, including the voice
  pipeline below, reuses one of these two rather than adding a third:
  - **Claude API** (`claudeApi.js`): direct browser fetch to
    `api.anthropic.com` using the user's own API key and the
    `anthropic-dangerous-direct-browser-access` header. The key is a real
    secret — stored in its own localStorage key, deliberately excluded from
    `data`/export, wiped by "Clear everything". **Never** embed a shared key
    here; anything in client code is publicly extractable. `sendToClaude()`
    is the one call site — the **AI Coach** (`coachContext.js`) and the
    **voice-logging pipeline** (`voiceLogging.js`) both call through it with
    different system prompts, rather than each rolling their own fetch.
  - **Google Calendar** (`googleCalendar.js`): client-side Google Identity
    Services token flow, freebusy-only scope. A Google OAuth Client ID is
    *not* a secret (Google restricts it by authorized origins, not by
    hiding it), so it's fine to keep in `data.settings.googleClientId` —
    opposite trust model from the Anthropic key, don't conflate the two.
    The access token itself stays in memory only (a ref), never
    localStorage; a silent, non-prompting reconnect is attempted on load.
- **Voice-logging pipeline** (`voiceLogging.js` + `VoiceLogSheet.jsx`,
  entry point: "Log by voice" button on Overview): one Claude call turns a
  sentence into structured entries across 7 categories — meal, drink, mood,
  workout, cycle, schedule, budget. Every extracted field is tagged
  `exact` / `estimated` / `unknown` / `needs_confirmation`. **The rule for
  when to interrupt the user with a follow-up question**: only when a
  field is genuinely ambiguous *and* it feeds a real downstream number
  (water ml total, a workout PR's weight/reps, an expense amount) — never
  for cosmetic fields (mood intensity, meal slot, cycle flow, schedule
  time). This was specified up front and is worth preserving if the
  pipeline grows — the whole point is it shouldn't nag. Resolved intents
  write through the exact same `AppContext` actions the manual log forms
  use (`addWater`, `setNutritionItem`, `addCycleEntry`, etc.), so a
  voice-logged entry is indistinguishable from a manual one afterward.
  - `cycle`, `budget`, and `schedule` are real tracked categories
    (`data.cycle`/`data.budget`/`data.schedule`, arrays of dated entries)
    added specifically because the voice pipeline needed somewhere to
    write those intents to — they didn't exist before. Each has a minimal
    page under More (`Cycle.jsx`, `Budget.jsx`, `Schedule.jsx`) following
    the same log-entry-list-plus-Sheet pattern as `Weight.jsx`.
- **Speech capture** (`speechInput.js`): wraps the browser's native
  `SpeechRecognition` API for a real "tap and talk" mic button in
  `VoiceLogSheet`. **Safari — desktop and iOS — has never implemented this
  API.** `SPEECH_SUPPORTED` is computed once at module load
  (`isSpeechRecognitionSupported()`); when false, the mic button doesn't
  render at all and the sheet falls back to its text box, with a note
  pointing at the OS keyboard's own dictation microphone (which already
  does speech-to-text into any text field, Safari included, with zero app
  code). Don't try to work around the Safari gap with a different Web API
  — there isn't a clean one available client-side without adding a third
  paid network service, which is out of scope (see below).
  `onEnd` — not just a detected "final" result — is what triggers parsing,
  deduped against the final-result path with a ref flag; a manually
  aborted (sheet-closed) session is explicitly suppressed from
  auto-parsing via a separate flag. This was a real bug: only firing on
  `isFinal` left users who manually tapped "stop" needing a second,
  separate tap on "Parse" to get anywhere.
- **UI style system** (`data.settings.uiStyle`: `'classic'` | `'fintech'`):
  independent of light/dark theme (`themeMode`), toggled in Settings → App
  style. Fintech sets `data-style="fintech"` on `<html>`; `fintech.css` is
  scoped entirely under that attribute so it never leaks into Classic.
  - A gradient picker (`fintechGradients.js`: Nebula/Ion/Wealth) drives not
    just hero-card backgrounds but the app's actual accent CSS variables
    (`--accent-water`/`sleep`/`workout`, `--accent-fill`, ring colors) when
    Fintech is active — set in the same `AppContext.jsx` effect that
    already pushes Classic's user-picked colors. This was a deliberate
    fix after an earlier pass where only card *backgrounds* changed and
    the ring/icons/badges stayed the Classic accent color, which read as
    barely-redesigned rather than a real second style.
  - **Fintech's Overview is a structurally different layout**
    (`OverviewTerminal.jsx`), not a recolored version of Classic's
    hero-ring-card stack: a swipeable wallet-card carousel
    (`WalletRail.jsx`), a 3-ring "flight dial" merging water/sleep/workout
    into one instrument (`FlightDial.jsx`), a weekly seat-map
    (`WeeklyManifest.jsx`), a torn boarding-pass ticket for today's workout
    (`BoardingPass.jsx`), passport-stamp badges (`PassportStamp.jsx`), and
    a holographic bento grid for the mascot/XP/streak/badges. This took
    several rejected directions to land on (see git log around
    `d75d695`–`5bca162`) — if asked to touch the visual design again,
    prefer showing a quick concept (Artifact) before reworking the real
    app, since "just build it" cost several redo cycles here.
  - **Mascot tiers** (`mascotTiers.js`, `MascotCard.jsx`): the evolving
    companion piggybacks on the existing XP/level curve
    (`gamification.js`) rather than a second currency — purely derived,
    same "derived not stored" rule as everything else. `MascotCard` takes
    a `variant` prop (`'hero'` for Classic, `'bento'` for the Terminal
    grid tile) so the tier logic isn't duplicated per layout.
- **Explicitly out of scope**, on purpose, and already asked-about /
  declined once: calendar-integration-beyond-freebusy, social/multiplayer
  features (personal single-user app by explicit request), fridge/camera
  computer-vision features, real push notifications, and a third paid
  network service for Safari speech-to-text — all would need a real
  backend and/or paid infra, which conflicts with "free, private, static
  site."

## Design system

- Fonts: Fraunces (headings), Inter (body), IBM Plex Mono (numbers/data) —
  loaded via Google Fonts `<link>` in `index.html`. Fintech style overrides
  the heading font to a clean sans-serif stack (see `fintech.css`) rather
  than using Fraunces, on purpose — a serif read as "warm/classic," not
  "fintech."
- Colors: CSS custom properties in `theme.css` for Classic (light/dark via
  `prefers-color-scheme` + a `data-theme` override), `fintech.css` for the
  Fintech style (see above). Section accent colors are pushed onto
  `document.documentElement` at runtime from an effect in `AppContext.jsx`
  — one effect handles both style systems' color variables together.
- **Icons: `src/components/Icon.jsx`, a hand-drawn line-icon set
  (~55 icons, including `mic`), replacing emoji throughout the app.** This
  was a deliberate redesign — the user explicitly disliked the emoji-heavy
  UI and wanted a "professional, unique, rich" look. Consistent stroke
  weight (1.7), 24×24 viewBox, `currentColor`. When adding new UI, use an
  existing `Icon name="..."` where a reasonable match exists before
  inventing a new glyph; check the icon set in that file first. Persisted
  mood values (`data.mood[].emoji`) are still raw emoji strings for backward
  compatibility — only the *display* layer maps them to icons
  (`moodActions.js`'s `faceIconForEmoji`); don't "fix" the stored format.
- Color presets: `colorPresets.js` — grouped into named families (Purple,
  Jewel tones, Metallics & luxury, Earth & nature, Ocean & sky, Warm &
  sunset) rather than one flat list, specifically because the user
  complained the old flat purple-heavy list felt repetitive. `ColorPicker.jsx`
  shows a compact "quick pick" row (one swatch per group) by default with a
  "More shades" expand-to-full-grouped-grid toggle.

## Known environment quirks (don't re-debug these)

- The **screenshot tool and `read_console_messages`** in this dev
  environment have repeatedly returned **stale/cached results** — same
  content across server restarts and page navigations, including phantom
  console errors referencing already-fixed code, and in at least one case a
  **badly mis-scaled render** (a real 1280×720 viewport screenshotted as a
  garbled ~800×758 image with content crammed into a corner, which produced
  a false-negative click-coordinate test). **Trust DOM-level verification
  instead**: `javascript_tool` calls doing `document.querySelectorAll(...)`,
  `getBoundingClientRect()`, `.innerText` checks, etc. If a `computer` click
  based on screenshot coordinates seems to miss, cross-check the real
  target's `getBoundingClientRect()` before assuming the app is broken.
- **Rapid consecutive DOM reads right after a navigating `.click()` can
  return the pre-render snapshot.** Insert a short `setTimeout` (≥800ms has
  been reliable) before reading `document.querySelector(...)` after a tab
  switch or similar; checking immediately in the same tool call has
  produced misleading "it didn't navigate" results more than once here.
- **Synthetic `MouseEvent`/`PointerEvent` dispatch needs realistic timing.**
  Firing `pointerdown` → `pointermove` → `pointerup` all synchronously in
  one script tick happens *before* React's `useEffect` (which attaches the
  real listeners on state change) gets a chance to run, producing false
  "nothing happened" results. Space them with small `setTimeout` gaps to
  simulate real interaction timing.
- **No real Anthropic API key is configured in this dev environment.** To
  test Claude-dependent features (Coach, voice-logging) without a real key
  or spending real credits, mock `window.fetch` for URLs containing
  `api.anthropic.com` and set a fake value under the
  `lifestyle-tracker-anthropic-key` localStorage key.
- Client-side hash-only navigation (`location.hash = '#x'`) does **not**
  reload the page/remount React — only a real `navigate()`/reload does.
  Relevant if you ever add a debug route again.
- No `gh` CLI available in this environment; GitHub setup was done by
  walking the user through the browser UI. `git push` from this sandbox
  works without interactive auth (credentials already cached somehow) —
  don't assume that's true in a different environment.
- `python3`/`python` are not available in this shell; use Node or plain
  `Edit`/`Bash` text tools instead of Python one-liners.

## Current status (as of this note)

Everything is **committed, pushed, and deployed** — most recent commit on
`main` is `788c8be` ("Auto-parse on any mic session end, not just a
detected final result"). No known open bugs as of this note; the last two
fixes (iOS text-selection hijack from the wallet-rail drag code, and the
mic auto-parse gap) are deployed but not yet re-confirmed by the user on
their actual phone.

Shipped and stable:
- Core v1/v2 feature set (water/sleep/workouts/weight/mood/nutrition/
  photos, insights, gamification, Habit Contracts, Comeback Mode,
  Lifestyle GPS).
- Emoji → `Icon` component sweep + grouped color palette redesign.
- Fintech dark-mode style with the Terminal Overview layout, gradient
  picker, and app-wide accent-color integration.
- Voice/text-logging pipeline covering all 7 categories, including the new
  Cycle/Budget/Schedule pages, with real speech capture on browsers that
  support it and a keyboard-dictation fallback message on Safari.

## Next steps

1. **The user still hasn't added a real Anthropic API key on the live
   site** — Coach and voice-logging remain non-functional for them until
   they do (More → Settings → AI Coach). This is the main thing blocking
   them from actually using the newest work.
2. Confirm with the user that the two most recent fixes actually resolved
   things on their iPhone: (a) tapping "Log by voice" no longer triggers a
   page-wide text-selection glitch, (b) stopping the mic (or letting it
   auto-stop) reliably parses without a second manual tap.
3. Google OAuth Client ID still not configured — optional, unchanged from
   earlier in the project.
4. Not yet requested, but a plausible next ask given the pattern so far:
   extending the voice pipeline to also cover weight and sleep intents
   (currently only meal/drink/mood/workout/cycle/schedule/budget) — Weight
   and Sleep already have full pages and `AppContext` actions, so this
   would follow the same shape as the existing categories in
   `voiceLogging.js` rather than needing new infrastructure.
5. If asked to touch the Fintech visual design again, show a quick concept
   (Artifact) first rather than reworking the real app directly — this
   exact area burned several redo cycles when skipped straight to
   implementation.
