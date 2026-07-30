// Voice/text-logging pipeline: turns a raw transcript into structured log
// entries via a single Claude call (intent detection + entity extraction),
// then writes the results into the app's normal data model through the
// same AppContext actions the manual log forms use — so a voice-logged
// entry is indistinguishable from a manually-logged one afterward.
import { sendToClaude, ClaudeApiError } from './claudeApi'
import { todayKey, addDaysToKey } from './dates'
import { MOOD_SCALE } from './moodActions'

export const BUDGET_CATEGORIES = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'health', 'other']
export const CYCLE_FLOW_OPTIONS = ['spotting', 'light', 'medium', 'heavy']
export const CYCLE_SYMPTOM_OPTIONS = ['cramps', 'headache', 'fatigue', 'bloating', 'mood swings', 'backache']
export const NUTRITION_SLOTS = ['breakfast', 'lunch', 'dinner', 'snacks']

export const CATEGORY_META = {
  drink: { label: 'Drink', icon: 'droplet', color: 'var(--accent-water)' },
  meal: { label: 'Meal', icon: 'apple', color: 'var(--accent)' },
  mood: { label: 'Mood', icon: 'heart', color: 'var(--accent)' },
  workout: { label: 'Workout', icon: 'dumbbell', color: 'var(--accent-workout)' },
  cycle: { label: 'Cycle', icon: 'droplet', color: 'var(--danger)' },
  schedule: { label: 'Schedule', icon: 'calendar', color: 'var(--accent)' },
  budget: { label: 'Budget', icon: 'scale', color: 'var(--warning)' },
}

// Only these field/category combinations are allowed to trigger a
// follow-up question — the field has to actually feed a downstream number
// (water ml total, a PR log, an expense total). Everything else (mood
// intensity, meal slot, cycle flow, schedule time) is cosmetic and should
// be logged with a best guess instead of interrupting the user.
const MATERIAL_FIELDS = {
  drink: ['volumeMl'],
  workout: ['weightKg', 'reps'],
  budget: ['amount'],
}

function buildSystemPrompt() {
  const today = todayKey()
  return `You convert one spoken/typed sentence from a health-tracking app's user into structured log entries. Respond with ONLY a single JSON object — no markdown fences, no prose before or after.

Today's date is ${today}. A sentence may describe one or more log entries.

Categories and their fields (use exactly these field names):
- "drink": { volumeMl: number }
- "meal": { slot: one of ${JSON.stringify(NUTRITION_SLOTS)}, includesVegetables: boolean }
- "mood": { label: one of ${JSON.stringify(MOOD_SCALE.map((m) => m.label))}, note: string|null }
- "workout": { mode: "complete_today" | "log_pr", exerciseName: string|null, weightKg: number|null, reps: number|null }
- "cycle": { flow: one of ${JSON.stringify(CYCLE_FLOW_OPTIONS)}|null, symptoms: string[] (subset of ${JSON.stringify(CYCLE_SYMPTOM_OPTIONS)}), note: string|null }
- "schedule": { time: "HH:MM"|null, text: string }
- "budget": { amount: number|null, category: one of ${JSON.stringify(BUDGET_CATEGORIES)}, note: string|null }

Use "workout" mode "log_pr" only when the user states a specific weight and/or reps for a specific exercise (e.g. "I benched 80kg for 8"). Use "complete_today" for generic completion ("I worked out", "did my workout").

For every field, wrap it as { "value": <the value>, "confidence": <tag> } where confidence is one of:
- "exact": stated directly and unambiguously
- "estimated": not stated, but a reasonable default was filled in
- "unknown": could not be determined at all
- "needs_confirmation": ambiguous AND this field is one that materially changes a downstream calculation for its category (drink.volumeMl, workout.weightKg, workout.reps, budget.amount — e.g. "a bottle of water" without a stated size, or "I spent some money on lunch" without an amount). Do NOT use needs_confirmation for cosmetic fields (mood intensity, meal slot, cycle flow/symptoms, schedule time, note text) even if they're ambiguous — just make a reasonable estimate or use "unknown" for those instead.

Output shape:
{
  "intents": [
    {
      "category": "drink" | "meal" | "mood" | "workout" | "cycle" | "schedule" | "budget",
      "when": "today" | "yesterday",
      "summary": "short human-readable description, e.g. 'Water — 500 ml'",
      "fields": { "<fieldName>": { "value": ..., "confidence": "..." }, ... },
      "followUp": null | { "field": "<fieldName>", "question": "short question to ask the user", "choices": [{"label": "...", "value": ...}, ...] | null }
    }
  ]
}

Include a "followUp" object only for a field marked "needs_confirmation" above (at most one per intent — pick the single most important one). Give 2-4 sensible "choices" when the field is a size/count with common real-world values (e.g. drink sizes: 200ml/330ml/500ml/750ml/1000ml); omit "choices" (use null) if it's better answered with a free-form number, like a budget amount.

If the sentence describes nothing loggable, return {"intents": []}.`
}

function stripCodeFence(text) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : trimmed
}

export async function parseVoiceTranscript(transcript) {
  const raw = await sendToClaude({
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: transcript }],
    maxTokens: 1024,
  })

  let parsed
  try {
    parsed = JSON.parse(stripCodeFence(raw))
  } catch {
    throw new ClaudeApiError('Could not understand the response — try rephrasing.')
  }

  const intents = Array.isArray(parsed.intents) ? parsed.intents : []
  return intents
    .filter((i) => CATEGORY_META[i.category])
    .map((intent, index) => ({
      id: `${Date.now().toString(36)}-${index}`,
      category: intent.category,
      when: intent.when === 'yesterday' ? 'yesterday' : 'today',
      summary: intent.summary || CATEGORY_META[intent.category].label,
      fields: intent.fields || {},
      followUp: normalizeFollowUp(intent.category, intent.followUp),
    }))
}

function normalizeFollowUp(category, followUp) {
  if (!followUp || !followUp.field) return null
  const allowed = MATERIAL_FIELDS[category] || []
  if (!allowed.includes(followUp.field)) return null
  return {
    field: followUp.field,
    question: followUp.question || 'Can you confirm this?',
    choices: Array.isArray(followUp.choices) && followUp.choices.length ? followUp.choices : null,
  }
}

function dateKeyFor(when) {
  return when === 'yesterday' ? addDaysToKey(todayKey(), -1) : todayKey()
}

function fv(fields, name, fallback = null) {
  return fields?.[name]?.value ?? fallback
}

// Writes one resolved intent (all needs_confirmation fields already
// answered) into the real data model via the same actions the manual log
// forms use.
export function applyVoiceIntent(actions, intent) {
  const dateKey = dateKeyFor(intent.when)
  const f = intent.fields

  switch (intent.category) {
    case 'drink': {
      const ml = Number(fv(f, 'volumeMl', 0))
      if (ml > 0) actions.addWater(ml, dateKey)
      break
    }
    case 'meal': {
      const slot = fv(f, 'slot')
      if (slot && NUTRITION_SLOTS.includes(slot)) actions.setNutritionItem(dateKey, slot, true)
      if (fv(f, 'includesVegetables', false)) actions.setNutritionItem(dateKey, 'vegetables', true)
      break
    }
    case 'mood': {
      const label = fv(f, 'label')
      const match = MOOD_SCALE.find((m) => m.label === label) || MOOD_SCALE[2]
      actions.addMood(match.emoji, fv(f, 'note', ''), dateKey)
      break
    }
    case 'workout': {
      if (fv(f, 'mode') === 'log_pr' && fv(f, 'exerciseName')) {
        actions.logExercisePR(fv(f, 'exerciseName'), Number(fv(f, 'weightKg', 0)), Number(fv(f, 'reps', 0)), dateKey)
      } else {
        actions.toggleWorkoutDay(dateKey)
      }
      break
    }
    case 'cycle': {
      actions.addCycleEntry({
        flow: fv(f, 'flow'),
        symptoms: fv(f, 'symptoms', []),
        note: fv(f, 'note', ''),
      }, dateKey)
      break
    }
    case 'schedule': {
      const text = fv(f, 'text')
      if (text) actions.addScheduleItem({ time: fv(f, 'time'), text }, dateKey)
      break
    }
    case 'budget': {
      const amount = Number(fv(f, 'amount', 0))
      if (amount > 0) {
        actions.addExpense({ amount, category: fv(f, 'category', 'other'), note: fv(f, 'note', '') }, dateKey)
      }
      break
    }
    default:
      break
  }
}
