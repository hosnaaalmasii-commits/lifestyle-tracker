# Recipe & Macro Engine (minimal Chapter 04 foundation)

Status: approved by user, pending final spec review
Date: 2026-08-05

## Context

Scoped as a prerequisite, not the original request. The user asked for
"smart kitchen tools" (Smart Fridge Memory, Grocery Rescue, Leftover
Optimizer, Food Swap Engine) from the same external "Vitara" spec-kit
that's come up repeatedly this session, framed as extending an existing
recipe/macro engine from "Chapter 04." That engine doesn't exist —
`Nutrition.jsx` today is a 5-item boolean checklist (breakfast, lunch,
dinner, vegetables, mindful snacks), with no recipe format, no
ingredient model, and no macro tracking anywhere. All four requested
sub-features depend on that missing foundation, not just one of them —
a bigger version of the same problem the alcohol-tracking spec solved
for Damage Control Mode. The user chose to build a minimal real
foundation first, one sub-feature at a time thereafter.

This spec covers only the recipe/macro foundation — not Smart Fridge
Memory, Grocery Rescue, Leftover Optimizer, or Food Swap Engine. Those
are separate, later work, each to be brainstormed on its own.

## Goals

1. A `Recipe` object shape every future recipe-producing feature can
   share — so nothing downstream reinvents its own format (the explicit
   acceptance-criterion concern from the original request: a second
   recipe format that other modules won't understand).
2. A way to actually generate a recipe, given this app has no nutrition
   database or backend — reusing the existing BYOK Claude integration
   exactly as the Coach and voice-logging already do.
3. Basic macro targets (daily calorie/protein/carb/fat goals) so a
   future "goal-adjusted" recipe suggestion has something concrete to
   adjust against.
4. Real, standalone value now: a page to ask for a recipe and save it —
   not just invisible plumbing waiting for a consumer feature.

## Non-goals

- Smart Fridge Memory, Grocery Rescue, Leftover Optimizer, Food Swap
  Engine — all separate, later work.
- Any nutrition database, ingredient-level macro lookup, or barcode/UPC
  matching — macros come from Claude's own knowledge, not a lookup
  table this app maintains.
- Any backend, server, or new external service.
- Camera/computer-vision fridge-inventory features — already explicitly
  out of scope for this project on its own terms, unrelated to and not
  reopened by this spec.

## Recipe shape

```js
{
  id,                 // string, same makeId() pattern as every other entry
  name,               // string
  ingredients: [{ name, amount }],  // amount is a free-text string, e.g. "200g" or "2 cloves"
  instructions: [ /* string steps, in order */ ],
  macros: { calories, proteinG, carbsG, fatG },  // numbers
  tags: [ /* string, e.g. 'high-protein', 'quick', 'vegetarian' */ ],
}
```

This is the one shape every future sub-feature (grocery rescue, leftover
optimizer, food swap engine) must produce and consume — the thing this
spec exists to establish.

## Macro targets

New field in `DEFAULT_DATA.settings`: `macroGoals: { calories: 2000,
proteinG: 100, carbsG: 250, fatG: 65 }` (reasonable generic defaults,
same spirit as the existing `waterGoalMl`/`sleepGoalHours` defaults) —
editable via a new small section in Settings, same input pattern
already used for the existing numeric goals.

## Generation — `src/utils/recipeEngine.js`

- **`buildRecipeSystemPrompt(data)`** — describes the exact Recipe JSON
  shape above (following `voiceLogging.js`'s existing "respond with only
  a single JSON object, no markdown fences" convention), and includes
  the user's `macroGoals` so the model can frame the recipe against
  them when relevant.
- **`generateRecipe(promptText, data)`** — calls the existing
  `sendToClaude()` (from `claudeApi.js`) with that system prompt and the
  user's free-text request (e.g. "something high-protein with
  chicken"), parses the JSON response (same code-fence-stripping
  pattern `voiceLogging.js` already uses), and returns a `Recipe` object
  (`id` generated locally, not by the model). Throws the same
  `ClaudeApiError` on failure that every other AI call site already
  does — no new error type.

Free-text fields (`name`, `ingredients[].name`, `ingredients[].amount`,
`instructions[]`) are rendered through plain JSX text interpolation
(`{value}`), exactly like every other AI/user-generated string already
in this app (mood notes, budget notes, schedule text) — React escapes
this by default, and nothing in this feature introduces
`dangerouslySetInnerHTML` anywhere, so no additional sanitization layer
is needed beyond what every other free-text field in this app already
relies on.

## Data model

New top-level array in `DEFAULT_DATA`: `recipes: []`, entries are
`Recipe` objects plus a `savedAt` timestamp. Two new actions, matching
the existing array-field pattern exactly:

- `saveRecipe(recipe)` — appends `{ ...recipe, savedAt: Date.now() }`.
- `deleteRecipe(id)` — filters it out.

## UI

**`src/pages/more/Recipes.jsx`** — new minimal page:
- A free-text input ("What do you want to cook?") plus a "Generate"
  button.
- If no Claude API key is configured, the button is replaced with a
  note pointing at Settings → AI Coach, matching the exact optional-AI
  pattern voice-logging already uses (mic + manual logging work with
  zero key; the AI step is the one thing gated).
- The generated recipe renders (name, tags, macros, ingredients,
  instructions) with a "Save" button.
- Below that, the list of previously saved recipes, each deletable via
  the existing `ConfirmDialog` pattern used elsewhere (e.g.
  `Cycle.jsx`).

## Acceptance criteria

- [ ] Generating a recipe with a Claude key configured returns a valid
      `Recipe` object matching the shape above, rendered correctly.
- [ ] Without a Claude key configured, the page shows the
      Settings-pointing note instead of a broken/erroring Generate
      button.
- [ ] Saving a recipe persists it in `data.recipes` and it appears in
      the saved list; deleting removes it.
- [ ] Macro goals are editable in Settings and persist like the
      existing water/sleep goals.
- [ ] No free-text recipe field is rendered via `dangerouslySetInnerHTML`
      or any other means that would bypass React's default escaping.
