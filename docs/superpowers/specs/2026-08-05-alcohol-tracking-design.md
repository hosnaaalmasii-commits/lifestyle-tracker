# Alcohol Tracking + Impact Estimate (minimal Chapter 12)

Status: approved by user, pending final spec review
Date: 2026-08-05

## Context

This was scoped as a prerequisite step, not the original request. The
user asked for "situational planning modes" (Damage Control Mode, Social
Situation Planner, Restaurant Voice Mode, Life Event Mode, Weekend
Protection Plan) from the same external multi-chapter "Vitara" spec-kit
that's come up repeatedly this session. That request explicitly leans on
"file 12" (Alcohol & Low-Support Food Impact Analysis) for Damage Control
Mode specifically — but Chapter 12 doesn't exist anywhere in this app;
there's no alcohol tracking at all today. Rather than build Damage
Control Mode against a dependency that doesn't exist, the user chose to
build a minimal version of that dependency first, one mode at a time,
starting here.

This spec covers only the alcohol logging + impact-estimate piece — not
Damage Control Mode itself, and not any of the other four situational
modes. Those are explicitly out of scope, to be brainstormed separately
once this exists.

## Goals

1. A minimal way to log alcoholic drinks — just a count, matching this
   app's existing lightweight logging style (water is a total ml, mood
   is an emoji — no unnecessary detail).
2. A reusable, pure impact-estimate function that takes a drink count and
   returns concrete effects (hydration bump, workout-tier nudge, a
   recovery tip) — reusable as-is by a future Damage Control Mode with a
   *hypothetical* count from voice ("I'm going out tonight"), not just
   from real logged data.
3. Wire that estimate into the two places this app already has an
   established pattern for exactly this kind of cross-feature signal —
   `hydrationAutopilot.js` and `workoutTiers.js` — the same way
   `cyclePhase.js`'s estimate already feeds both.
4. A minimal page under More for manual logging, plus a new voice intent
   using the exact same pipeline every other intent already goes
   through — no second, less-guarded ingestion path.

## Non-goals

- Damage Control Mode, Social Situation Planner, Restaurant Voice Mode,
  Life Event Mode, and Weekend Protection Plan — all separate, later work.
- Drink type/ABV tracking — count only, per the user's explicit choice.
- Any nutrition-engine integration — the user chose hydration + workout
  tier only, not touching the nutrition checklist/tips.
- Any backend, server, or new external service — this follows the
  existing fully client-side, derived-where-possible architecture.

## Data model

New top-level array in `DEFAULT_DATA` (`AppContext.jsx`): `alcohol: []`,
entries shaped `{ id, date, count }` — `count` is a positive integer
(number of standard drinks, self-reported, no ABV math). Two new
actions, following the exact existing pattern for `cycle`/`budget`
entries:

- `addAlcoholEntry({ count }, dateKey = todayKey())` — appends
  `{ id: makeId(), date: dateKey, ...entry }`, sorted by date.
- `deleteAlcoholEntry(id)` — filters it out.

`mergeWithDefaults()` picks up `alcohol: []` automatically via its
existing spread-with-defaults pattern — no special-casing needed, same
as every other array field.

## Impact estimate — `src/utils/alcoholImpact.js`

Two functions, split deliberately so the core logic is reusable by a
future hypothetical-planning feature without touching real logged data:

- **`computeAlcoholImpact(drinkCount)`** — a pure function of a number,
  no `data` parameter at all. Returns `{ hydrationBumpMl, workoutNote,
  recoveryTip }`. Scaled by count, capped at a reasonable maximum so a
  large number doesn't produce an absurd bump (mirrors the existing
  "bounds-check" instinct already present in this app's other estimate
  functions, e.g. hydration's overhydration ceiling). Below a small
  threshold (1-2 drinks), returns a zeroed/null-ish result — a couple of
  drinks isn't treated as notable, matching the app's existing "only
  surface something if it's actually worth mentioning" restraint (same
  spirit as cycle's "only show a note if a symptom was logged").
- **`estimateAlcoholImpactForDate(data, dateKey)`** — reads yesterday
  relative to `dateKey` (impact is felt the next day, not same-day),
  sums that day's `alcohol` entries' counts, and calls
  `computeAlcoholImpact()` with the total. Returns `null` if nothing was
  logged yesterday or the total was below the notable threshold.

This split is exactly what makes the acceptance criterion "Damage
Control Mode calls Chapter 12's existing function rather than
reimplementing it" possible later: Damage Control Mode will call
`computeAlcoholImpact(hypotheticalCount)` directly, with no real logged
data involved at all.

## Integration

- **`hydrationAutopilot.js`**: alongside the existing workout/cycle
  bumps, add one more bump sourced from
  `estimateAlcoholImpactForDate(data, today)`'s `hydrationBumpMl`, with
  its own label (e.g. "Recovering from last night").
- **`workoutTiers.js`**'s `suggestTier`: alongside the existing
  sleep/pain/calendar/mood/cycle checks, add one more check using the
  same function's `workoutNote` — only nudges the tier down at a
  meaningful drink count (the function's own threshold), not for 1-2
  drinks, consistent with the "not every day needs a flag" principle
  already followed throughout this heuristic.

## UI

- **`src/pages/more/Alcohol.jsx`** — new minimal page, same
  log-entry-list-plus-`Sheet` shape as `Cycle.jsx`/`Budget.jsx`: a "+ Log"
  button opening a sheet with a count input, a history list below,
  delete via the existing `ConfirmDialog` pattern.
- **Voice intent** — add `alcohol` to `voiceLogging.js`'s
  `CATEGORY_META`, the system prompt's category/field list (`{ count:
  number }`), `MATERIAL_FIELDS` (count is material — it feeds the
  impact calculation directly, so an ambiguous count should trigger a
  `needs_confirmation` follow-up, e.g. "a couple drinks" → confirm a
  number), and a new `case 'alcohol'` in `applyVoiceIntent` calling
  `actions.addAlcoholEntry({ count }, dateKey)`. This is strictly
  additive to the existing prompt/switch — no parallel pipeline, no
  separate parsing path, satisfying the security note about not
  creating a second, less-guarded ingestion route.

## Acceptance criteria

- [ ] Logging 1-2 drinks produces no hydration bump and no workout-tier
      nudge (below the notable threshold).
- [ ] Logging a meaningful count (e.g. 4+) produces both a next-day
      hydration bump on the Water page/Overview and a workout-tier
      nudge, sourced from the same `computeAlcoholImpact()` call.
- [ ] `computeAlcoholImpact(count)` works correctly called directly with
      a number, with no `data` object involved — verified directly,
      since this is the exact call shape a future Damage Control Mode
      will use.
- [ ] Voice-logging "I had 3 drinks last night" (or similar) creates a
      real `alcohol` entry via the same `applyVoiceIntent` path as every
      other category — no separate code path.
- [ ] An ambiguous voice count ("a few drinks") triggers a
      `needs_confirmation` follow-up, matching the existing pattern for
      other material fields.
