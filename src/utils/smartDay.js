// The AI layer on top of the rule-based day tools (dayReplan.js, pantry.js).
// Both calls go through sendToClaude with a JSON Schema (structured
// outputs), so the reply is always parseable — but the *content* is still
// validated here against what the app actually has (real task ids, real
// HH:MM times) before anything reaches the UI. Anything invalid falls back
// to the template value rather than failing the whole plan.
//
// Same optional-AI contract as voice logging and meal analysis: callers
// only offer these when hasApiKey(), and the rule-based versions keep
// working with no key at all.
import { sendToClaude, ClaudeApiError } from './claudeApi'
import { toMin } from './dayReplan'

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

// ---------------------------------------------------------------------------
// Replanning

const REPLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['appointments', 'tasks', 'summary'],
  properties: {
    appointments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'start', 'end', 'location', 'travelBefore', 'travelAfter', 'travelEstimated'],
        properties: {
          title: { type: 'string' },
          start: { type: 'string', description: 'HH:MM, 24h' },
          end: { type: 'string', description: 'HH:MM, 24h' },
          location: { type: 'string' },
          travelBefore: { type: 'integer', description: 'minutes of travel to get there' },
          travelAfter: { type: 'integer', description: 'minutes of travel back / to the next place' },
          travelEstimated: { type: 'boolean', description: 'true when you estimated the travel time yourself' },
        },
      },
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'time', 'label', 'dropped', 'note'],
        properties: {
          id: { type: 'string' },
          time: { type: 'string', description: 'HH:MM, 24h' },
          label: { type: 'string' },
          dropped: { type: 'boolean' },
          note: { type: 'string', description: 'short Dutch reason when changed, empty string when unchanged' },
        },
      },
    },
    summary: { type: 'string' },
  },
}

const REPLAN_SYSTEM = `Je bent de dagplanner in een persoonlijke leefstijl-app. De gebruiker volgt een vast dagschema (maaltijden, training, supplementen, herstel) voor een afvaldoel en vertelt je — vaak ingesproken, dus informeel — een afspraak of verandering voor vandaag. Pas het schema van vandaag zo aan dat het doel haalbaar blijft.

Regels:
- Neem alle afspraken op die je krijgt (bestaande + nieuwe uit de tekst). Tijden altijd als HH:MM (24 uur). "om 3 uur" overdag = 15:00. Geen eindtijd genoemd: schat een redelijke duur.
- Reistijd: gebruik wat de gebruiker noemt. Anders schat je zelf een realistische reistijd (enkele reis) vanaf het vertrekpunt of de vorige afspraak, met het genoemde vervoer of anders met de auto, en zet travelEstimated op true. Zonder locatie: 0 minuten.
- Een afspraak blokkeert zijn tijd plus de reistijd ervoor en erna. Geen taak mag in een geblokkeerde periode vallen.
- Taken die al gedaan zijn of al voorbij zijn, laat je ongewijzigd.
- Geef ALLE taken terug met hun originele id — ook ongewijzigde (note dan leeg). Verzin geen nieuwe ids.
- Maaltijden minstens ~1,5 uur uit elkaar en niet verder dan ~2,5 uur van hun oorspronkelijke tijd. Past een maaltijd niet, laat dan de tijd staan en zet "(meenemen)" achter het label, zodat de gebruiker onderweg eet — nooit een maaltijd laten vervallen, het eiwitdoel moet gehaald worden.
- Training eindigt uiterlijk 22:00 en niet binnen ~1 uur na een hoofdmaaltijd. Past de volledige training niet, maak er dan een kortere versie van (pas het label aan, bv. "Korte versie (30 min): ..."). Alleen als ook dat niet kan: dropped = true.
- Supplementen blijven bij de maaltijd waar ze bij horen.
- Verschuif zo weinig mogelijk; laat alles wat niet botst op zijn plek.
- note: één korte Nederlandse zin waarom iets veranderde. summary: 1–2 korte zinnen voor de gebruiker, in het Nederlands, met "je".`

function describeTasks(tasks, completed) {
  return tasks
    .map((t) => `- id=${t.id} | ${t.time} | ${t.category} | ${t.label}${completed[t.id] ? ' | AL GEDAAN' : ''}`)
    .join('\n')
}

function describeAppointments(appointments) {
  if (!appointments.length) return '(nog geen)'
  return appointments
    .map((a) => `- ${a.start}–${a.end} ${a.title}${a.location ? ` @ ${a.location}` : ''} (reistijd heen ${a.travelBefore || 0} min, terug ${a.travelAfter || 0} min)`)
    .join('\n')
}

/**
 * Returns { appointments, tasks, changes, summary } in the same shapes
 * DayReplanSheet already renders for the rule-based planner.
 */
export async function aiReplanDay({ text, templateTasks, appointments, completed = {}, nowHHMM, home, targets, places = [] }) {
  const trainingDay = templateTasks.some((t) => t.category === 'training')
  const kcal = trainingDay ? targets?.training_day_kcal : targets?.rest_day_kcal
  const user = [
    `Nu is het ${nowHHMM}. Vandaag is een ${trainingDay ? 'trainingsdag' : 'rustdag'}${kcal ? ` (doel ${kcal.join('–')} kcal` : ''}${targets?.protein_g ? `, ${targets.protein_g.join('–')} g eiwit)` : kcal ? ')' : ''}.`,
    `Vertrekpunt / thuis: ${home || 'onbekend'}.`,
    places.length ? `Opgeslagen plaatsen: ${places.map((p) => `${p.name} = ${p.address}`).join('; ')}.` : '',
    '',
    'Standaardschema van vandaag:',
    describeTasks(templateTasks, completed),
    '',
    'Afspraken die al bekend zijn:',
    describeAppointments(appointments),
    '',
    text?.trim() ? `Wat de gebruiker zegt: "${text.trim()}"` : 'De gebruiker heeft niets nieuws gezegd — plan alleen rond de bekende afspraken.',
  ].join('\n')

  const raw = await sendToClaude({
    system: REPLAN_SYSTEM,
    messages: [{ role: 'user', content: user }],
    maxTokens: 8000,
    schema: REPLAN_SCHEMA,
    effort: 'medium',
  })

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ClaudeApiError('Kon het antwoord niet lezen — probeer het nog eens.')
  }

  const validAppointments = (parsed.appointments || [])
    .filter((a) => HHMM.test(a.start) && HHMM.test(a.end) && toMin(a.end) > toMin(a.start))
    .map((a, i) => ({
      id: `appt-ai-${Date.now().toString(36)}-${i}`,
      title: a.title || 'Afspraak',
      start: a.start,
      end: a.end,
      location: a.location || '',
      travelBefore: String(Math.max(0, a.travelBefore || 0)),
      travelAfter: String(Math.max(0, a.travelAfter || 0)),
      travelEstimated: !!a.travelEstimated,
    }))

  // Merge the reply onto the template by id: unknown ids are ignored, a
  // task the reply forgot keeps its template time, and completed tasks are
  // never moved regardless of what came back.
  const byId = new Map((parsed.tasks || []).map((t) => [t.id, t]))
  const tasks = []
  const changes = []
  for (const t of templateTasks) {
    const r = byId.get(t.id)
    if (!r || completed[t.id]) { tasks.push({ ...t }); continue }
    if (r.dropped) {
      changes.push({ id: t.id, label: t.label, from: t.time, to: null, kind: 'dropped', note: r.note || '' })
      continue
    }
    const time = HHMM.test(r.time) ? r.time : t.time
    const label = r.label?.trim() || t.label
    tasks.push({ ...t, time, label })
    if (time !== t.time || label !== t.label) {
      const kind = /meenemen/i.test(label) ? 'takeAlong' : /korte versie/i.test(label) ? 'shortened' : 'moved'
      changes.push({ id: t.id, label: t.label, from: t.time, to: time, kind, note: r.note || '' })
    }
  }
  tasks.sort((a, b) => a.time.localeCompare(b.time))

  return { appointments: validAppointments, tasks, changes, summary: parsed.summary || '' }
}

// ---------------------------------------------------------------------------
// Meal ideas from the pantry

const IDEAS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'uses', 'missing', 'kcal', 'proteinG', 'how'],
        properties: {
          name: { type: 'string' },
          uses: { type: 'array', items: { type: 'string' } },
          missing: { type: 'array', items: { type: 'string' } },
          kcal: { type: 'integer' },
          proteinG: { type: 'integer' },
          how: { type: 'string' },
        },
      },
    },
  },
}

const IDEAS_SYSTEM = `Je bedenkt maaltijden voor iemand die een afvalplan volgt en vandaag niet naar de winkel kan. Je krijgt de geplande maaltijd (als richtlijn voor de hoeveelheid calorieën en eiwit) en wat er in huis is.

- Geef 3 ideeën, in het Nederlands, die zo veel mogelijk alleen met de voorraad te maken zijn. Basisdingen (olie, zout, peper, kruiden, sojasaus, water) mag je aannemen.
- Houd calorieën en eiwit ongeveer gelijk aan de geplande maaltijd (schat die eerst in). Eiwit is belangrijk: liever iets meer dan minder.
- uses: welke voorraad-items je gebruikt. missing: wat er toch nog zou ontbreken (liefst leeg).
- how: één korte zin bereiding.
- kcal en proteinG: realistische schatting voor één portie.`

/**
 * Returns [{ name, uses, missing, kcal, proteinG, how }].
 */
export async function aiMealIdeas({ slotLabel, plannedMeal, pantryItems, trainingDay }) {
  const user = [
    `Moment: ${slotLabel} op een ${trainingDay ? 'trainingsdag' : 'rustdag'}.`,
    `Gepland was: ${plannedMeal || '(niets gepland)'}`,
    '',
    'In huis:',
    pantryItems.length ? pantryItems.map((p) => `- ${p.name} (${p.location || 'koelkast'})`).join('\n') : '(voorraad is leeg — geef ideeën met zo min mogelijk ingrediënten)',
  ].join('\n')

  const raw = await sendToClaude({
    system: IDEAS_SYSTEM,
    messages: [{ role: 'user', content: user }],
    maxTokens: 4000,
    schema: IDEAS_SCHEMA,
    effort: 'low',
  })

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ClaudeApiError('Kon het antwoord niet lezen — probeer het nog eens.')
  }
  return (parsed.ideas || [])
    .filter((idea) => idea.name?.trim())
    .map((idea) => ({
      name: idea.name.trim(),
      uses: idea.uses || [],
      missing: idea.missing || [],
      kcal: Math.max(0, idea.kcal || 0),
      proteinG: Math.max(0, idea.proteinG || 0),
      how: idea.how || '',
    }))
}
