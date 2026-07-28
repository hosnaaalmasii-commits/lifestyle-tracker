# Lifestyle Tracker

A personal, fully client-side lifestyle tracker (water, sleep, workouts, weight,
mood, nutrition, progress photos). No backend — everything lives in the
browser's `localStorage` on the device that opens it. Installable on iPhone via
Safari's "Add to Home Screen".

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
    dates.js             date-key helpers (YYYY-MM-DD based)
    streaks.js           streak calculation from a set of "success" date keys
    workoutGenerator.js  rule-based weekly workout schedule generator
    badges.js            achievement/badge unlock rules, computed live from data
    colorPresets.js       swatches shown in Settings' color pickers
    image.js              client-side photo resize -> base64 JPEG
  components/            reusable UI (Ring, WeeklyBarChart, LineChart, Sheet,
                          TabBar, ColorPicker, SegmentedControl, etc.)
  pages/
    Overview.jsx, Water.jsx, Sleep.jsx, Workouts.jsx, Progress.jsx, More.jsx
    more/                Weight, Mood, Nutrition, Badges, Settings (the "More" hub)
  styles/
    theme.css             CSS custom properties: light/dark palette, fonts, radii
    global.css             resets, layout, buttons, cards, forms, tab bar base
scripts/generate-icons.js  generates the app icon PNGs from an inline SVG
public/                    icons, manifest assets (committed, not gitignored)
```

## Data model

Everything is one JSON object in `localStorage` under the key
`lifestyle-tracker-data-v1` (see `DEFAULT_DATA` in `src/context/AppContext.jsx`).
Settings → Export/Import produces/reads exactly that JSON. `AppProvider` merges
saved data over `DEFAULT_DATA` on load, so adding new fields later is safe for
existing users — old localStorage just won't have the new key until it's set.

Colors, theme mode and goals live under `data.settings`. Section accent colors
(`data.settings.colors.{accent,ring,water,sleep,workout}`) are pushed onto
`document.documentElement` as CSS custom properties (`--accent`, `--accent-water`,
etc.) by an effect in `AppContext.jsx`, and consumed throughout `theme.css` /
component inline styles.

## Making changes in a future session

This repo is self-contained — a fresh Claude Code session can `cd` into it,
read this file, and start editing. Typical flow:

1. Edit files under `src/`.
2. `npm run dev` to check it locally (or ask Claude to use the browser preview tool).
3. Commit + push to `main` — GitHub Actions rebuilds and redeploys to the same
   Pages URL automatically. Nothing else to configure.

No environment variables, no secrets, no backend to keep in sync.
