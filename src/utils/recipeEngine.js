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
