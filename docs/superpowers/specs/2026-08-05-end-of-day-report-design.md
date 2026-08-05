# End-of-Day Report

Status: approved by user, pending final spec review
Date: 2026-08-05

## Context

This was requested from the same external multi-chapter "Vitara" spec-kit
that prompted the earlier Supabase schema and voice-logging-pipeline
discussions this session. Chapter 07 ("End-of-Day Report") was one of the
genuine gaps identified when mapping all 32 of that spec-kit's chapters
against this app's actual feature set — unlike most of the earlier
chapters requested, this one has no existing equivalent in Lifestyle
Tracker.

The external spec's framing (backend job queue, server-side IDOR checks
on report retrieval, scheduled generation) assumes infrastructure this
app doesn't have and, per the project's established architecture, isn't
adding. The user's own restated goal — after seeing the external spec's
wording — was simpler and more specific: an AI-written recap of the day
and the week, saying what went well or poorly, likely effects, and how
to improve.

## Goals

1. A short, evening-appearing recap of today's hydration, nutrition,
   workout, mood, and cycle activity.
2. A week-in-review alongside it, every evening (not just weekly) —
   what's trending well, what isn't, and one concrete way to improve.
3. When a Claude API key is configured, the recap is AI-written,
   reusing this app's existing BYOK Claude integration exactly as the
   Coach and voice-parsing already do — no new external service.
4. When no key is configured, a simpler rule-based version still
   appears, so the feature isn't gated entirely behind AI — same
   optional-AI-upgrade pattern voice logging already uses.
5. Never call Claude more than once per day per user unprompted — the
   generated text is cached for the day, with a manual regenerate
   option, both to control cost on the user's own API key and because
   there's no reason the recap should change from one Overview view to
   the next within the same evening.

## Non-goals

- No backend, job queue, or scheduled server-side generation — the
  recap is computed client-side, on-demand, exactly like every other
  derived feature in this app.
- No alcohol section — no alcohol tracking exists anywhere in this app;
  the external spec's mention of it doesn't apply here.
- No change to the Daily Plan Generator or Daily Health Score gaps
  identified earlier — this feature stands alone; it doesn't require
  either to exist first.
- Not wired to the new normalized Supabase tables from the earlier
  schema chapter — like the rest of the app today, it reads from the
  live `data` object (the `app_data`/localStorage blob), same as
  `coachContext.js` and `insights.js` already do.

## Architecture

Three pieces, split so the "does this need Claude" branch is the only
difference between the two paths:

**1. Shared data gathering — no new duplication of `coachContext.js`.**
`coachContext.js`'s existing `summarizeUserData(data)` already builds
almost exactly the data snapshot an AI recap needs (water, sleep,
workouts, nutrition, weight, mood, consistency score, cycle phase, all
with today-vs-this-week context) — the AI path reuses it directly
rather than rebuilding a parallel summary. The fallback (non-AI) path
needs the same underlying facts in *structured* form (numbers and
labels to format as bullets, not a prose paragraph), so it gets its own
small, separate data-gathering function — a real, justified difference
in shape, not a duplication of logic.

**2. `src/utils/eodReport.js`** — new file, holds:
- `shouldShowEodReport(data, now)` — returns whether it's evening
  (`now.getHours() >= 18`) AND there's at least one piece of data
  logged today (otherwise nothing to report).
- `buildEodSystemPrompt(data)` — a new system prompt, following the
  same pattern as `coachContext.js`'s `RULES` constant (grounded only
  in real data, no diagnosis, cycle language always estimate-qualified,
  no guilt/shame language), asking for: a short today recap, then a
  week-in-review (what's going well, what isn't, one likely effect, one
  concrete improvement for tomorrow), using `summarizeUserData(data)`
  as the data snapshot. Capped output length via `maxTokens`.
- `gatherFallbackReportData(data)` — structured (non-AI) version of the
  same facts: today's hydration status (via the existing
  `computeHydrationAutopilot()`), nutrition checklist count out of 5,
  workout completion today, this week's workout count vs last week
  (same week-over-week comparison pattern `insights.js` already uses
  for water/sleep/workout rates), today's mood entries, and cycle phase
  (only included if a phase is estimated AND a symptom was logged
  today, matching the existing "only mention if notable" rule from the
  cycle-coaching work).
- `buildFallbackReportText(fallbackData)` — turns that structured data
  into the short bullet-line format, skipping any section with nothing
  to report today, plus 1-3 tomorrow actions from a small set of
  deterministic rules (hydration status was `likely_low` → one action;
  workout skipped two-plus days running and not already in Comeback
  Mode → one action; mood trended low this week → a gentle nudge),
  capped at 3, with a single generic closing line if no rule fires.

**3. Caching** — a new dedicated `localStorage` key,
`lifestyle-tracker-eod-report-cache`, storing
`{ date: 'YYYY-MM-DD', text: string, source: 'ai' | 'fallback' }`. Not
part of `data`/`DEFAULT_DATA` — this is regenerable cache, not a log,
so it doesn't round-trip through export/import or cloud sync (same
treatment as the Anthropic API key's own dedicated storage key).
Invalidated automatically when the stored date no longer matches
today; otherwise reused on every Overview render without a new API
call. A "Regenerate" button clears the cache for today and re-runs
generation immediately (AI path only — the fallback path is cheap
enough to just recompute live, so "regenerate" for a no-key user simply
re-derives from current data).

## UI

A new section on `Overview.jsx`, rendered only when
`shouldShowEodReport(data, now)` is true, placed directly after the
existing "Ask your coach" / "Need a moment?" row. Shows the cached (or
freshly generated) text, a small label indicating AI-written vs
rule-based (so it's never ambiguous which one the user is looking at),
and — only on the AI path — a "Regenerate" button. While a fresh
generation is in flight (first view after 6pm, or after pressing
Regenerate), the section shows a simple loading state; once the Claude
call resolves (or fails, per Error handling below), the final text
replaces it once.

## Error handling

If the Claude call fails (no key, rejected key, rate-limited, network
error — all already typed via `ClaudeApiError` in `claudeApi.js`), fall
back to the rule-based text for that view rather than showing an error
state or blocking the section — consistent with how voice logging
already treats AI parsing as an optional upgrade layer that degrades
gracefully.

## Acceptance criteria

- [ ] With no Claude key configured, the rule-based recap appears after
      6pm whenever at least one thing was logged today.
- [ ] With a Claude key configured, the AI-written recap appears
      instead, covering both today and a week-in-review.
- [ ] The AI recap is generated at most once per day absent an explicit
      Regenerate press — verified by confirming no second API call
      fires on a second Overview visit the same evening.
- [ ] Pressing Regenerate clears the cache for today and produces a new
      AI recap.
- [ ] If the Claude call fails for any reason, the section shows the
      rule-based text instead of an error or blank state.
- [ ] Cycle-related content, if shown, is always estimate-qualified
      language, never presented as diagnostic or certain.
- [ ] No alcohol section appears anywhere (no data source exists for
      it).
- [ ] Nothing in this feature reads or writes `app_data`'s Supabase
      tables directly, or requires a backend of any kind.
