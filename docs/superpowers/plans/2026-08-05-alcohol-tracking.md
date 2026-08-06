# Alcohol Tracking + Impact Estimate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add minimal count-only alcohol logging plus a reusable, pure impact-estimate function, wired into hydration and workout-tier suggestions the same way cycle-phase estimates already are — the prerequisite Damage Control Mode needs later.

**Architecture:** A new data array (`data.alcohol`) with two AppContext actions, a new pure-logic file (`src/utils/alcoholImpact.js`) split into a pure `computeAlcoholImpact(count)` and a data-aware `estimateAlcoholImpactForDate(data, dateKey)`, a new minimal page under More, and one new voice intent through the existing pipeline.

**Tech Stack:** Plain JS (no TypeScript), React, existing `AppContext`/`Sheet`/`ConfirmDialog` patterns. No test framework — verification via throwaway Node scripts (pure logic) and the real dev server/browser (UI, voice intent).

## Global Constraints

- Count-only logging — no drink type/ABV tracking.
- `computeAlcoholImpact(drinkCount)` must be a pure function of a number — no `data` parameter, no side effects — since a future Damage Control Mode needs to call it directly with a hypothetical count.
- Impact is felt the *next* day, not same-day (a "recovering from last night" framing) — `estimateAlcoholImpactForDate` reads yesterday relative to the given date.
- 1-2 drinks is not notable — no bump, no nudge, no cache-worthy result. Only a meaningful count (defined in Task 1) triggers anything.
- The new voice intent must go through the exact same `voiceLogging.js` pipeline every other intent uses — no second, less-guarded parsing path.
- No backend, no new external service.

---

### Task 1: Data model, actions, and the impact-estimate function

**Files:**
- Modify: `src/context/AppContext.jsx` (add `alcohol: []` to `DEFAULT_DATA`, add `addAlcoholEntry`/`deleteAlcoholEntry` actions)
- Create: `src/utils/alcoholImpact.js`

**Interfaces:**
- Produces: `addAlcoholEntry(entry, dateKey = todayKey())`, `deleteAlcoholEntry(id)` (AppContext actions); `computeAlcoholImpact(drinkCount) -> { hydrationBumpMl, workoutNote, recoveryTip } | null`, `estimateAlcoholImpactForDate(data, dateKey) -> same shape | null` (from `alcoholImpact.js`). Task 2 and Task 4 both import from here.

- [ ] **Step 1: Add `alcohol: []` to `DEFAULT_DATA`**

In `src/context/AppContext.jsx`, find `DEFAULT_DATA`'s existing array fields (`cycle: [],` `budget: [],` — around where `cycle` and `budget` are declared). Add, in the same group:

```js
  alcohol: [],
```

- [ ] **Step 2: Add the two actions**

In the same file, find the `addCycleEntry`/`deleteCycleEntry` pair (this exact code currently exists):

```js
    addCycleEntry: (entry, dateKey = todayKey()) => {
      setData((d) => ({ ...d, cycle: [...d.cycle, { id: makeId(), date: dateKey, ...entry }].sort((a, b) => a.date.localeCompare(b.date)) }))
    },
    deleteCycleEntry: (id) => setData((d) => ({ ...d, cycle: d.cycle.filter((c) => c.id !== id) })),
```

Immediately after it, add:

```js

    addAlcoholEntry: (entry, dateKey = todayKey()) => {
      setData((d) => ({ ...d, alcohol: [...d.alcohol, { id: makeId(), date: dateKey, ...entry }].sort((a, b) => a.date.localeCompare(b.date)) }))
    },
    deleteAlcoholEntry: (id) => setData((d) => ({ ...d, alcohol: d.alcohol.filter((a) => a.id !== id) })),
```

- [ ] **Step 3: Write `src/utils/alcoholImpact.js`**

```js
import { addDaysToKey } from './dates'

// Below this many drinks, nothing is worth flagging — matches this
// app's existing restraint (e.g. cycle notes only surface when a
// symptom was actually logged, not on every phase day).
const NOTABLE_THRESHOLD = 3

// Caps so a large logged/hypothetical count never produces an absurd
// bump — same bounds-checking instinct as hydration's own overhydration
// ceiling.
const MAX_HYDRATION_BUMP_ML = 1000
const HYDRATION_BUMP_PER_DRINK_ML = 150

// Pure function of a number — no `data`, no side effects. This is the
// exact call shape a future Damage Control Mode will use with a
// hypothetical count from voice ("I'm going out tonight"), so it must
// never depend on real logged data.
export function computeAlcoholImpact(drinkCount) {
  if (!drinkCount || drinkCount < NOTABLE_THRESHOLD) return null

  const hydrationBumpMl = Math.min(MAX_HYDRATION_BUMP_ML, drinkCount * HYDRATION_BUMP_PER_DRINK_ML)

  return {
    hydrationBumpMl,
    workoutNote: `${drinkCount} drinks logged last night — a lighter session is a common pattern, not a rule`,
    recoveryTip: 'Extra water and an easier pace today can help — no need to push through.',
  }
}

// Reads yesterday's real logged total (relative to dateKey) and calls
// the pure function above. Returns null if nothing was logged or the
// total wasn't notable.
export function estimateAlcoholImpactForDate(data, dateKey) {
  const yesterday = addDaysToKey(dateKey, -1)
  const total = data.alcohol
    .filter((a) => a.date === yesterday)
    .reduce((sum, a) => sum + (a.count || 0), 0)
  return computeAlcoholImpact(total)
}
```

- [ ] **Step 4: Verify with a throwaway Node script**

Create `scripts/_verifyAlcoholImpact.mjs`:

```js
import { computeAlcoholImpact, estimateAlcoholImpactForDate } from '../src/utils/alcoholImpact.js'

console.log('2 drinks (not notable):', computeAlcoholImpact(2))
console.log('4 drinks:', computeAlcoholImpact(4))
console.log('10 drinks (capped):', computeAlcoholImpact(10))

const data = { alcohol: [{ id: 'a', date: '2026-08-04', count: 5 }] }
console.log('estimate for 2026-08-05 (yesterday had 5):', estimateAlcoholImpactForDate(data, '2026-08-05'))
console.log('estimate for 2026-08-04 (no entries the day before):', estimateAlcoholImpactForDate(data, '2026-08-04'))
```

Run: `node scripts/_verifyAlcoholImpact.mjs`

Expected: first line logs `null`; second logs an object with `hydrationBumpMl: 600`; third logs `hydrationBumpMl: 1000` (capped, not 1500); fourth logs the same shape as the second (600); fifth logs `null`.

- [ ] **Step 5: Delete the throwaway script and commit**

```bash
rm scripts/_verifyAlcoholImpact.mjs
git add src/context/AppContext.jsx src/utils/alcoholImpact.js
git commit -m "Add alcohol logging data model and impact-estimate function"
```

---

### Task 2: Wire the impact estimate into hydration and workout-tier suggestions

**Files:**
- Modify: `src/utils/hydrationAutopilot.js`
- Modify: `src/utils/workoutTiers.js`

**Interfaces:**
- Consumes: `estimateAlcoholImpactForDate` from `./alcoholImpact` (Task 1).

- [ ] **Step 1: Add the hydration bump**

In `src/utils/hydrationAutopilot.js`, add the import alongside the existing one:

```js
import { estimateAlcoholImpactForDate } from './alcoholImpact'
```

Find this existing block:

```js
  const phase = estimateCyclePhase(data, today)
  if (phase && (phase.phase === 'menstrual' || phase.phase === 'luteal')) {
    bumps.push({ label: `Estimated ${phase.name.toLowerCase()} window`, ml: CYCLE_BUMP_ML })
  }
```

Add immediately after it:

```js

  const alcoholImpact = estimateAlcoholImpactForDate(data, today)
  if (alcoholImpact) {
    bumps.push({ label: 'Recovering from last night', ml: alcoholImpact.hydrationBumpMl })
  }
```

- [ ] **Step 2: Add the workout-tier nudge**

In `src/utils/workoutTiers.js`, add the import:

```js
import { estimateAlcoholImpactForDate } from './alcoholImpact'
```

Find the existing sleep check:

```js
  const sleepToday = data.sleep[today]
  const sleepGoal = data.settings.sleepGoalHours
  if (sleepToday && sleepToday.hours < sleepGoal * 0.7) {
    return { tier: 'survival', reason: `short on sleep (${sleepToday.hours}h logged)` }
  }
```

Add immediately after it:

```js

  const alcoholImpact = estimateAlcoholImpactForDate(data, today)
  if (alcoholImpact) {
    return { tier: 'short', reason: alcoholImpact.workoutNote }
  }
```

- [ ] **Step 3: Verify with a throwaway Node script**

Create `scripts/_verifyAlcoholIntegration.mjs`:

```js
import { computeHydrationAutopilot } from '../src/utils/hydrationAutopilot.js'
import { suggestTier } from '../src/utils/workoutTiers.js'

const today = '2026-08-05'
const yesterday = '2026-08-04'

const baseData = {
  water: {}, sleep: {}, nutrition: {},
  workouts: { profile: null, schedule: [], completions: {}, exerciseLogs: {} },
  weight: [], mood: [], photos: [], habitContracts: [], painLog: {}, motivationFlags: {},
  cycle: [], budget: [], schedule: [], notes: [],
  alcohol: [{ id: 'a', date: yesterday, count: 5 }],
  character: { archetype: null, feedPointCredit: 0, createdAt: null },
  settings: { waterGoalMl: 2000, sleepGoalHours: 8, weightUnit: 'kg', gentleMode: false },
  calendarStatus: null,
}

const hydration = computeHydrationAutopilot(baseData, new Date(`${today}T12:00:00`))
console.log('hydration bumps:', JSON.stringify(hydration.bumps))
console.log('hydration target:', hydration.target)

const tier = suggestTier({ ...baseData, workouts: { ...baseData.workouts, completions: {} } })
console.log('suggested tier:', tier)
```

Run: `node scripts/_verifyAlcoholIntegration.mjs`

Expected: `hydration bumps` includes an entry with `"label":"Recovering from last night"` and `"ml":750`; `hydration target` is `2750` (2000 baseline + 750); `suggested tier` is `{ tier: 'short', reason: '5 drinks logged last night — a lighter session is a common pattern, not a rule' }`.

- [ ] **Step 4: Delete the throwaway script and commit**

```bash
rm scripts/_verifyAlcoholIntegration.mjs
git add src/utils/hydrationAutopilot.js src/utils/workoutTiers.js
git commit -m "Wire alcohol impact into hydration bumps and workout-tier suggestions"
```

---

### Task 3: Alcohol logging page

**Files:**
- Create: `src/pages/more/Alcohol.jsx`
- Modify: `src/pages/More.jsx`

**Interfaces:**
- Consumes: `data.alcohol`, `addAlcoholEntry`, `deleteAlcoholEntry` from `useApp()` (Task 1).

- [ ] **Step 1: Write `src/pages/more/Alcohol.jsx`**

Follow `src/pages/more/Cycle.jsx`'s exact shape (BackHeader, a "+ Log" button opening a `Sheet`, a history list, delete via `ConfirmDialog`):

```jsx
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { todayKey, humanDate } from '../../utils/dates'
import BackHeader from '../../components/BackHeader'
import Sheet from '../../components/Sheet'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'

export default function Alcohol({ onBack }) {
  const { data, addAlcoholEntry, deleteAlcoholEntry } = useApp()
  const [logOpen, setLogOpen] = useState(false)
  const [count, setCount] = useState(1)
  const [toDelete, setToDelete] = useState(null)

  const entries = [...data.alcohol].reverse()

  const openLog = () => {
    setCount(1)
    setLogOpen(true)
  }

  return (
    <div className="page">
      <BackHeader
        eyebrow="More"
        title="Alcohol"
        onBack={onBack}
        action={<button className="btn btn-primary btn-sm" onClick={openLog}>+ Log</button>}
      />

      <div className="section-title">History</div>
      {entries.length === 0 ? (
        <div className="empty-state"><div className="icon"><Icon name="droplet" size={26} /></div><p>No entries logged yet.</p></div>
      ) : (
        <div className="stack">
          {entries.map((a) => (
            <div key={a.id} className="card row" style={{ padding: '12px 16px', alignItems: 'flex-start' }}>
              <div>
                <div className="text-sm">{humanDate(a.date)}</div>
                <div style={{ fontWeight: 600 }}>{a.count} {a.count === 1 ? 'drink' : 'drinks'}</div>
              </div>
              <button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }} onClick={() => setToDelete(a)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Log drinks">
        <div className="field">
          <label>Number of drinks</label>
          <input
            className="input"
            type="number"
            min="1"
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
          />
        </div>
        <button
          className="btn btn-primary btn-block"
          onClick={() => { addAlcoholEntry({ count }, todayKey()); setLogOpen(false) }}
        >
          Save
        </button>
      </Sheet>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete entry?"
        message="This entry will be removed."
        confirmLabel="Delete"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { deleteAlcoholEntry(toDelete.id); setToDelete(null) }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Register the page in `src/pages/More.jsx`**

Add the import alongside the existing ones:

```js
import Alcohol from './more/Alcohol'
```

Add to the `ITEMS` array, after the `budget` entry:

```js
  { id: 'alcohol', label: 'Alcohol', desc: 'Drinks logged', icon: 'droplet' },
```

Add the render line, after the `budget` line:

```js
  if (view === 'alcohol') return <Alcohol onBack={() => setView(null)} />
```

- [ ] **Step 3: Verify in the browser**

Start the dev server, navigate to More → Alcohol, log an entry (e.g. 4 drinks), confirm it appears in the history list with correct pluralization ("4 drinks"), delete it via the confirm dialog, confirm it's removed. Check `read_console_messages` for errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/more/Alcohol.jsx src/pages/More.jsx
git commit -m "Add Alcohol logging page under More"
```

---

### Task 4: Voice intent

**Files:**
- Modify: `src/utils/voiceLogging.js`

**Interfaces:**
- Consumes: `addAlcoholEntry` (Task 1, called via `applyVoiceIntent`'s existing `actions` parameter — no new import needed, it's already passed in by the caller).

- [ ] **Step 1: Add to `CATEGORY_META`**

Find:

```js
export const CATEGORY_META = {
  drink: { label: 'Drink', icon: 'droplet', color: 'var(--accent-water)' },
```

Add a new entry after `drink`:

```js
  alcohol: { label: 'Alcohol', icon: 'droplet', color: 'var(--danger)' },
```

- [ ] **Step 2: Add to `MATERIAL_FIELDS`**

Find:

```js
const MATERIAL_FIELDS = {
  drink: ['volumeMl'],
  workout: ['weightKg', 'reps'],
  budget: ['amount'],
}
```

Change to:

```js
const MATERIAL_FIELDS = {
  drink: ['volumeMl'],
  alcohol: ['count'],
  workout: ['weightKg', 'reps'],
  budget: ['amount'],
}
```

`count` is material because it feeds `computeAlcoholImpact` directly — an ambiguous count ("a few drinks") should trigger a confirmation, same reasoning already documented in this file's comment above `MATERIAL_FIELDS` for `drink.volumeMl`/`budget.amount`.

- [ ] **Step 3: Add to the system prompt's category/field list**

Find:

```js
- "drink": { volumeMl: number }
```

Add immediately after:

```js
- "alcohol": { count: number }
```

Find the `"category":` line in the output shape description:

```js
      "category": "drink" | "meal" | "mood" | "workout" | "cycle" | "schedule" | "budget",
```

Change to:

```js
      "category": "drink" | "alcohol" | "meal" | "mood" | "workout" | "cycle" | "schedule" | "budget",
```

- [ ] **Step 4: Add the `applyVoiceIntent` case**

Find:

```js
    case 'drink': {
      const ml = Number(fv(f, 'volumeMl', 0))
      if (ml > 0) actions.addWater(ml, dateKey)
      break
    }
```

Add immediately after it:

```js
    case 'alcohol': {
      const count = Number(fv(f, 'count', 0))
      if (count > 0) actions.addAlcoholEntry({ count }, dateKey)
      break
    }
```

- [ ] **Step 5: Verify in the browser**

With a Claude API key configured, open the "Log by voice" sheet from Overview, type "I had 4 drinks last night" (typed text works the same as speech-to-text output — no microphone needed to test this), parse it, and confirm: the intent is categorized as `alcohol`, resolves without an unnecessary follow-up (4 is unambiguous), and applying it creates a real entry visible on the new Alcohol page dated yesterday (since "last night" should map to `when: "yesterday"`). Then try an ambiguous phrasing like "I had a few drinks" and confirm a follow-up question appears asking to confirm the count.

- [ ] **Step 6: Commit**

```bash
git add src/utils/voiceLogging.js
git commit -m "Add alcohol voice intent to the existing logging pipeline"
```

---

### Task 5: End-to-end acceptance pass

**Files:** none (verification only).

- [ ] **Step 1: Re-check the design spec's acceptance criteria**

Go through `docs/superpowers/specs/2026-08-05-alcohol-tracking-design.md`'s acceptance criteria one by one against what Tasks 1-4 produced:
- 1-2 drinks logged yesterday produces no hydration bump and no workout-tier nudge today.
- 4+ drinks logged yesterday produces both a hydration bump (visible via `computeHydrationAutopilot`, e.g. on the Water page or Overview) and a workout-tier nudge, both traceable to the same `computeAlcoholImpact` call.
- `computeAlcoholImpact(count)` works correctly called directly with just a number — already verified in Task 1's throwaway script; re-confirm no `data` parameter was ever added to it.
- Voice-logging "I had 3 drinks last night" creates a real entry via the same `applyVoiceIntent` switch as every other category.
- An ambiguous voice count triggers a `needs_confirmation` follow-up.

- [ ] **Step 2: Commit any final fixes found, or confirm clean**

If everything checks out with no changes needed, no commit is required — just confirm in your final report which items passed.
