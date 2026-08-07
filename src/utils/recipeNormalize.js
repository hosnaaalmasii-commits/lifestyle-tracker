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
export function normalizeRecipeFields(parsed) {
  return {
    ingredients: parsed.ingredients
      .filter((i) => i && typeof i === 'object')
      .map((i) => ({ name: String(i.name ?? ''), amount: String(i.amount ?? '') })),
    instructions: parsed.instructions
      .map((s) => (typeof s === 'string' ? s : String(s?.text ?? '')))
      .filter(Boolean),
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t) => typeof t === 'string') : [],
  }
}
