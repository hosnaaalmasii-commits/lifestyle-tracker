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
