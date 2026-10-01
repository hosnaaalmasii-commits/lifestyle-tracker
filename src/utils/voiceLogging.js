// Voice/text-logging pipeline: turns a raw transcript into structured log
// entries via a single Claude call (intent detection + entity extraction),
// then writes the results into the app's normal data model through the
// same AppContext actions the manual log forms use — so a voice-logged
// entry is indistinguishable from a manually-logged one afterward.
import { sendToClaude, ClaudeApiError } from './claudeApi'
import { todayKey, addDaysToKey } from './dates'
import { MOOD_SCALE } from './moodActions'
import { getTasksForDate, getAppointmentsForDate } from './taskSchedule'
import { replanDay, toMin, toHHMM } from './dayReplan'
import { hasOrsKey, fillRouteTravel, DEFAULT_TRAVEL_MODE } from './routing'

export const BUDGET_CATEGORIES = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'health', 'other']
export const CYCLE_FLOW_OPTIONS = ['spotting', 'light', 'medium', 'heavy']
export const CYCLE_SYMPTOM_OPTIONS = ['cramps', 'headache', 'fatigue', 'bloating', 'mood swings', 'backache']
export const NUTRITION_SLOTS = ['breakfast', 'lunch', 'dinner', 'snacks']

export const CATEGORY_META = {
  drink: { label: 'Drink', icon: 'droplet', color: 'var(--accent-water)' },
  alcohol: { label: 'Alcohol', icon: 'droplet', color: 'var(--danger)' },
  meal: { label: 'Meal', icon: 'apple', color: 'var(--accent)' },
  mood: { label: 'Mood', icon: 'heart', color: 'var(--accent)' },
  workout: { label: 'Workout', icon: 'dumbbell', color: 'var(--accent-workout)' },
  cycle: { label: 'Cycle', icon: 'droplet', color: 'var(--danger)' },
  schedule: { label: 'Schedule', icon: 'calendar', color: 'var(--accent)' },
  budget: { label: 'Budget', icon: 'scale', color: 'var(--warning)' },
  sleep: { label: 'Sleep', icon: 'moon', color: 'var(--accent-sleep)' },
  weight: { label: 'Weight', icon: 'scale', color: 'var(--accent)' },
  food: { label: 'Meal', icon: 'utensils', color: 'var(--accent)' },
  appointment: { label: 'Appointment', icon: 'calendar', color: 'var(--second)' },
  place: { label: 'Place', icon: 'compass', color: 'var(--second)' },
  task_done: { label: 'Task done', icon: 'check', color: 'var(--second)' },
  note: { label: 'Note', icon: 'chat', color: 'var(--text-soft)' },
}

// Where each category ends up in the app — shown after a voice log is
// saved so the user sees it landed in the right place.
export const CATEGORY_DESTINATION = {
  drink: 'Water', alcohol: 'Alcohol', meal: 'Voeding', food: 'Voeding', mood: 'Stemming',
  workout: 'Training', cycle: 'Cyclus', schedule: 'Agenda', budget: 'Budget', sleep: 'Slaap',
  weight: 'Gewicht', appointment: 'Vandaag', place: 'Plaatsen', task_done: 'Vandaag', note: 'Notities',
}

// Only these field/category combinations are allowed to trigger a
// follow-up question — the field has to actually feed a downstream number
// (water ml total, a PR log, an expense total). Everything else (mood
// intensity, meal slot, cycle flow, schedule time) is cosmetic and should
// be logged with a best guess instead of interrupting the user.
const MATERIAL_FIELDS = {
  drink: ['volumeMl'],
  alcohol: ['count'],
  workout: ['weightKg', 'reps'],
  budget: ['amount'],
}

function buildSystemPrompt(context = {}) {
  const today = todayKey()
  const now = new Date()
  const nowHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const tasks = (context.tasks || []).map((t) => `- id=${t.id} ${t.time} ${t.label}${t.done ? ' (done)' : ''}`).join('\n') || '(none)'
  const places = (context.places || []).map((p) => `- ${p.name}: ${p.address}`).join('\n') || '(none saved)'
  return `You convert one spoken/typed sentence from a health-tracking app's user into structured log entries. Respond with ONLY a single JSON object — no markdown fences, no prose before or after.

Today's date is ${today}, the time is now ${nowHHMM}. A sentence may describe one or more log entries — split it into as many as it contains.

Today's scheduled tasks (for "task_done"):
${tasks}

Saved places (for "appointment" locations and "place"):
${places}

Categories and their fields (use exactly these field names):
- "drink": { volumeMl: number } — non-alcoholic fluid intake (water, tea, coffee, juice, etc.)
- "alcohol": { count: number } — number of alcoholic drinks (beer, wine, spirits, cocktails, etc.)
- "meal": { slot: one of ${JSON.stringify(NUTRITION_SLOTS)}, includesVegetables: boolean }
- "mood": { label: one of ${JSON.stringify(MOOD_SCALE.map((m) => m.label))}, note: string|null }
- "workout": { mode: "complete_today" | "log_pr", exerciseName: string|null, weightKg: number|null, reps: number|null }
- "cycle": { flow: one of ${JSON.stringify(CYCLE_FLOW_OPTIONS)}|null, symptoms: string[] (subset of ${JSON.stringify(CYCLE_SYMPTOM_OPTIONS)}), note: string|null }
- "schedule": { time: "HH:MM"|null, text: string }
- "budget": { amount: number|null, category: one of ${JSON.stringify(BUDGET_CATEGORIES)}, note: string|null }
- "sleep": { hours: number, quality: 1-5|null } — how long they slept last night (1 = rough … 5 = great)
- "weight": { kg: number }
- "food": { name: string, slot: one of ${JSON.stringify(NUTRITION_SLOTS)}, calories: number, proteinG: number, carbsG: number, fatG: number } — a specific thing they ate; always give a realistic single-serving estimate for the numbers (confidence "estimated"). Prefer "food" over "meal" whenever the food itself is named.
- "appointment": { title: string, start: "HH:MM", end: "HH:MM"|null, location: string|null, travelMinutes: number|null } — something happening today at a time (doctor, meeting, dinner out). If a saved place is meant, use its address as location. Estimate one-way travel minutes from home when a location is given.
- "place": { name: string, address: string } — the user tells you where something is ("my gym is at …", "I live at …"); use name "home" for where they live.
- "task_done": { taskId: string } — they say they did one of today's scheduled tasks; use the matching id from the list above.
- "note": { text: string } — anything worth keeping that fits no other category.

Use "workout" mode "log_pr" only when the user states a specific weight and/or reps for a specific exercise (e.g. "I benched 80kg for 8"). Use "complete_today" for generic completion ("I worked out", "did my workout").

For every field, wrap it as { "value": <the value>, "confidence": <tag> } where confidence is one of:
- "exact": stated directly and unambiguously
- "estimated": not stated, but a reasonable default was filled in
- "unknown": could not be determined at all
- "needs_confirmation": ambiguous AND this field is one that materially changes a downstream calculation for its category (drink.volumeMl, alcohol.count, workout.weightKg, workout.reps, budget.amount — e.g. "a bottle of water" without a stated size, "a couple of drinks" without a stated number, or "I spent some money on lunch" without an amount). Do NOT use needs_confirmation for cosmetic fields (mood intensity, meal slot, cycle flow/symptoms, schedule time, note text) even if they're ambiguous — just make a reasonable estimate or use "unknown" for those instead.

Output shape:
{
  "intents": [
    {
      "category": "drink" | "alcohol" | "meal" | "mood" | "workout" | "cycle" | "schedule" | "budget" | "sleep" | "weight" | "food" | "appointment" | "place" | "task_done" | "note",
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

// context: { tasks: today's tasks [{id,time,label,done}], places: [{name,address}] }
export async function parseVoiceTranscript(transcript, context) {
  const raw = await sendToClaude({
    system: buildSystemPrompt(context),
    messages: [{ role: 'user', content: transcript }],
    maxTokens: 4000,
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
// forms use. `actions` is the useApp() value (so it also carries `data`).
export function applyVoiceIntent(actions, intent) {
  const dateKey = dateKeyFor(intent.when)
  const f = intent.fields

  switch (intent.category) {
    case 'drink': {
      const ml = Number(fv(f, 'volumeMl', 0))
      if (ml > 0) actions.addWater(ml, dateKey)
      break
    }
    case 'alcohol': {
      const count = Number(fv(f, 'count', 0))
      if (count > 0) actions.addAlcoholEntry({ count }, dateKey)
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
    case 'sleep': {
      const hours = Number(fv(f, 'hours', 0))
      if (hours > 0) actions.logSleep(dateKey, hours, Number(fv(f, 'quality', 3)) || 3)
      break
    }
    case 'weight': {
      const kg = Number(fv(f, 'kg', 0))
      if (kg > 0) actions.addWeight(kg, dateKey)
      break
    }
    case 'food': {
      const name = fv(f, 'name')
      if (!name) break
      actions.addMeal({
        name,
        calories: Number(fv(f, 'calories', 0)) || 0,
        proteinG: Number(fv(f, 'proteinG', 0)) || 0,
        carbsG: Number(fv(f, 'carbsG', 0)) || 0,
        fatG: Number(fv(f, 'fatG', 0)) || 0,
        confidence: 'medium',
      }, dateKey)
      const slot = fv(f, 'slot')
      if (slot && NUTRITION_SLOTS.includes(slot)) actions.setNutritionItem(dateKey, slot, true)
      break
    }
    case 'appointment': {
      const start = fv(f, 'start')
      if (!/^\d{2}:\d{2}$/.test(start || '')) break
      let end = fv(f, 'end')
      if (!/^\d{2}:\d{2}$/.test(end || '') || toMin(end) <= toMin(start)) end = toHHMM(toMin(start) + 60)
      const travel = String(Math.max(0, Number(fv(f, 'travelMinutes', 0)) || 0))
      const data = actions.data
      const appointments = [
        ...getAppointmentsForDate(data.dayOverrides, dateKey),
        {
          id: `appt-voice-${Date.now().toString(36)}`, title: fv(f, 'title') || 'Afspraak', start, end, location: fv(f, 'location') || '',
          travelBefore: travel, travelAfter: travel,
          // The parser estimates travel itself, so a real route may replace it.
          travelEstimated: !!fv(f, 'location'),
        },
      ]
      const replanWith = (appts) => {
        const now = new Date()
        const { tasks } = replanDay(getTasksForDate(data.taskSchedule, dateKey), appts, {
          completed: data.taskCompletions[dateKey] || {},
          nowMin: dateKey === todayKey() ? now.getHours() * 60 + now.getMinutes() : null,
        })
        actions.applyDayReplan(dateKey, tasks, appts)
      }
      replanWith(appointments)
      // Travel not mentioned: apply now, then again once the real route is
      // known (routing.js) — a second, silent replan of the same day.
      if (hasOrsKey() && appointments.some((a) => a.location?.trim())) {
        fillRouteTravel(appointments, {
          home: data.settings.homeLocation || '',
          places: data.places || [],
          mode: data.settings.travelMode || DEFAULT_TRAVEL_MODE,
        }).then((r) => { if (r.changed) replanWith(r.appointments) })
      }
      break
    }
    case 'place': {
      const name = fv(f, 'name')
      const address = fv(f, 'address')
      if (!name || !address) break
      actions.savePlace({ name, address })
      if (/^(home|thuis|maison|zuhause|casa)$/i.test(name.trim())) actions.setHomeLocation(address)
      break
    }
    case 'task_done': {
      const id = fv(f, 'taskId')
      if (id && !actions.data.taskCompletions[dateKey]?.[id]) actions.toggleTask(dateKey, id)
      break
    }
    case 'note': {
      const text = fv(f, 'text')
      if (text) actions.addNote(text, dateKey)
      break
    }
    default:
      break
  }
}
