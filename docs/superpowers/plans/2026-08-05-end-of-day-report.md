# End-of-Day Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an evening-only End-of-Day Report to Overview — an AI-written recap (today + week-in-review) when a Claude key is configured, a rule-based bullet version when it isn't, cached once per day.

**Architecture:** One new pure-logic file (`src/utils/eodReport.js`) holds both paths' data gathering, prompt-building, and `localStorage` caching. `Overview.jsx` gets a small amount of new state/effect wiring plus one new JSX section, placed after the existing "Ask your coach" / "Need a moment?" row. No backend, no new external service — reuses `coachContext.js`'s existing `summarizeUserData()` and `claudeApi.js`'s existing `sendToClaude()`.

**Tech Stack:** Plain JS (no TypeScript), React (existing `useState`/`useEffect` patterns already used throughout `Overview.jsx`), `localStorage` (same pattern as `claudeApi.js`'s own dedicated keys). No test framework exists in this repo — verification uses throwaway Node scripts (written, run, then deleted) for the pure-logic file, and the actual dev server + browser for the UI wiring.

## Global Constraints

- No backend, job queue, or server-side call of any kind — everything here is client-side, matching this app's existing architecture.
- No alcohol section — no alcohol data exists anywhere in this app.
- The AI path must never fire more than once per day without an explicit Regenerate press.
- Any Claude-call failure (`ClaudeApiError` or otherwise) must fall back to the rule-based text, never an error state or a blank section.
- Cycle-related content, if shown, must always use estimate-qualified language (never diagnostic), matching the existing house rule already enforced in `cyclePhase.js` and `coachContext.js`.
- The cache key (`lifestyle-tracker-eod-report-cache`) must NOT be added to `DEFAULT_DATA`/`data` — it's regenerable cache, not a log, and must not round-trip through export/import or cloud sync.

---

### Task 1: `src/utils/eodReport.js` — data gathering, prompt, cache

**Files:**
- Create: `src/utils/eodReport.js`

**Interfaces:**
- Consumes: `todayKey`, `currentWeekKeys`, `previousWeekKeys` from `./dates`; `computeHydrationAutopilot` from `./hydrationAutopilot`; `estimateCyclePhase` from `./cyclePhase`; `getComebackStatus` from `./comeback`; `summarizeUserData` from `./coachContext`; `sendToClaude` from `./claudeApi`.
- Produces: `shouldShowEodReport(data, now = new Date()) -> boolean`, `getCachedReport() -> {date, text, source} | null`, `setCachedReport(text, source) -> {date, text, source}`, `clearCachedReport() -> void`, `buildEodSystemPrompt(data) -> string`, `generateAiReport(data) -> Promise<{date, text, source: 'ai'}>`, `gatherFallbackReportData(data, now = new Date()) -> object`, `buildFallbackReportText(fallbackData) -> string`. Task 2 imports all of these by these exact names.

- [ ] **Step 1: Write the file**

```js
import { todayKey, currentWeekKeys, previousWeekKeys } from './dates'
import { computeHydrationAutopilot } from './hydrationAutopilot'
import { estimateCyclePhase } from './cyclePhase'
import { getComebackStatus } from './comeback'
import { summarizeUserData } from './coachContext'
import { sendToClaude } from './claudeApi'

const CACHE_KEY = 'lifestyle-tracker-eod-report-cache'
const EVENING_HOUR = 18
const NUTRITION_KEYS = ['breakfast', 'lunch', 'dinner', 'vegetables', 'snacks']
const LOW_MOOD_EMOJI = ['😞', '😕']

// Evening, and at least one thing logged today — otherwise there's
// nothing to report.
export function shouldShowEodReport(data, now = new Date()) {
  if (now.getHours() < EVENING_HOUR) return false
  const today = todayKey()
  const hasWater = (data.water[today] || 0) > 0
  const hasSleep = !!data.sleep[today]
  const hasNutrition = NUTRITION_KEYS.some((k) => data.nutrition[today]?.[k])
  const hasWorkout = today in data.workouts.completions
  const hasMood = data.mood.some((m) => m.date === today)
  const hasCycle = data.cycle.some((c) => c.date === today)
  return hasWater || hasSleep || hasNutrition || hasWorkout || hasMood || hasCycle
}

// Cache is regenerable UI state, not a log — deliberately NOT part of
// data/DEFAULT_DATA, so it never round-trips through export/import or
// cloud sync (same treatment as claudeApi.js's own dedicated keys).
export function getCachedReport() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw)
    return cached.date === todayKey() ? cached : null
  } catch {
    return null
  }
}

export function setCachedReport(text, source) {
  const cached = { date: todayKey(), text, source }
  localStorage.setItem(CACHE_KEY, JSON.stringify(cached))
  return cached
}

export function clearCachedReport() {
  localStorage.removeItem(CACHE_KEY)
}

const RULES = `You are writing a short end-of-day recap for a personal health tracking app called Lifestyle Tracker. The user will read this in the evening, on their phone.

Ground everything in the DATA SNAPSHOT below — never invent numbers, streaks, or facts not present in it.

Hard rules:
- You are not a doctor: never diagnose or suggest treatment. If something sounds medically concerning, gently suggest mentioning it to a doctor.
- No guilt or shame language: never say "you failed," "you should have," "cheat day," or similar. Missed days and rest are normal, not moral failures.
- If a cycle phase estimate is present in the snapshot, treat it as exactly that — an estimate, never a diagnosis or a hormonal certainty. Use pattern-based language.
- Structure the reply as two short parts, plain paragraphs, no headers and no markdown: first "today" specifically (2-4 sentences), then a week-in-review comparing this week's pattern to last week's — what's going well, what isn't, one likely effect of the pattern, and one concrete thing to try tomorrow (2-4 sentences).
- Keep the whole reply under 150 words.`

export function buildEodSystemPrompt(data) {
  return `${RULES}\n\n${summarizeUserData(data)}`
}

export async function generateAiReport(data) {
  const system = buildEodSystemPrompt(data)
  const text = await sendToClaude({
    system,
    messages: [{ role: 'user', content: 'Write my end-of-day recap.' }],
    maxTokens: 400,
  })
  return setCachedReport(text.trim(), 'ai')
}

// ---- Fallback (no API key) path — structured data, not prose, since
// it needs to be formatted as bullet lines rather than sent to an LLM. ----

export function gatherFallbackReportData(data, now = new Date()) {
  const today = todayKey()
  const thisWeek = currentWeekKeys().filter((k) => k <= today)
  const lastWeek = previousWeekKeys()

  const hydration = computeHydrationAutopilot(data, now)

  const nutritionToday = data.nutrition[today] || {}
  const nutritionCountToday = NUTRITION_KEYS.filter((k) => nutritionToday[k]).length

  const workoutToday = !!data.workouts.completions[today]
  const workoutThisWeek = thisWeek.filter((k) => data.workouts.completions[k]).length
  const workoutLastWeek = lastWeek.filter((k) => data.workouts.completions[k]).length

  const moodToday = data.mood.filter((m) => m.date === today)
  const lowMoodThisWeek = data.mood.filter((m) => thisWeek.includes(m.date) && LOW_MOOD_EMOJI.includes(m.emoji)).length

  const phase = estimateCyclePhase(data, today)
  const cycleToday = data.cycle.find((c) => c.date === today)
  const cycleNote = phase && cycleToday?.symptoms?.length > 0 ? phase.line : null

  const comeback = getComebackStatus(data)

  return {
    hydration, nutritionCountToday, workoutToday, workoutThisWeek, workoutLastWeek,
    moodToday, lowMoodThisWeek, cycleNote, comeback,
  }
}

function weekCompareLine(label, thisWeekCount, lastWeekCount, unit) {
  if (thisWeekCount === lastWeekCount) return `${label}: ${thisWeekCount} ${unit} this week, same as last week.`
  const trend = thisWeekCount > lastWeekCount ? 'up from' : 'down from'
  return `${label}: ${thisWeekCount} ${unit} this week, ${trend} ${lastWeekCount} last week.`
}

export function buildFallbackReportText(fb) {
  const lines = []
  lines.push(`Hydration: ${fb.hydration.statusLabel.toLowerCase()}.`)
  if (fb.nutritionCountToday > 0) lines.push(`Nutrition: ${fb.nutritionCountToday}/5 checks today.`)
  lines.push(fb.workoutToday ? 'Workout: trained today.' : 'Workout: rest day.')
  lines.push(weekCompareLine('This week', fb.workoutThisWeek, fb.workoutLastWeek, 'workouts'))
  if (fb.moodToday.length > 0) lines.push(`Mood: ${fb.moodToday.map((m) => m.emoji).join(' ')}`)
  if (fb.cycleNote) lines.push(fb.cycleNote)

  const actions = []
  if (fb.hydration.status === 'likely_low' || fb.hydration.status === 'slightly_low') {
    actions.push('Start tomorrow with a glass of water before anything else.')
  }
  if (!fb.workoutToday && fb.workoutThisWeek < fb.workoutLastWeek && !fb.comeback.isComeback) {
    actions.push("Get one session in tomorrow to keep the week's pace up.")
  }
  if (fb.lowMoodThisWeek >= 3) {
    actions.push('Consider a lighter, lower-pressure day tomorrow if you need it.')
  }
  const cappedActions = actions.slice(0, 3)
  if (cappedActions.length === 0) cappedActions.push('Steady day — keep it up tomorrow.')

  return [...lines, '', 'Tomorrow:', ...cappedActions.map((a) => `- ${a}`)].join('\n')
}
```

- [ ] **Step 2: Verify with a throwaway Node script**

Create a temporary file `scripts/_verifyEodReport.mjs` (delete it in Step 3 — this is not a shipped script):

```js
import { shouldShowEodReport, gatherFallbackReportData, buildFallbackReportText, buildEodSystemPrompt } from '../src/utils/eodReport.js'

const baseData = {
  water: { '2026-08-05': 500 }, sleep: {}, nutrition: { '2026-08-05': { breakfast: true } },
  workouts: { profile: null, schedule: [], completions: { '2026-08-05': false, '2026-08-04': true }, exerciseLogs: {} },
  weight: [], mood: [{ date: '2026-08-05', emoji: '🙂', note: '' }], photos: [],
  habitContracts: [], painLog: {}, motivationFlags: {}, cycle: [], budget: [], schedule: [], notes: [],
  character: { archetype: null, feedPointCredit: 0, createdAt: null },
  settings: { waterGoalMl: 2000, sleepGoalHours: 8, weightUnit: 'kg', gentleMode: false },
}

console.log('shouldShowEodReport (evening, has data):', shouldShowEodReport(baseData, new Date('2026-08-05T19:00:00')))
console.log('shouldShowEodReport (morning):', shouldShowEodReport(baseData, new Date('2026-08-05T09:00:00')))
console.log('shouldShowEodReport (evening, no data):', shouldShowEodReport({ ...baseData, water: {}, nutrition: {}, mood: [] }, new Date('2026-08-05T19:00:00')))

const fb = gatherFallbackReportData(baseData, new Date('2026-08-05T19:00:00'))
console.log('fallback data:', JSON.stringify(fb, null, 2))
console.log('fallback text:\n' + buildFallbackReportText(fb))

console.log('system prompt (first 200 chars):', buildEodSystemPrompt(baseData).slice(0, 200))
```

Run: `node scripts/_verifyEodReport.mjs`

Expected: the three `shouldShowEodReport` lines print `true`, `false`, `false` in that order; `fallback text` prints a multi-line block starting with `Hydration: ...` and ending with a `Tomorrow:` section listing 1-3 `- ` lines; no thrown errors.

- [ ] **Step 3: Delete the throwaway script and commit**

```bash
rm scripts/_verifyEodReport.mjs
git add src/utils/eodReport.js
git commit -m "Add End-of-Day Report data gathering, AI prompt, and cache"
```

---

### Task 2: Wire the report into Overview

**Files:**
- Modify: `src/pages/Overview.jsx`

**Interfaces:**
- Consumes: everything Task 1 exported from `../utils/eodReport`, plus `hasApiKey` from `../utils/claudeApi` (already exists, unchanged).
- Produces: a new inline section on Overview, no new exports (page component).

- [ ] **Step 1: Add the imports**

At the top of `src/pages/Overview.jsx`, alongside the existing imports (after the `VoiceLogSheet` import on line 25):

```js
import {
  shouldShowEodReport, getCachedReport, setCachedReport, clearCachedReport,
  generateAiReport, gatherFallbackReportData, buildFallbackReportText,
} from '../utils/eodReport'
import { hasApiKey } from '../utils/claudeApi'
```

- [ ] **Step 2: Add state and the load/generate effect**

Inside the `Overview` component, near the other `useState`/`useEffect` declarations (after the existing `voiceLogOpen` state and its effect, around line 57):

```js
const [eodReport, setEodReport] = useState(null)
const [eodLoading, setEodLoading] = useState(false)
const showEod = shouldShowEodReport(data)

const runFallback = () => setEodReport(setCachedReport(buildFallbackReportText(gatherFallbackReportData(data)), 'fallback'))

useEffect(() => {
  if (!showEod) { setEodReport(null); return }
  const cached = getCachedReport()
  if (cached) { setEodReport(cached); return }
  if (!hasApiKey()) { runFallback(); return }
  setEodLoading(true)
  generateAiReport(data)
    .then(setEodReport)
    .catch(runFallback)
    .finally(() => setEodLoading(false))
  // Intentionally keyed on showEod only, not `data` — the cache is
  // date-based, not data-based; regenerating on every log would defeat
  // the once-per-day cache. Use the Regenerate button for a fresh pull.
}, [showEod])

const handleRegenerate = () => {
  clearCachedReport()
  setEodLoading(true)
  generateAiReport(data)
    .then(setEodReport)
    .catch(runFallback)
    .finally(() => setEodLoading(false))
}
```

- [ ] **Step 3: Add the JSX section**

Find the existing two-button row (`"Ask your coach"` / `"Need a moment?"`, ending around line 270) and insert this immediately after its closing `</div>`, before the `{topInsights.length > 0 && (...)}` block:

```jsx
{showEod && (
  <div className="card">
    <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div className="text-sm faint" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 11 }}>
        {eodReport?.source === 'ai' ? 'AI recap' : "Today's recap"}
      </div>
      {eodReport?.source === 'ai' && !eodLoading && (
        <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }} onClick={handleRegenerate}>
          Regenerate
        </button>
      )}
    </div>
    {eodLoading ? (
      <p className="text-sm muted" style={{ marginTop: 8 }}>Writing your recap…</p>
    ) : (
      <p className="text-sm" style={{ marginTop: 8, whiteSpace: 'pre-line' }}>{eodReport?.text}</p>
    )}
  </div>
)}
```

- [ ] **Step 4: Verify in the browser**

Start the dev server (`preview_start` with the project's configured dev server, or `npm run dev`). In the browser console, force evening + seed some data so the section has something to show:

```js
localStorage.setItem('lifestyle-tracker-eod-report-cache', '') // clear any stale cache
```

Since the actual system clock likely isn't past 6pm, temporarily verify the logic itself rather than fighting the real clock: open the app, and in the browser console run:

```js
import('/src/utils/eodReport.js').then((m) => console.log(m.shouldShowEodReport(JSON.parse(localStorage.getItem('lifestyle-tracker-data-v1')), new Date(new Date().setHours(19)))))
```

Expected: logs `true` if any data was logged today, `false` otherwise. Then confirm the actual rendered section:
1. Without a Claude key configured (Settings → AI Coach, key field empty): reload with the browser's clock effectively evening (or temporarily lower `EVENING_HOUR` to `0` in a scratch edit, verify, then revert — do not ship a lowered threshold) and confirm the rule-based card renders with a "Today's recap" label, no Regenerate button, and a "Tomorrow:" section.
2. With a Claude key configured: confirm the card shows "Writing your recap…" briefly, then the AI text with an "AI recap" label and a working Regenerate button.
3. Confirm no console errors in either case (`read_console_messages`).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Overview.jsx
git commit -m "Wire End-of-Day Report into Overview, AI and fallback paths"
```

---

### Task 3: End-to-end acceptance pass

**Files:** none (verification only).

- [ ] **Step 1: Re-check the design spec's acceptance criteria**

Go through each item in `docs/superpowers/specs/2026-08-05-end-of-day-report-design.md`'s "Acceptance criteria" list and confirm it against what Tasks 1-2 actually produced:
- Rule-based recap appears after 6pm with data logged today, no key configured.
- AI recap appears instead when a key is configured, covering today + week-in-review.
- No second API call on a second same-evening visit (check `read_network_requests` for only one `api.anthropic.com` call across two page views without pressing Regenerate).
- Regenerate clears cache and produces a new AI recap (a second `api.anthropic.com` call after pressing it).
- A simulated Claude failure (e.g. temporarily blank out the API key mid-session, or mock a 401) falls back to rule-based text, not an error state.
- Cycle content, if shown, uses estimate-qualified language.
- No alcohol section anywhere.
- No Supabase/backend call anywhere in this feature's code path.

- [ ] **Step 2: Commit any final fixes found during this pass, or confirm clean**

If everything checks out with no changes needed, no commit is required for this task — just confirm in your final report which items passed.
