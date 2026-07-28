# Lifestyle Tracker

A personal, fully client-side lifestyle tracker (water, sleep, workouts, weight,
mood, nutrition, progress photos) with rule-based insights and gamification.
No backend, no AI API calls — everything runs and lives in the browser's
`localStorage` on the device that opens it. Installable on iPhone via Safari's
"Add to Home Screen".

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
  components/            reusable UI (Ring, WeeklyBarChart, LineChart, Sheet, TabBar,
                          ColorPicker, SegmentedControl, LevelBar, ChallengeCard,
                          Confetti, RestTimer, etc.)
  pages/
    Overview.jsx, Water.jsx, Sleep.jsx, Workouts.jsx, Progress.jsx, More.jsx
    more/                Weight, Mood, Nutrition, Insights, Badges, Settings
                          (the "More" hub)
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

## Making changes in a future session

This repo is self-contained — a fresh Claude Code session can `cd` into it,
read this file, and start editing. Typical flow:

1. Edit files under `src/`.
2. `npm run dev` to check it locally (or ask Claude to use the browser preview tool).
3. Commit + push to `main` — GitHub Actions rebuilds and redeploys to the same
   Pages URL automatically. Nothing else to configure.

No environment variables, no secrets, no backend to keep in sync.
