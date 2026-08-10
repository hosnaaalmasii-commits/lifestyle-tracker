# Food Swap Engine (smart-kitchen-tools, chapter 1 of 4)

Status: approved by user, pending final spec review
Date: 2026-08-10

## Context

First of four smart-kitchen-tools sub-features from the external "Vitara"
spec-kit (Smart Fridge Memory, Grocery Rescue, Leftover Optimizer, Food
Swap Engine), each scoped as separate, later work per
`docs/superpowers/specs/2026-08-05-recipe-engine-design.md`'s explicit
non-goals. Build order for the four, agreed with the user: Food Swap
Engine first (fully independent, no new data model, builds directly on
the `Recipe` shape and `macroGoals` the recipe engine already
established), then Smart Fridge Memory (the "what's on hand" data
foundation the other two want), then Leftover Optimizer and Grocery
Rescue.

This spec covers only the Food Swap Engine.

## Goals

1. From a recipe (saved or freshly generated, on the existing Recipes
   page), let the user ask for a single-ingredient substitution aimed at
   a macro goal — lower calorie, higher protein, lower carb, or lower
   fat.
2. Reuse the existing BYOK Claude integration exactly as `generateRecipe`
   already does — no new external service, no new error type.
3. Apply the swap in place: the recipe's ingredient list and
   recipe-level macros update; the original recipe is not duplicated.

## Non-goals

- Rewriting recipe instructions to match the swap. Regenerating
  instructions would mean re-running the full recipe generator in cost
  and latency, not a lightweight swap. Instead, after a swap, a small
  caption under Instructions notes steps may need a small manual
  adjustment.
- Any dietary-restriction or allergy tracking. This app doesn't track
  either anywhere today; "lower calorie / higher protein / lower carb /
  lower fat" are the only supported swap directions for this chapter.
- Any ingredient/nutrition database — macros come from Claude's own
  knowledge for the swap, exactly as the recipe engine already works, not
  a lookup table this app maintains.
- Any backend, server, or new external service.
- Smart Fridge Memory, Grocery Rescue, Leftover Optimizer — separate,
  later work per the build order above.

## Swap flow

Entry point is a recipe already on screen (draft just generated, or a
saved recipe in the list) on `src/pages/more/Recipes.jsx`. Each
ingredient row gets a swap affordance, shown only when
`hasApiKey()` is true (matching the existing gating pattern — no point
offering a feature that can't run).

Tapping it opens a `Sheet` (not `ConfirmDialog` — this app has a
separate, already-flagged issue where `ConfirmDialog` bypasses
`Sheet.jsx`'s portal and renders `position:fixed` inline; new overlays
should go through `Sheet` from the start rather than repeating that
pattern) titled with the ingredient name, containing four buttons: Lower
calorie, Higher protein, Lower carb, Lower fat.

Tapping a direction calls `swapIngredient`. On success, the recipe's
ingredient at that index and its `macros` object are replaced in place —
via a new `updateRecipe(id, changes)` `AppContext` action for a saved
recipe, or local component state for an unsaved draft — and the sheet
closes. On failure, the error message renders inside the sheet (same
`ClaudeApiError`-vs-generic distinction the rest of this feature already
uses) and the sheet stays open so the user can retry or pick a different
direction. A loading state disables the four buttons while the call is
in flight.

## Generation — addition to `src/utils/recipeEngine.js`

- **`swapIngredient(recipe, ingredientIndex, direction, data)`** — builds
  a focused system prompt containing the recipe's current ingredients and
  macros, which ingredient (by name) is being replaced, the chosen
  direction (`lower-calorie` | `higher-protein` | `lower-carb` |
  `lower-fat`), and the user's `macroGoals` for context (same framing
  `buildRecipeSystemPrompt` already uses). Calls the existing
  `sendToClaude()` with that prompt. Parses the JSON response (same
  code-fence-stripping pattern as `generateRecipe`) and returns
  `{ ingredient: { name, amount }, macros: { calories, proteinG, carbsG,
  fatG } }`. Throws the same `ClaudeApiError` on failure that every other
  AI call site in this app already does — no new error type.
- Response fields are defensively normalized before use, extending the
  existing `normalizeRecipeFields` pattern in `recipeNormalize.js` to
  cover a single ingredient object the same way it already covers an
  ingredients array — so a malformed response degrades safely instead of
  crashing the page (this app has no error boundary above the Recipes
  page).

Free-text fields in the swap result (`ingredient.name`, `ingredient.amount`)
render through plain JSX text interpolation, exactly like every other
AI-generated string in this app — no `dangerouslySetInnerHTML` anywhere
in this feature.

## Data model

New action in `AppContext.jsx`, matching the existing `saveRecipe`/
`deleteRecipe` shape exactly:

- `updateRecipe(id, changes)` — merges `changes` into the matching entry
  in `data.recipes` by `id`.

No new top-level data fields.

## UI

`src/pages/more/Recipes.jsx`'s `renderRecipe` helper gains:
- A swap icon/button per ingredient row, shown only when `keyPresent`.
- A `Sheet` (title: the ingredient name) with four direction buttons,
  a loading state, and inline error display on failure.
- After a successful swap, a small caption under Instructions noting
  steps may need a small manual adjustment for the new ingredient.

## Acceptance criteria

- [ ] Tapping an ingredient's swap button opens a `Sheet` with the four
      direction buttons.
- [ ] Choosing a direction, with a Claude key configured, replaces that
      ingredient and updates the recipe's macros, both for an unsaved
      draft and for an already-saved recipe.
- [ ] On failure (bad key, malformed response, network error), the sheet
      shows an error message and stays open; the recipe is unchanged.
- [ ] No free-text swap field is rendered via `dangerouslySetInnerHTML`
      or any other means that bypasses React's default escaping.
- [ ] The swap affordance does not appear when no Claude API key is
      configured.
