# Food Swap Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user swap a single ingredient in a recipe (saved or freshly generated) toward a macro-direction goal, updating that recipe's ingredient and macros in place.

**Architecture:** One new generation function (`swapIngredient`, alongside `generateRecipe` in `recipeEngine.js`) reusing the existing BYOK Claude integration, one new `AppContext` action (`updateRecipe`) for saved recipes, and a `Sheet`-based direction picker added to the existing Recipes page.

**Tech Stack:** Plain JS (no TypeScript), React, existing `AppContext`/`Sheet`/`ConfirmDialog` patterns, the existing `claudeApi.js`/`sendToClaude` BYOK call site. No test framework — verification via throwaway Node scripts (pure logic) and the real dev server/browser (UI, AI call).

## Global Constraints

- Swap direction values are exactly: `lower-calorie`, `higher-protein`, `lower-carb`, `lower-fat` — every piece (system prompt builder, UI buttons) must use these exact strings.
- Swap generation goes through the existing `sendToClaude()` (from `claudeApi.js`) — no new external service, no new error type (reuse `ClaudeApiError`).
- No ingredient/macro database — macros for a swap come from Claude's own output, not computed locally, same as recipe generation.
- Free-text swap fields (ingredient name/amount) render via plain JSX text interpolation only — no `dangerouslySetInnerHTML` anywhere in this feature.
- No backend, no new external service.
- Any new overlay/modal goes through the existing `Sheet` component (portal-based) — never a raw `position: fixed` element rendered inline. This app has a documented, currently-being-audited bug where `ConfirmDialog` violates this; do not repeat that pattern in new code.
- Local relative imports are extensionless (Vite convention) — this repo has twice reverted a `.js`-extension regression. This project has `"type": "module"` in `package.json`, so Node's ESM loader requires extensions on relative imports when a file is executed directly via plain `node` — but Vite resolves extensionless imports fine at build/runtime. Any file that imports `./claudeApi` (directly or transitively, e.g. `recipeEngine.js`) CANNOT be executed directly via plain `node` for verification — use `npm run build` plus careful manual inspection instead. Files with zero imports (like `recipeNormalize.js`) CAN be run directly with plain `node`.

---

### Task 1: Data model — `updateRecipe` action

**Files:**
- Modify: `src/context/AppContext.jsx`

**Interfaces:**
- Produces: `updateRecipe(id, changes)` action. Task 3 depends on this exact name and signature.

- [ ] **Step 1: Add the `updateRecipe` action**

Find the existing `saveRecipe`/`deleteRecipe` pair (this exact code currently exists):

```js
    saveRecipe: (recipe) => {
      setData((d) => ({ ...d, recipes: [...d.recipes, { ...recipe, id: recipe.id || makeId(), savedAt: Date.now() }] }))
    },
    deleteRecipe: (id) => setData((d) => ({ ...d, recipes: d.recipes.filter((r) => r.id !== id) })),
```

Immediately after it, add:

```js
    updateRecipe: (id, changes) => {
      setData((d) => ({ ...d, recipes: d.recipes.map((r) => (r.id === id ? { ...r, ...changes } : r)) }))
    },
```

- [ ] **Step 2: Verify with a throwaway Node script**

`AppContext.jsx` is a React context, not directly importable in plain Node without a DOM — verify by inspection instead: re-read the edited spot and confirm it matches exactly what's specified above, then run `npm run build` to catch any syntax errors.

Run: `npm run build`

Expected: builds successfully with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/context/AppContext.jsx
git commit -m "Add updateRecipe action for in-place ingredient swaps"
```

---

### Task 2: Ingredient normalization + swap generation via Claude

**Files:**
- Modify: `src/utils/recipeNormalize.js`
- Modify: `src/utils/recipeEngine.js`

**Interfaces:**
- Consumes: `sendToClaude`, `ClaudeApiError` from `./claudeApi` (in `recipeEngine.js`).
- Produces: `normalizeIngredient(i) -> { name, amount }` (new export from `recipeNormalize.js`); `buildSwapSystemPrompt(recipe, ingredientName, direction, data) -> string` and `swapIngredient(recipe, ingredientIndex, direction, data) -> Promise<{ ingredient: { name, amount }, macros: { calories, proteinG, carbsG, fatG } }>` (new exports from `recipeEngine.js`). Task 3 imports `swapIngredient` by this exact name and calls it with this exact argument order.
- Direction values are exactly: `'lower-calorie' | 'higher-protein' | 'lower-carb' | 'lower-fat'`.

- [ ] **Step 1: Extract `normalizeIngredient` in `recipeNormalize.js`**

Replace the full content of `src/utils/recipeNormalize.js` with:

```js
// Pure helper, deliberately free of any imports (including the extensionless
// './claudeApi' import that recipeEngine.js carries) so it can be exercised
// directly with plain Node during manual verification, in addition to Vite.
//
// Coerces a parsed-but-untrusted Claude response into the primitive shapes
// the UI (Recipes.jsx) actually renders. Claude's JSON output can plausibly
// deviate from the requested schema (e.g. instructions as `{ step, text }`
// objects instead of plain strings) — rendering an object directly as a
// React child throws and, since no error boundary wraps this page, would
// white-screen the whole app. Normalize defensively instead of trusting the
// model's shape verbatim.
export function normalizeIngredient(i) {
  if (!i || typeof i !== 'object') return { name: '', amount: '' }
  return { name: String(i.name ?? ''), amount: String(i.amount ?? '') }
}

export function normalizeRecipeFields(parsed) {
  return {
    ingredients: parsed.ingredients
      .filter((i) => i && typeof i === 'object')
      .map(normalizeIngredient),
    instructions: parsed.instructions
      .map((s) => (typeof s === 'string' ? s : String(s?.text ?? '')))
      .filter(Boolean),
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t) => typeof t === 'string') : [],
  }
}
```

This is a refactor-safe change: `normalizeRecipeFields`'s behavior is unchanged (same filter before map, same output for the same input) — only the per-item coercion logic is now pulled out into a separately-exported, reusable function. Do not change the `.filter((i) => i && typeof i === 'object')` line's behavior — it stays exactly as-is.

- [ ] **Step 2: Verify `normalizeIngredient` with a throwaway Node script**

This file has zero imports, so plain `node` can run it directly (see Global Constraints).

Create `scripts/_verifyNormalizeIngredient.mjs`:

```js
import { normalizeIngredient, normalizeRecipeFields } from '../src/utils/recipeNormalize.js'

const cases = [
  [{ name: 'chicken', amount: '200g' }, { name: 'chicken', amount: '200g' }],
  [{ name: 'chicken' }, { name: 'chicken', amount: '' }],
  [null, { name: '', amount: '' }],
  [['chicken', '200g'], { name: '', amount: '' }],
  [{ name: 42, amount: null }, { name: '42', amount: '' }],
]

let pass = 0
for (const [input, expected] of cases) {
  const result = normalizeIngredient(input)
  const ok = result.name === expected.name && result.amount === expected.amount
  console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(input), '->', JSON.stringify(result))
  if (ok) pass++
}
console.log(`${pass}/${cases.length} passed`)

const fields = normalizeRecipeFields({
  ingredients: [{ name: 'rice', amount: '1 cup' }],
  instructions: ['Cook rice', { text: 'Serve' }],
  tags: ['quick', 42],
})
const expectedFields = {
  ingredients: [{ name: 'rice', amount: '1 cup' }],
  instructions: ['Cook rice', 'Serve'],
  tags: ['quick'],
}
console.log('normalizeRecipeFields unchanged:', JSON.stringify(fields) === JSON.stringify(expectedFields))
```

Run: `node scripts/_verifyNormalizeIngredient.mjs`

Expected: `5/5 passed` and `normalizeRecipeFields unchanged: true`.

- [ ] **Step 3: Delete the throwaway script**

```bash
rm scripts/_verifyNormalizeIngredient.mjs
```

- [ ] **Step 4: Add `buildSwapSystemPrompt` and `swapIngredient` to `recipeEngine.js`**

Replace the full content of `src/utils/recipeEngine.js` with:

```js
import { sendToClaude, ClaudeApiError } from './claudeApi'
import { normalizeRecipeFields, normalizeIngredient } from './recipeNormalize'

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

  const { ingredients, instructions, tags } = normalizeRecipeFields(parsed)

  return {
    id: makeId(),
    name: String(parsed.name ?? ''),
    ingredients,
    instructions,
    macros: {
      calories: Number(parsed.macros.calories) || 0,
      proteinG: Number(parsed.macros.proteinG) || 0,
      carbsG: Number(parsed.macros.carbsG) || 0,
      fatG: Number(parsed.macros.fatG) || 0,
    },
    tags,
  }
}

const SWAP_DIRECTION_TEXT = {
  'lower-calorie': 'lower in calories',
  'higher-protein': 'higher in protein',
  'lower-carb': 'lower in carbohydrates',
  'lower-fat': 'lower in fat',
}

export function buildSwapSystemPrompt(recipe, ingredientName, direction, data) {
  const goals = data.settings.macroGoals
  const directionText = SWAP_DIRECTION_TEXT[direction]
  const ingredientList = recipe.ingredients.map((i) => `${i.name} (${i.amount})`).join(', ')

  return `You suggest a single ingredient substitution for an existing recipe in a personal health-tracking app. Respond with ONLY a single JSON object — no markdown fences, no prose before or after.

Recipe: "${recipe.name}"
Current ingredients: ${ingredientList}
Current macros for the whole recipe: ${recipe.macros.calories} kcal, ${recipe.macros.proteinG}g protein, ${recipe.macros.carbsG}g carbs, ${recipe.macros.fatG}g fat

Replace "${ingredientName}" with a substitute that makes the recipe ${directionText}. Keep every other ingredient the same. Recalculate the whole recipe's macros with the substitution applied.

The user's daily macro goals (for context only): calories ${goals.calories}, protein ${goals.proteinG}g, carbs ${goals.carbsG}g, fat ${goals.fatG}g.

Output shape (all fields required):
{
  "ingredient": { "name": "string", "amount": "string, e.g. '200g' or '2 cloves'" },
  "macros": { "calories": number, "proteinG": number, "carbsG": number, "fatG": number }
}`
}

export async function swapIngredient(recipe, ingredientIndex, direction, data) {
  const ingredientName = recipe.ingredients[ingredientIndex]?.name || ''
  const raw = await sendToClaude({
    system: buildSwapSystemPrompt(recipe, ingredientName, direction, data),
    messages: [{ role: 'user', content: `Swap the "${ingredientName}" ingredient to make this recipe ${SWAP_DIRECTION_TEXT[direction]}.` }],
    maxTokens: 512,
  })

  let parsed
  try {
    parsed = JSON.parse(stripCodeFence(raw))
  } catch {
    throw new ClaudeApiError('Could not understand the response — try a different direction.')
  }

  if (!parsed.ingredient || !parsed.macros) {
    throw new ClaudeApiError('Got an incomplete swap — try again.')
  }

  return {
    ingredient: normalizeIngredient(parsed.ingredient),
    macros: {
      calories: Number(parsed.macros.calories) || 0,
      proteinG: Number(parsed.macros.proteinG) || 0,
      carbsG: Number(parsed.macros.carbsG) || 0,
      fatG: Number(parsed.macros.fatG) || 0,
    },
  }
}
```

- [ ] **Step 5: Verify with `npm run build` plus manual inspection**

`recipeEngine.js` imports `./claudeApi`, so it cannot be executed directly via plain `node` (see Global Constraints). Verify instead:
- Run `npm run build` and confirm it succeeds.
- Re-read the file and confirm `buildSwapSystemPrompt` correctly interpolates the recipe name, current ingredient list, current macros, the target ingredient name, the direction text, and the user's macro goals.
- Confirm `swapIngredient`'s parsing/validation/normalization mirrors `generateRecipe`'s established pattern exactly: `JSON.parse` + `stripCodeFence`, `ClaudeApiError` on parse failure, a presence check before use, `normalizeIngredient` for the ingredient, and `Number(...) || 0` fallbacks for each macro field.

Run: `npm run build`

Expected: builds successfully with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/utils/recipeNormalize.js src/utils/recipeEngine.js
git commit -m "Add ingredient swap generation via the existing BYOK Claude integration"
```

---

### Task 3: Swap UI on the Recipes page

**Files:**
- Modify: `src/pages/more/Recipes.jsx`

**Interfaces:**
- Consumes: `updateRecipe` from `useApp()` (Task 1); `swapIngredient` from `../../utils/recipeEngine` (Task 2); `Sheet` from `../../components/Sheet` (existing component — `open`, `onClose`, `title`, `children` props).

- [ ] **Step 1: Replace the full content of `src/pages/more/Recipes.jsx`**

```jsx
import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { hasApiKey, ClaudeApiError } from '../../utils/claudeApi'
import { generateRecipe, swapIngredient } from '../../utils/recipeEngine'
import BackHeader from '../../components/BackHeader'
import ConfirmDialog from '../../components/ConfirmDialog'
import Sheet from '../../components/Sheet'
import Icon from '../../components/Icon'

const SWAP_DIRECTIONS = [
  { value: 'lower-calorie', label: 'Lower calorie' },
  { value: 'higher-protein', label: 'Higher protein' },
  { value: 'lower-carb', label: 'Lower carb' },
  { value: 'lower-fat', label: 'Lower fat' },
]

export default function Recipes({ onBack, setView }) {
  const { data, saveRecipe, deleteRecipe, updateRecipe } = useApp()
  const [prompt, setPrompt] = useState('')
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toDelete, setToDelete] = useState(null)
  const [swapTarget, setSwapTarget] = useState(null)
  const [swapLoading, setSwapLoading] = useState(false)
  const [swapError, setSwapError] = useState('')
  const [lastSwappedKey, setLastSwappedKey] = useState(null)

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

  const handleSwap = async (direction) => {
    if (!swapTarget) return
    setSwapLoading(true)
    setSwapError('')
    try {
      const result = await swapIngredient(swapTarget.recipe, swapTarget.ingredientIndex, direction, data)
      const updatedIngredients = swapTarget.recipe.ingredients.map((ing, i) =>
        i === swapTarget.ingredientIndex ? result.ingredient : ing
      )
      if (swapTarget.recipeKey === 'draft') {
        setDraft((d) => (d ? { ...d, ingredients: updatedIngredients, macros: result.macros } : d))
      } else {
        updateRecipe(swapTarget.recipeKey, { ingredients: updatedIngredients, macros: result.macros })
      }
      setLastSwappedKey(swapTarget.recipeKey)
      setSwapTarget(null)
    } catch (e) {
      setSwapError(e instanceof ClaudeApiError ? e.message : 'Something went wrong with that swap.')
    } finally {
      setSwapLoading(false)
    }
  }

  const renderRecipe = (recipe, onSave, recipeKey) => (
    <div className="card" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{recipe.name}</div>
      {recipe.tags?.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-start', marginTop: 6 }}>
          {recipe.tags.map((t, i) => (
            <span
              key={i}
              className="tag"
              style={{
                background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
                color: 'var(--accent)',
                borderRadius: 999,
                padding: '3px 10px',
                fontSize: 12,
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      <div className="text-sm faint mono" style={{ marginTop: 8 }}>
        {recipe.macros.calories} kcal · {recipe.macros.proteinG}g protein · {recipe.macros.carbsG}g carbs · {recipe.macros.fatG}g fat
      </div>
      <div className="text-sm faint" style={{ marginTop: 10, fontWeight: 600 }}>Ingredients</div>
      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
        {recipe.ingredients.map((ing, i) => (
          <li
            key={i}
            className="text-sm"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}
          >
            <span>{ing.name} — {ing.amount}</span>
            {keyPresent && (
              <button
                aria-label="Swap ingredient"
                onClick={() => setSwapTarget({ recipe, recipeKey, ingredientIndex: i })}
                style={{
                  background: 'var(--surface-soft)', border: '1px solid var(--border)', borderRadius: '50%',
                  width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0, marginLeft: 8, padding: 0,
                }}
              >
                <Icon name="repeat" size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="text-sm faint" style={{ marginTop: 10, fontWeight: 600 }}>Instructions</div>
      <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
        {recipe.instructions.map((step, i) => <li key={i} className="text-sm">{step}</li>)}
      </ol>
      {lastSwappedKey === recipeKey && (
        <p className="text-sm faint" style={{ marginTop: 8, fontStyle: 'italic' }}>
          Steps may need a small adjustment for this swap.
        </p>
      )}
      {onSave && (
        <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={onSave}>Save</button>
      )}
    </div>
  )

  return (
    <div className="page">
      <BackHeader eyebrow="More" title="Recipes" onBack={onBack} />

      {keyPresent ? (
        <>
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

          {draft && renderRecipe(draft, handleSave, 'draft')}
        </>
      ) : (
        <div className="empty-state">
          <div className="icon"><Icon name="apple" size={26} /></div>
          <p>Connect your own Claude API key to generate recipes from what you ask for — nothing is sent anywhere until you add a key.</p>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setView('settings')}>Set up in Settings</button>
        </div>
      )}

      <div className="section-title">Saved recipes</div>
      {saved.length === 0 ? (
        <div className="empty-state"><div className="icon"><Icon name="apple" size={26} /></div><p>No recipes saved yet.</p></div>
      ) : (
        <div className="stack">
          {saved.map((r) => (
            <div key={r.id} style={{ position: 'relative' }}>
              {renderRecipe(r, null, r.id)}
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

      <Sheet
        open={!!swapTarget}
        onClose={() => { setSwapTarget(null); setSwapError('') }}
        title={swapTarget ? `Swap ${swapTarget.recipe.ingredients[swapTarget.ingredientIndex]?.name || ''}` : ''}
      >
        <div className="stack">
          {SWAP_DIRECTIONS.map((d) => (
            <button
              key={d.value}
              className="btn btn-secondary btn-block"
              disabled={swapLoading}
              onClick={() => handleSwap(d.value)}
            >
              {swapLoading ? 'Swapping…' : d.label}
            </button>
          ))}
        </div>
        {swapError && <p className="text-sm" style={{ color: 'var(--danger)', marginTop: 8 }}>{swapError}</p>}
      </Sheet>
    </div>
  )
}
```

- [ ] **Step 2: Verify in the browser**

Start the dev server from this repo's own directory (not a different checkout — confirm by fetching `/src/pages/more/Recipes.jsx` from the running server and checking it contains `swapTarget` before trusting anything else the browser shows).

To exercise the AI call without a real Anthropic key: mock `window.fetch` for URLs containing `api.anthropic.com` (return a fake successful response in Claude's expected format) and set a fake value under the `lifestyle-tracker-anthropic-key` localStorage key, per this project's documented dev workflow.

Test, with the mocked key present:
- Generate or open a saved recipe. Confirm a small swap icon (the `repeat` icon) appears next to every ingredient.
- Tap a swap icon. Confirm a `Sheet` opens titled with that ingredient's name, containing four buttons: Lower calorie, Higher protein, Lower carb, Lower fat. Use `getBoundingClientRect()` to confirm the buttons are actually visible on screen, not just present in the DOM (this app has a documented history of overlay/`position:fixed` bugs).
- Tap a direction. Confirm the ingredient and the macros line update, the sheet closes, and the "Steps may need a small adjustment for this swap" caption appears under Instructions.
- Repeat once for a **saved** recipe specifically (not just the draft): confirm the swap persists after navigating away from Recipes and back.
- Make the mocked `fetch` return an error response (or malformed JSON) for one swap attempt. Confirm the sheet shows an error message, stays open, and the recipe is unchanged.

Then clear the mocked key and confirm no swap icon renders next to any ingredient (on either a draft or a saved recipe).

Check `read_console_messages` for errors throughout.

- [ ] **Step 3: Commit**

```bash
git add src/pages/more/Recipes.jsx
git commit -m "Add ingredient swap UI to the Recipes page"
```

---

### Task 4: End-to-end acceptance pass

**Files:** none (verification only).

- [ ] **Step 1: Re-check the design spec's acceptance criteria**

Go through `docs/superpowers/specs/2026-08-10-food-swap-engine-design.md`'s acceptance criteria against what Tasks 1-3 produced:
- Tapping an ingredient's swap button opens a `Sheet` with the four direction buttons.
- Choosing a direction, with a Claude key configured, replaces that ingredient and updates the recipe's macros, both for an unsaved draft and for an already-saved recipe.
- On failure, the sheet shows an error message and stays open; the recipe is unchanged.
- Grep the diff for `dangerouslySetInnerHTML` across `Recipes.jsx`, `recipeEngine.js`, and `recipeNormalize.js` — confirm zero occurrences.
- The swap affordance does not appear when no Claude API key is configured.

- [ ] **Step 2: Commit any final fixes found, or confirm clean**

If everything checks out with no changes needed, no commit is required — just confirm in your final report which items passed.
