# Recipe & Macro Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared `Recipe` object shape, an AI-generation helper reusing the existing BYOK Claude integration, basic macro goals, and a Saved Recipes page — the prerequisite foundation for the smart-kitchen-tools request (grocery rescue, leftover optimizer, food swap engine, fridge memory).

**Architecture:** A new data array (`data.recipes`) plus `macroGoals` in settings, a new pure-ish generation file (`src/utils/recipeEngine.js`) that calls the existing `sendToClaude()`, and a new minimal page under More. Macro-goal editing lives on the existing Nutrition page, matching this app's established convention of each goal living on its own most-related page (water goal on the Water page, sleep goal on the Sleep page) rather than centralized in Settings.

**Tech Stack:** Plain JS (no TypeScript), React, existing `AppContext`/`Sheet`/`ConfirmDialog` patterns, the existing `claudeApi.js`/`sendToClaude` BYOK call site. No test framework — verification via throwaway Node scripts (pure logic) and the real dev server/browser (UI, AI call).

## Global Constraints

- The `Recipe` shape is exactly: `{ id, name, ingredients: [{ name, amount }], instructions: [string], macros: { calories, proteinG, carbsG, fatG }, tags: [string] }` — every future consumer of this feature must produce/consume this exact shape, so get it right here.
- Recipe generation goes through the existing `sendToClaude()` (from `claudeApi.js`) — no new external service, no new error type (reuse `ClaudeApiError`).
- No macro/ingredient database or lookup table — macros come from Claude's own output, not computed locally from ingredients.
- Free-text recipe fields render via plain JSX text interpolation only — no `dangerouslySetInnerHTML` anywhere in this feature.
- No backend, no new external service.

---

### Task 1: Data model — recipes array and macro goals

**Files:**
- Modify: `src/context/AppContext.jsx`

**Interfaces:**
- Produces: `saveRecipe(recipe)`, `deleteRecipe(id)` actions; `setMacroGoals(goals)` action; `data.recipes` (array), `data.settings.macroGoals` (object). Tasks 2-4 all depend on these exact names.

- [ ] **Step 1: Add `recipes: []` to `DEFAULT_DATA`**

Add alongside the other array fields (e.g. near `notes: []`):

```js
  recipes: [],
```

- [ ] **Step 2: Add `macroGoals` to `DEFAULT_DATA.settings`**

Find the existing settings block with `waterGoalMl: 2000,` and `sleepGoalHours: 8,`. Add immediately after `sleepGoalHours: 8,`:

```js
    macroGoals: { calories: 2000, proteinG: 100, carbsG: 250, fatG: 65 },
```

- [ ] **Step 3: Add the `saveRecipe`/`deleteRecipe` actions**

Find the `addNote`/`deleteNote` pair (this exact code currently exists):

```js
    addNote: (text, dateKey = todayKey()) => {
      setData((d) => ({ ...d, notes: [...d.notes, { id: makeId(), date: dateKey, text, createdAt: Date.now() }] }))
    },
    deleteNote: (id) => setData((d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) })),
```

Immediately after it, add:

```js

    saveRecipe: (recipe) => {
      setData((d) => ({ ...d, recipes: [...d.recipes, { ...recipe, savedAt: Date.now() }] }))
    },
    deleteRecipe: (id) => setData((d) => ({ ...d, recipes: d.recipes.filter((r) => r.id !== id) })),
```

- [ ] **Step 4: Add the `setMacroGoals` action**

Find the existing `setWaterGoal` action (`setWaterGoal: (ml) => setData((d) => ({ ...d, settings: { ...d.settings, waterGoalMl: ml } })),`). Add immediately after it:

```js
    setMacroGoals: (goals) => setData((d) => ({ ...d, settings: { ...d.settings, macroGoals: { ...d.settings.macroGoals, ...goals } } })),
```

- [ ] **Step 5: Verify with a throwaway Node script**

Since this touches `AppContext.jsx` (a React context, not directly importable in plain Node without a DOM), verify by inspection instead: re-read the four edited spots and confirm each matches exactly what's specified above, then run `npm run build` to catch any syntax errors.

Run: `npm run build`

Expected: builds successfully with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/context/AppContext.jsx
git commit -m "Add recipes data model and macro goals to AppContext"
```

---

### Task 2: Recipe generation via Claude

**Files:**
- Create: `src/utils/recipeEngine.js`

**Interfaces:**
- Consumes: `sendToClaude`, `ClaudeApiError` from `./claudeApi`.
- Produces: `buildRecipeSystemPrompt(data) -> string`, `generateRecipe(promptText, data) -> Promise<Recipe>` (where `Recipe` is the shape from Global Constraints, with `id` generated locally). Task 3 imports both by these exact names.

- [ ] **Step 1: Write the file**

```js
import { sendToClaude, ClaudeApiError } from './claudeApi'

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function stripCodeFence(text) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : trimmed
}

export function buildRecipeSystemPrompt(data) {
  const goals = data.settings.macroGoals
  return `You generate a single recipe for a personal health-tracking app's user, based on their request. Respond with ONLY a single JSON object — no markdown fences, no prose before or after.

The user's daily macro goals (for context — frame the recipe against them where relevant, e.g. note if it's a strong contributor toward their protein goal, but don't force a connection that isn't there): calories ${goals.calories}, protein ${goals.proteinG}g, carbs ${goals.carbsG}g, fat ${goals.fatG}g.

Output shape (all fields required):
{
  "name": "string",
  "ingredients": [{ "name": "string", "amount": "string, e.g. '200g' or '2 cloves'" }],
  "instructions": ["string step", "..."],
  "macros": { "calories": number, "proteinG": number, "carbsG": number, "fatG": number },
  "tags": ["string, e.g. 'high-protein', 'quick', 'vegetarian'"]
}

Give realistic, achievable macro estimates for the recipe as a whole (not per serving unless the request implies otherwise). Keep instructions concise and practical.`
}

export async function generateRecipe(promptText, data) {
  const raw = await sendToClaude({
    system: buildRecipeSystemPrompt(data),
    messages: [{ role: 'user', content: promptText }],
    maxTokens: 1024,
  })

  let parsed
  try {
    parsed = JSON.parse(stripCodeFence(raw))
  } catch {
    throw new ClaudeApiError('Could not understand the response — try rephrasing your request.')
  }

  if (!parsed.name || !Array.isArray(parsed.ingredients) || !Array.isArray(parsed.instructions) || !parsed.macros) {
    throw new ClaudeApiError('Got an incomplete recipe — try again.')
  }

  return {
    id: makeId(),
    name: parsed.name,
    ingredients: parsed.ingredients,
    instructions: parsed.instructions,
    macros: {
      calories: Number(parsed.macros.calories) || 0,
      proteinG: Number(parsed.macros.proteinG) || 0,
      carbsG: Number(parsed.macros.carbsG) || 0,
      fatG: Number(parsed.macros.fatG) || 0,
    },
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  }
}
```

- [ ] **Step 2: Verify with a throwaway Node script**

Create `scripts/_verifyRecipeEngine.mjs`:

```js
import { buildRecipeSystemPrompt } from '../src/utils/recipeEngine.js'

const data = { settings: { macroGoals: { calories: 2200, proteinG: 120, carbsG: 220, fatG: 70 } } }
const prompt = buildRecipeSystemPrompt(data)
console.log('prompt includes protein goal:', prompt.includes('protein 120g'))
console.log('prompt includes calories goal:', prompt.includes('calories 2200'))
console.log('prompt length:', prompt.length)
```

Run: `node scripts/_verifyRecipeEngine.mjs`

Expected: both boolean lines log `true`; a reasonable non-zero length is printed. (`generateRecipe` itself calls the live Claude API and can't be exercised in this throwaway script without a real key — it's verified in Task 3's browser step instead.)

- [ ] **Step 3: Delete the throwaway script and commit**

```bash
rm scripts/_verifyRecipeEngine.mjs
git add src/utils/recipeEngine.js
git commit -m "Add recipe generation via the existing BYOK Claude integration"
```

---

### Task 3: Saved Recipes page

**Files:**
- Create: `src/pages/more/Recipes.jsx`
- Modify: `src/pages/More.jsx`

**Interfaces:**
- Consumes: `data.recipes`, `saveRecipe`, `deleteRecipe` from `useApp()` (Task 1); `hasApiKey` from `../../utils/claudeApi`; `generateRecipe` from `../../utils/recipeEngine` (Task 2).

- [ ] **Step 1: Write `src/pages/more/Recipes.jsx`**

```jsx
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { hasApiKey, ClaudeApiError } from '../../utils/claudeApi'
import { generateRecipe } from '../../utils/recipeEngine'
import BackHeader from '../../components/BackHeader'
import ConfirmDialog from '../../components/ConfirmDialog'
import Icon from '../../components/Icon'

export default function Recipes({ onBack, setView }) {
  const { data, saveRecipe, deleteRecipe } = useApp()
  const [prompt, setPrompt] = useState('')
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toDelete, setToDelete] = useState(null)

  const keyPresent = hasApiKey()
  const saved = [...data.recipes].reverse()

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError('')
    setDraft(null)
    try {
      const recipe = await generateRecipe(prompt.trim(), data)
      setDraft(recipe)
    } catch (e) {
      setError(e instanceof ClaudeApiError ? e.message : 'Something went wrong generating that recipe.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (draft) saveRecipe(draft)
    setDraft(null)
    setPrompt('')
  }

  const renderRecipe = (recipe, onSave) => (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{recipe.name}</div>
      {recipe.tags?.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-start', marginTop: 6 }}>
          {recipe.tags.map((t) => <span key={t} className="tag">{t}</span>)}
        </div>
      )}
      <div className="text-sm faint mono" style={{ marginTop: 8 }}>
        {recipe.macros.calories} kcal · {recipe.macros.proteinG}g protein · {recipe.macros.carbsG}g carbs · {recipe.macros.fatG}g fat
      </div>
      <div className="text-sm faint" style={{ marginTop: 10, fontWeight: 600 }}>Ingredients</div>
      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
        {recipe.ingredients.map((ing, i) => <li key={i} className="text-sm">{ing.name} — {ing.amount}</li>)}
      </ul>
      <div className="text-sm faint" style={{ marginTop: 10, fontWeight: 600 }}>Instructions</div>
      <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
        {recipe.instructions.map((step, i) => <li key={i} className="text-sm">{step}</li>)}
      </ol>
      {onSave && (
        <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={onSave}>Save</button>
      )}
    </div>
  )

  if (!keyPresent) {
    return (
      <div className="page">
        <BackHeader eyebrow="More" title="Recipes" onBack={onBack} />
        <div className="empty-state">
          <div className="icon"><Icon name="apple" size={26} /></div>
          <p>Connect your own Claude API key to generate recipes from what you ask for — nothing is sent anywhere until you add a key.</p>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setView('settings')}>Set up in Settings</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <BackHeader eyebrow="More" title="Recipes" onBack={onBack} />

      <div className="field">
        <label>What do you want to cook?</label>
        <input
          className="input"
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. something high-protein with chicken"
        />
      </div>
      <button className="btn btn-primary btn-block" onClick={handleGenerate} disabled={loading || !prompt.trim()}>
        {loading ? 'Generating…' : 'Generate'}
      </button>
      {error && <p className="text-sm" style={{ color: 'var(--danger)', marginTop: 8 }}>{error}</p>}

      {draft && renderRecipe(draft, handleSave)}

      <div className="section-title">Saved recipes</div>
      {saved.length === 0 ? (
        <div className="empty-state"><div className="icon"><Icon name="apple" size={26} /></div><p>No recipes saved yet.</p></div>
      ) : (
        <div className="stack">
          {saved.map((r) => (
            <div key={r.id} className="card" style={{ position: 'relative' }}>
              {renderRecipe(r, null)}
              <button
                className="btn-ghost"
                style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }}
                onClick={() => setToDelete(r)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete recipe?"
        message="This saved recipe will be removed."
        confirmLabel="Delete"
        danger
        onCancel={() => setToDelete(null)}
        onConfirm={() => { deleteRecipe(toDelete.id); setToDelete(null) }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Register the page in `src/pages/More.jsx`**

Add the import:

```js
import Recipes from './more/Recipes'
```

Add to `ITEMS`, after the `nutrition` entry:

```js
  { id: 'recipes', label: 'Recipes', desc: 'Ask for one, save your favorites', icon: 'apple' },
```

Add the render line. This page needs `setView` (to route to Settings when no key is configured), so follow the `coach` line's exact pattern:

```js
  if (view === 'recipes') return <Recipes onBack={() => setView(null)} setView={setView} />
```

- [ ] **Step 3: Verify in the browser**

With a Claude API key configured: navigate to More → Recipes, type a request (e.g. "something high-protein with chicken"), click Generate, confirm a recipe renders with name/tags/macros/ingredients/instructions, click Save, confirm it appears under "Saved recipes," delete it via the confirm dialog, confirm removal. Without a key configured (temporarily clear it in Settings), confirm the page shows the Settings-pointing empty state instead. Check `read_console_messages` for errors in both cases.

- [ ] **Step 4: Commit**

```bash
git add src/pages/more/Recipes.jsx src/pages/More.jsx
git commit -m "Add Saved Recipes page under More"
```

---

### Task 4: Macro goal editing on the Nutrition page

**Files:**
- Modify: `src/pages/more/Nutrition.jsx`

**Interfaces:**
- Consumes: `data.settings.macroGoals`, `setMacroGoals` from `useApp()` (Task 1).

- [ ] **Step 1: Add the macro-goals editing UI**

Follow `Water.jsx`'s existing goal-sheet pattern (a `Sheet` with number inputs and a "Save goal" button). In `src/pages/more/Nutrition.jsx`, add the import:

```js
import { useState } from 'react'
```

(Already imported — check the existing import line and merge if `useState` isn't already there; it is, since `viewDate` already uses it.)

Add `Sheet` to the imports:

```js
import Sheet from '../../components/Sheet'
```

Inside the component, alongside the existing `viewDate` state:

```js
  const { data, setNutritionItem, setMacroGoals } = useApp()
```

(This replaces the existing `const { data, setNutritionItem } = useApp()` line — add `setMacroGoals` to the destructure.)

Add new state:

```js
  const [goalsOpen, setGoalsOpen] = useState(false)
  const [draftGoals, setDraftGoals] = useState(data.settings.macroGoals)
```

Add a button to open the goals sheet — place it in the `BackHeader`'s `action` slot (following the same pattern as `Cycle.jsx`'s "+ Log" button):

```jsx
      <BackHeader
        eyebrow="More"
        title="Nutrition"
        onBack={onBack}
        action={<button className="btn-ghost" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }} onClick={() => { setDraftGoals(data.settings.macroGoals); setGoalsOpen(true) }}>Goals</button>}
      />
```

(This replaces the existing `<BackHeader eyebrow="More" title="Nutrition" onBack={onBack} />` line.)

Add the sheet, near the end of the JSX (before the closing `</div>` of `.page`):

```jsx
      <Sheet open={goalsOpen} onClose={() => setGoalsOpen(false)} title="Macro goals">
        <div className="field">
          <label>Calories</label>
          <input className="input" type="number" value={draftGoals.calories} onChange={(e) => setDraftGoals((g) => ({ ...g, calories: Number(e.target.value) }))} />
        </div>
        <div className="field">
          <label>Protein (g)</label>
          <input className="input" type="number" value={draftGoals.proteinG} onChange={(e) => setDraftGoals((g) => ({ ...g, proteinG: Number(e.target.value) }))} />
        </div>
        <div className="field">
          <label>Carbs (g)</label>
          <input className="input" type="number" value={draftGoals.carbsG} onChange={(e) => setDraftGoals((g) => ({ ...g, carbsG: Number(e.target.value) }))} />
        </div>
        <div className="field">
          <label>Fat (g)</label>
          <input className="input" type="number" value={draftGoals.fatG} onChange={(e) => setDraftGoals((g) => ({ ...g, fatG: Number(e.target.value) }))} />
        </div>
        <button className="btn btn-primary btn-block" onClick={() => { setMacroGoals(draftGoals); setGoalsOpen(false) }}>Save goals</button>
      </Sheet>
```

- [ ] **Step 2: Verify in the browser**

Navigate to More → Nutrition, click "Goals," change the protein value, click "Save goals," navigate away and back, confirm the new value persisted (reflected the next time the sheet is opened). Check `read_console_messages` for errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/more/Nutrition.jsx
git commit -m "Add macro goal editing to the Nutrition page"
```

---

### Task 5: End-to-end acceptance pass

**Files:** none (verification only).

- [ ] **Step 1: Re-check the design spec's acceptance criteria**

Go through `docs/superpowers/specs/2026-08-05-recipe-engine-design.md`'s acceptance criteria against what Tasks 1-4 produced:
- Generating a recipe with a Claude key configured returns a valid `Recipe` object (all fields present) rendered correctly.
- Without a key configured, the page shows the Settings-pointing note, not a broken Generate button.
- Saving persists to `data.recipes` and appears in the list; deleting removes it.
- Macro goals are editable on the Nutrition page and persist like the existing water/sleep goals.
- Grep the diff for `dangerouslySetInnerHTML` across `Recipes.jsx` and `recipeEngine.js` — confirm zero occurrences.

- [ ] **Step 2: Commit any final fixes found, or confirm clean**

If everything checks out with no changes needed, no commit is required — just confirm in your final report which items passed.
