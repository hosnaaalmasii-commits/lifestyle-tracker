// Per-meal macro estimation: one Claude call (optionally vision, when a
// photo is attached) turns a meal's name and/or photo into an estimated
// calories/protein/carbs/fat breakdown for a single serving. This is a
// deliberate estimate, not a food-database lookup — there's no nutrition
// API in this app, only the user's own Claude key (same BYOK model as
// the Coach and voice-logging pipeline) — so the system prompt leans on
// the model's general food knowledge and always returns a best guess
// rather than refusing when details are thin.
import { sendToClaude, ClaudeApiError } from './claudeApi'

const SYSTEM_PROMPT = `You estimate the nutrition of a single meal/serving for a health-tracking app. You may be given a short name/description, a photo, or both.

Respond with ONLY a single JSON object — no markdown fences, no prose before or after:
{
  "name": "short title for this meal, e.g. 'Grilled chicken salad'",
  "calories": number,
  "proteinG": number,
  "carbsG": number,
  "fatG": number,
  "confidence": "high" | "medium" | "low",
  "note": "one short sentence — what you assumed (portion size, ingredients) if the input was ambiguous"
}

Always give your best-guess numbers for a typical single serving, even from a vague name or an unclear photo — never refuse or leave a field null. Use "confidence": "low" (and say why in "note") rather than declining to estimate. Round calories to the nearest 10 and grams to the nearest whole number.`

function stripCodeFence(text) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : trimmed
}

function imageBlockFor(dataUrl) {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/s)
  if (!match) return null
  const [, mediaType, data] = match
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data } }
}

/**
 * name: string (optional if a photo is given)
 * photoDataUrl: base64 data URL (optional if a name is given)
 * Returns { name, calories, proteinG, carbsG, fatG, confidence, note }.
 */
export async function analyzeMeal({ name, photoDataUrl }) {
  if (!name?.trim() && !photoDataUrl) {
    throw new ClaudeApiError('Add a meal name or a photo first.')
  }

  const content = []
  const imageBlock = photoDataUrl ? imageBlockFor(photoDataUrl) : null
  if (imageBlock) content.push(imageBlock)
  content.push({
    type: 'text',
    text: name?.trim()
      ? `Meal: ${name.trim()}`
      : 'Estimate this meal from the photo alone — no name was given.',
  })

  const raw = await sendToClaude({
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
    maxTokens: 400,
  })

  let parsed
  try {
    parsed = JSON.parse(stripCodeFence(raw))
  } catch {
    throw new ClaudeApiError('Could not understand the response — try again.')
  }

  const num = (v) => (Number.isFinite(v) ? Math.max(0, v) : 0)
  return {
    name: parsed.name || name?.trim() || 'Meal',
    calories: num(parsed.calories),
    proteinG: num(parsed.proteinG),
    carbsG: num(parsed.carbsG),
    fatG: num(parsed.fatG),
    confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
    note: parsed.note || '',
  }
}
