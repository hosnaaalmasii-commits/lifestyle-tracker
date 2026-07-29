# Lifestyle Tracker

A personal, fully client-side lifestyle tracker (water, sleep, workouts, weight,
mood, nutrition, progress photos) with rule-based insights, gamification, habit
contracts, and an optional AI coach. No backend — everything lives in the
browser's `localStorage` on the device that opens it. The one exception is the
AI Coach, which is opt-in and calls Anthropic directly from the browser using
the user's own API key (see "AI Coach" below) — there is still no server of
ours involved anywhere. Installable on iPhone via Safari's "Add to Home Screen".

Live URL: see the repo's **About** section / GitHub Pages settings.

## Stack

- Vite + React (plain JavaScript, no TypeScript)
- Plain CSS with design tokens (`src/styles/theme.css`) — no CSS framework
- `vite-plugin-pwa` for the installable app manifest + service worker
- Deployed to **GitHub Pages** via GitHub Actions (`.github/workflows/deploy.yml`)
  on every push to `main`

## Local development

```bash
npm install
npm run dev       # start dev server
npm run build      # production build to dist/
npm run preview    # preview the production build locally
npm run gen-icons  # regenerate public/apple-touch-icon.png + public/icons/*
                    # (only needed if you change scripts/generate-icons.js)
```

## Project structure

```
src/
  main.jsx              entry point, registers the service worker
  App.jsx                top-level tab navigation state
  context/AppContext.jsx  the ENTIRE data model + localStorage read/write + actions
  utils/
    dates.js             date-key helpers (YYYY-MM-DD based), week helpers
    streaks.js           current + longest streak calculation from a set of date keys
    workoutGenerator.js  rule-based weekly workout schedule generator + exercise pools
    badges.js            achievement/badge unlock rules, computed live from data
    gamification.js       XP + level curve, derived live from data (never stored)
    challenges.js         weekly challenge rotation, derived live (no storage)
    insights.js            rule-based "smart insights": records, correlations, recaps,
                           streak-risk — plain data comparisons, NOT an AI/LLM call
    shareCard.js           draws the "share my week" PNG via <canvas>
    colorPresets.js        swatches + bundled theme presets for Settings
    image.js               client-side photo resize -> base64 JPEG
    time.js                 rest-timer duration parsing ("60-90 sec" -> seconds)
    workoutTiers.js         derives Full/Short/Survival tiers from a day's exercise
                            list on the fly (nothing stored), + suggestTier() readiness
                            heuristic (sleep, mood, yesterday's training, comeback gap)
    consistencyScore.js     30-day decay-weighted score across water/sleep/workout/
                            mood/nutrition — deliberately not a streak, see file comment
    moodActions.js          8-state mood -> matched micro-action lookup table, plus
                            MOOD_SCALE (the 5-point log scale) and faceIconForEmoji()
                            mapping persisted mood emoji to Icon names for display
    habitContracts.js       if-then contract trigger-type registry + today's-match check
    comeback.js              detects a 4+ day inactivity gap from existing logs
                            (no separate "last opened" field — self-clearing by design)
    claudeApi.js             direct browser -> Anthropic fetch wrapper; API key lives in
                            its own localStorage key, deliberately excluded from
                            data export/import
    coachContext.js          AI coach personalities + the data-summary text sent as the
                            system prompt (this is the ONLY place real AI is called)
    microHabits.js           context-matched (time of day, rest day, water behind, low
                            mood), date-stable daily suggestion — no storage
    painAreas.js             per-exercise-name -> body-area map for the pain check-in
                            (deliberately NOT keyed off the coarse workout "region" tag,
                            which is just 'fullBody' for 3-day split plans)
    lifestyleGPS.js          4-phase roadmap (Foundation/Momentum/Strength/Mastery)
                            derived from Consistency Score — no storage
    googleCalendar.js        client-side-only Google Identity Services token flow +
                            a freebusy.query call for "how busy is today"; the OAuth
                            Client ID is meant to be public (unlike the Anthropic key)
                            so it's fine to keep in data.settings — see "Google Calendar"
  components/            reusable UI (Icon — the hand-drawn line-icon set replacing
                          emoji throughout the app, Ring, WeeklyBarChart, LineChart,
                          Sheet, TabBar, ColorPicker, SegmentedControl, LevelBar,
                          ChallengeCard, Confetti, RestTimer, MoodCheckIn,
                          ComebackScreen, PainCheckIn, etc.)
  pages/
    Overview.jsx, Water.jsx, Sleep.jsx, Workouts.jsx, Progress.jsx, More.jsx
    more/                Weight, Mood, Nutrition, Insights, Coach, HabitContracts,
                          LifestyleGPS, Badges, Settings (the "More" hub)
  styles/
    theme.css             CSS custom properties: light/dark palette, fonts, radii,
                           gradient-accent variables, density/font attribute hooks
    global.css             resets, layout, buttons, cards, forms, tab bar, hero-card,
                           insight cards, XP bar, confetti keyframes
scripts/generate-icons.js  generates the app icon PNGs from an inline SVG
public/                    icons, manifest assets (committed, not gitignored)
```

## Data model

Everything is one JSON object in `localStorage` under the key
`lifestyle-tracker-data-v1` (see `DEFAULT_DATA` in `src/context/AppContext.jsx`).
Settings → Export/Import produces/reads exactly that JSON. `AppProvider` merges
saved data over `DEFAULT_DATA` on load, so adding new fields later is safe for
existing users — old localStorage just won't have the new key until it's set.

Colors, theme mode, personalization and goals live under `data.settings`.
Section accent colors (`data.settings.colors.{accent,ring,water,sleep,workout,
gradientEnd}`) plus `headingFont`, `density`, and `useGradientAccents` are pushed
onto `document.documentElement` as CSS custom properties / data attributes
(`--accent`, `--accent-fill`, `data-font`, `data-density`, etc.) by an effect in
`AppContext.jsx`, and consumed throughout `theme.css` / component inline styles.

`data.workouts.exerciseLogs` holds per-exercise-name PR history (`{weight, reps,
date}[]`), independent of which day the exercise appears on — logging a PR for
"Kettlebell Swing" on a Monday also shows up if it appears on a Friday.

`data.painLog` (`{dateKey: areaId[]}`), `data.motivationFlags` (`{dateKey:
bool}`), and `data.habitContracts` are the only other genuinely persisted
additions beyond the original schema — everything else added since
(Consistency Score, MVW tiers, Comeback Mode, Mood-to-Action, Lifestyle GPS,
micro-habits) is derived live, following the same "derived, not stored" rule
described below. `data.settings.gentleMode` hides exact weight numbers
app-wide (Overview mini-card, Weight page, and the AI coach's data summary
all respect it).

`data.calendarStatus` is the one field that's the *opposite* of persisted —
it's intentionally ephemeral (kept in a separate `useState` in
`AppProvider` and merged into the exposed `data` object at read time, in
`AppContext.jsx`), so it's never written to localStorage. Only the Google
Client ID and a "was connected" boolean live in `data.settings`; the OAuth
access token itself is kept in a ref, in memory only, and re-requested
(silently, where possible) each time the app loads.

### Derived-not-stored systems

XP/levels (`gamification.js`), badges (`badges.js`), weekly challenges
(`challenges.js`), and insights (`insights.js`) are **all computed live from
existing data on every render** — nothing about them is persisted. This means
they can never drift out of sync with the underlying logs, old backups stay
fully compatible, and there was no migration needed to add them. If you add a
new derived feature, prefer this pattern over adding new stored state.

"Insights" are plain rule-based comparisons over the user's own numbers
(personal records, week-over-week deltas, simple correlations, streak-risk
flags) — there is no AI/LLM call involved, by design, to keep the app free,
private, and fully offline-capable.

Minimum Viable Workout tiers, Consistency Score, Mood-to-Action Coach, and
Comeback Mode follow the same "derived, not stored" rule. Habit Contracts is
the one exception with real persisted state (`data.habitContracts`), since a
contract is something the user authors, not something derivable from logs.

## AI Coach (optional, bring-your-own-key)

`More → Coach` lets the user paste their own Anthropic API key (`More →
Settings → AI Coach`) and talk to an AI coach whose replies are grounded in a
plain-text summary of their real data (`coachContext.js:summarizeUserData`).
Requests go straight from the browser to `api.anthropic.com` using the
`anthropic-dangerous-direct-browser-access` header — there is no proxy/backend,
by design, so the app stays a static site. The key lives in its own
localStorage key (`lifestyle-tracker-anthropic-key`), is never included in
`data` (so never in export/import), and "Clear everything" wipes it along with
the cached chat/daily-note. Do not change this to a shared/embedded key —
anything shipped in client code is publicly extractable.

## Google Calendar (optional, read-only, bring-your-own Client ID)

`More → Settings → Google Calendar` connects a free/busy-only view of today
via Google Identity Services (`googleCalendar.js`) — no backend, unlike a
typical OAuth setup. This works specifically because a Google OAuth **Client
ID is not a secret**: Google restricts it by the authorized JavaScript
origins configured in Cloud Console, not by keeping it hidden, so storing it
in `data.settings.googleClientId` is fine (this is the opposite trust model
from the Anthropic API key above — don't conflate the two). The requested
scope is the narrowest available, `calendar.freebusy` (busy/free time only,
never event titles/details). The access token itself is short-lived (~1
hour) and kept in memory only (a ref in `AppProvider`, never localStorage);
on load, the app makes one silent, non-prompting attempt to resume a prior
connection (`prompt: 'none'`) and just leaves it disconnected if that fails,
rather than interrupting the user. Today's busy-minutes figure feeds into
`workoutTiers.js:suggestTier()` (a packed calendar nudges toward Short/
Survival) and is shown on Overview and Workouts when connected.

Known limitation worth flagging to the user if they hit it: Google's OAuth
popup flow can be flaky from an installed iOS home-screen PWA (WebKit
restricts `window.open` from standalone-mode web apps in ways it doesn't for
a normal Safari tab). If connecting fails silently or the popup won't open,
try it from a regular Safari tab first.

## Making changes in a future session

This repo is self-contained — a fresh Claude Code session can `cd` into it,
read this file, and start editing. Typical flow:

1. Edit files under `src/`.
2. `npm run dev` to check it locally (or ask Claude to use the browser preview tool).
3. Commit + push to `main` — GitHub Actions rebuilds and redeploys to the same
   Pages URL automatically. Nothing else to configure.

No environment variables, no secrets, no backend to keep in sync.
