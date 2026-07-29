# CLAUDE.md — Lifestyle Tracker

Working notes for Claude Code sessions on this repo. See [README.md](README.md)
for the file-by-file structure and data model reference — this file is about
*why* things are built the way they are, and where things currently stand.

## What this is

A personal, installable (PWA) lifestyle tracker — water, sleep, workouts,
weight, mood, nutrition, progress photos — plus a layer of habit-formation
features (insights, gamification, Consistency Score, Habit Contracts,
Comeback Mode, Lifestyle GPS) loosely inspired by a product-strategy
exercise the user asked for early in this project (a hypothetical app called
"Tessera" — see chat history if that name resurfaces, it's not part of this
app's branding, just the design doc it was scoped from).

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
  suggestions, Lifestyle GPS phase, and today's micro-habit are all
  recomputed live from the raw logs on every render — nothing about them is
  persisted. This was a deliberate choice made repeatedly through the
  project: it means new derived features never need a migration and can
  never drift out of sync with the underlying data. When adding a new
  "smart" feature, default to this pattern before adding stored state.
- **Two — and only two — features call out to the network, both bring-your-
  own-credential and both opt-in:**
  - **AI Coach** (`claudeApi.js`, `coachContext.js`): direct browser fetch to
    `api.anthropic.com` using the user's own API key and the
    `anthropic-dangerous-direct-browser-access` header. The key is a real
    secret — stored in its own localStorage key, deliberately excluded from
    `data`/export, wiped by "Clear everything". **Never** embed a shared key
    here; anything in client code is publicly extractable.
  - **Google Calendar** (`googleCalendar.js`): client-side Google Identity
    Services token flow, freebusy-only scope. A Google OAuth Client ID is
    *not* a secret (Google restricts it by authorized origins, not by
    hiding it), so it's fine to keep in `data.settings.googleClientId` —
    opposite trust model from the Anthropic key, don't conflate the two.
    The access token itself stays in memory only (a ref), never
    localStorage; a silent, non-prompting reconnect is attempted on load.
- **Explicitly out of scope**, on purpose, and already asked-about /
  declined once: calendar-integration-beyond-freebusy, social/multiplayer
  features (personal single-user app by explicit request), fridge/camera
  computer-vision features, and real push notifications — all would need a
  real backend and/or paid infra, which conflicts with "free, private,
  static site."

## Design system

- Fonts: Fraunces (headings), Inter (body), IBM Plex Mono (numbers/data) —
  loaded via Google Fonts `<link>` in `index.html`.
- Colors: CSS custom properties in `theme.css`, light/dark via
  `prefers-color-scheme` + a `data-theme` override. Section accent colors
  (`--accent-water`, `--accent-sleep`, `--accent-workout`, etc.) are pushed
  onto `document.documentElement` at runtime from `data.settings.colors` by
  an effect in `AppContext.jsx`.
- **Icons: `src/components/Icon.jsx`, a hand-drawn line-icon set (~50
  icons), replacing emoji throughout the app.** This was a deliberate
  redesign — the user explicitly disliked the emoji-heavy UI and wanted a
  "professional, unique, rich" look. Consistent stroke weight (1.7),
  24×24 viewBox, `currentColor`. When adding new UI, use an existing
  `Icon name="..."` where a reasonable match exists before inventing a new
  glyph; check the icon set in that file first.
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
  console errors referencing already-fixed code. **Trust DOM-level
  verification instead**: `javascript_tool` calls doing
  `document.querySelectorAll(...)`, `getBBox()`, `.innerText` checks, etc.
  These have been reliable all session; screenshots/console logs have not.
  A `location.reload()` via `javascript_tool` sometimes clears the staleness
  but isn't guaranteed — don't spend much time chasing it, verify via DOM.
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

Core app + full v1/v2 feature set is **live and deployed**. The most recent
piece of work — **replacing all emoji with the new `Icon` component and
redesigning the color palette — is in progress and NOT yet committed,
built, or deployed.**

Everything below is **uncommitted** (confirmed via `git diff --stat`: 23
files changed, working tree only, nothing pushed). The most recent commit on
`main` is `a4d00ef` ("Add delete/clear actions for water and sleep entries")
— the icon/color redesign starts fresh from there.

Done in this pass (uncommitted, working tree):
- `Icon.jsx` built and visually spot-checked (via a temporary debug route,
  since removed) — all icons confirmed structurally valid (`getBBox()`
  non-zero) and the visible sample looked clean; `gear` and `scale` were
  redesigned once after an initial version looked ambiguous.
- `colorPresets.js` + `ColorPicker.jsx` redesigned (grouped palette, expand
  toggle).
- Icon wiring completed in: `badges.js`, `challenges.js`, `lifestyleGPS.js`,
  `moodActions.js` (added `MOOD_SCALE`/`faceIconForEmoji`, kept the
  persisted mood emoji values unchanged for backward compatibility — only
  the *display* layer changed), `StreakBadge.jsx`, `ChallengeCard.jsx`,
  `MiniCard.jsx`, `Overview.jsx`, `More.jsx`, `Workouts.jsx`, `Mood.jsx`,
  `Nutrition.jsx`, `Weight.jsx`, `insights.js`, `Insights.jsx`,
  `HabitContracts.jsx`, `Coach.jsx`, `ComebackScreen.jsx`, `MoodCheckIn.jsx`.

## Next steps

1. **Finish the emoji sweep** — re-check for remaining emoji in files not
   yet confirmed clean: `Progress.jsx`, `more/Settings.jsx`,
   `PainCheckIn.jsx`, `RestTimer.jsx`, `Sheet.jsx`, `ConfirmDialog.jsx`,
   `Water.jsx`, `Sleep.jsx`, `App.jsx`. Use `Grep` directly rather than an
   Agent/Explore subagent for this — keep it inline.
2. Run `npm run build` to catch syntax errors from the wiring pass.
3. Functional-test in the browser (DOM-based checks, per the quirks note
   above) — Overview, More hub, Workouts, Mood, Nutrition, Weight, Badges,
   Insights, Habit Contracts, Coach, Lifestyle GPS, Comeback screen,
   Settings color picker (grouped + expand).
4. Commit + push + confirm the GitHub Actions deploy succeeds + spot-check
   the live URL.
5. Update `README.md`'s file listing if any new util/component names
   changed (e.g. `moodActions.js` now exports `MOOD_SCALE`).
6. Still outstanding from earlier in the project, whenever the user wants
   it: they haven't yet added their Anthropic API key or Google OAuth
   Client ID — the app is fully functional without either, both are
   optional add-later connections walked through in the README / earlier
   chat.
