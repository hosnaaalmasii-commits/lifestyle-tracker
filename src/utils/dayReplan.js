// Rule-based day replanning — no AI. Given the day's tasks and one or more
// appointments (each blocking its own time plus travel before/after), moves
// every task that collides to the nearest free moment, shortens training
// if no full-length slot is left, and only drops it as a last resort. The
// result is a *proposal*: the caller shows it, lets the user tweak times,
// and only then stores it as that date's dayOverrides[date].tasks.
//
// Moved tasks keep their id, so completions, push dedup and Calendar event
// ids all carry over to the new time.

export function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function toHHMM(min) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)))
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

const DAY_START = toMin('06:30')
const DAY_END = toMin('23:00')
const TRAINING_LATEST_END = toMin('22:00')
const SHORT_TRAINING_MIN = 30
const MIN_MEAL_GAP = 60 // two meals/snacks closer than this isn't a real plan
// A meal moved further than this stops being "lunch" — better to take it
// along and eat it at the appointment than to have lunch at 22:00.
const MAX_MEAL_SHIFT = 150
const SEARCH_STEP = 5

// Rough durations — the schedule only stores start times. Long enough that
// a moved meal doesn't end up squeezed against an appointment.
export function taskDuration(task) {
  const cat = task.category || ''
  if (cat === 'training') return 75
  if (cat.startsWith('eten')) return 30
  if (cat === 'supplement') return 5
  if (cat === 'herstel') {
    const nums = [...(task.label || '').matchAll(/(\d+)\s*min/gi)].map((m) => Number(m[1]))
    return nums.length ? Math.max(...nums) : 15
  }
  if (cat === 'werk') return 60
  return 20
}

const isMeal = (t) => (t.category || '').startsWith('eten')
// Plain supplements happily share a moment with a meal or anything else —
// they only need to avoid the appointment itself.
const isFlexible = (t) => t.category === 'supplement'

function overlaps(a0, a1, b0, b1) {
  return a0 < b1 && b0 < a1
}

export function appointmentBlocks(appointments) {
  return appointments
    .map((a) => ({
      start: toMin(a.start) - (Number(a.travelBefore) || 0),
      end: toMin(a.end) + (Number(a.travelAfter) || 0),
      title: a.title,
    }))
    .sort((a, b) => a.start - b.start)
}

/**
 * @param tasks        the day's current task list
 * @param appointments [{ title, start, end, travelBefore, travelAfter }]
 * @param opts.completed  { [taskId]: true } — done tasks are never moved
 * @param opts.nowMin     minutes since midnight when replanning today —
 *                        nothing gets moved into the past
 * @returns { tasks, changes: [{ id, label, from, to, kind, note }] }
 */
export function replanDay(tasks, appointments, { completed = {}, nowMin = null } = {}) {
  const blocks = appointmentBlocks(appointments)
  const earliest = Math.max(DAY_START, nowMin ?? 0)

  const hitsBlock = (s, e) => blocks.some((b) => overlaps(s, e, b.start, b.end))

  const keep = []
  const move = []
  for (const t of tasks) {
    const s = toMin(t.time)
    const e = s + taskDuration(t)
    const inPast = nowMin != null && s < nowMin
    if (!completed[t.id] && !inPast && hitsBlock(s, e)) move.push(t)
    else keep.push({ ...t })
  }

  // Place training first (biggest, hardest to fit), then meals, then the rest.
  const priority = (t) => (t.category === 'training' ? 0 : isMeal(t) ? 1 : 2)
  move.sort((a, b) => priority(a) - priority(b) || a.time.localeCompare(b.time))

  const placed = [...keep]
  const changes = []

  const fits = (task, s, dur) => {
    const e = s + dur
    if (s < earliest || e > DAY_END) return false
    if (task.category === 'training' && e > TRAINING_LATEST_END) return false
    if (hitsBlock(s, e)) return false
    if (isFlexible(task)) return true
    for (const other of placed) {
      if (isFlexible(other)) continue
      const os = toMin(other.time)
      if (overlaps(s, e, os, os + taskDuration(other))) return false
      if (isMeal(task) && isMeal(other) && Math.abs(os - s) < MIN_MEAL_GAP) return false
    }
    return true
  }

  // Nearest free start time to the original, searching both directions.
  const nearestSlot = (task, dur) => {
    const origin = toMin(task.time)
    const maxShift = isMeal(task) ? MAX_MEAL_SHIFT : 16 * 60
    for (let d = 0; d <= maxShift; d += SEARCH_STEP) {
      for (const s of d === 0 ? [origin] : [origin + d, origin - d]) {
        if (fits(task, s, dur)) return s
      }
    }
    return null
  }

  for (const task of move) {
    const from = task.time
    const fullDur = taskDuration(task)
    let slot = nearestSlot(task, fullDur)
    if (slot != null) {
      placed.push({ ...task, time: toHHMM(slot) })
      changes.push({ id: task.id, label: task.label, from, to: toHHMM(slot), kind: 'moved' })
      continue
    }
    if (task.category === 'training') {
      slot = nearestSlot(task, SHORT_TRAINING_MIN)
      if (slot != null) {
        const label = /^Korte versie/i.test(task.label) ? task.label : `Korte versie (${SHORT_TRAINING_MIN} min): ${task.label}`
        placed.push({ ...task, time: toHHMM(slot), label, shortened: true })
        changes.push({ id: task.id, label: task.label, from, to: toHHMM(slot), kind: 'shortened', note: `Ingekort tot ${SHORT_TRAINING_MIN} min — geen ruimte meer voor de volledige training.` })
        continue
      }
    }
    if (isMeal(task)) {
      // You still need to eat — keep the time, bring it along.
      placed.push({ ...task, label: /meenemen/i.test(task.label) ? task.label : `${task.label} (meenemen)`, takeAlong: true })
      changes.push({ id: task.id, label: task.label, from, to: from, kind: 'takeAlong', note: 'Valt tijdens je afspraak — neem het mee en eet onderweg.' })
      continue
    }
    changes.push({ id: task.id, label: task.label, from, to: null, kind: 'dropped', note: 'Geen vrij moment meer vandaag.' })
  }

  placed.sort((a, b) => a.time.localeCompare(b.time))
  return { tasks: placed, changes }
}

// ---------------------------------------------------------------------------
// "om 14:00 tandarts in Utrecht tot 15:30, 20 minuten fietsen" → structured
// appointment. Plain pattern matching on Dutch phrasing, so it works with
// typed text or the phone keyboard's own dictation — no AI key needed.
// Anything it can't find stays empty for the user to fill in the form.

const NUMBER_WORDS = {
  een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10, elf: 11, twaalf: 12,
  kwartier: 15, halfuur: 30,
}

// Times said without am/pm ("om 3 uur") during a normal day almost always
// mean the afternoon — nobody books a dentist at 03:00.
function dayHour(h) {
  return h >= 1 && h <= 6 ? h + 12 : h
}

function parseTimeToken(token) {
  let m = token.match(/^(\d{1,2})[:.u](\d{2})$/)
  if (m) return toHHMM(dayHour(Number(m[1])) * 60 + Number(m[2]))
  m = token.match(/^(\d{1,2})(?:\s*(?:uur|u))?$/)
  if (m) return toHHMM(dayHour(Number(m[1])) * 60)
  m = token.match(/^half\s+(\d{1,2}|\p{L}+)$/u)
  if (m) {
    const h = Number(m[1]) || NUMBER_WORDS[m[1]]
    if (h) return toHHMM(dayHour(h - 1 === 0 ? 12 : h - 1) * 60 + 30)
  }
  return null
}

const TIME_RE = String.raw`(\d{1,2}[:.u]\d{2}|half\s+(?:\d{1,2}|\p{L}+)|\d{1,2}(?:\s*(?:uur|u)\b)?)`

function parseMinutes(phrase) {
  if (!phrase) return null
  const p = phrase.toLowerCase()
  if (/anderhalf\s*uur/.test(p)) return 90
  if (/half\s*uur|halfuur/.test(p)) return 30
  if (/kwartier/.test(p)) return 15
  let m = p.match(/(\d+|\p{L}+)\s*(?:uur|u)\b/u)
  if (m && (Number(m[1]) || NUMBER_WORDS[m[1]])) return (Number(m[1]) || NUMBER_WORDS[m[1]]) * 60
  m = p.match(/(\d+)\s*(?:min|minuten|minuut)/)
  if (m) return Number(m[1])
  return null
}

export function parseAppointmentText(input) {
  let text = ` ${input.trim()} `
  const result = { title: '', start: '', end: '', location: '', travelBefore: '', travelAfter: '' }

  // Travel: "20 minuten fietsen/rijden/reizen/lopen", "half uur reistijd"
  const travel = text.match(/(\d+\s*(?:min|minuten)|half\s*uur|kwartier|anderhalf\s*uur|\d+\s*uur)\s*(?:reizen|reistijd|rijden|fietsen|lopen|met de auto|met de fiets|met het ov|ov|onderweg)/iu)
  if (travel) {
    const mins = parseMinutes(travel[1])
    if (mins) { result.travelBefore = String(mins); result.travelAfter = String(mins) }
    text = text.replace(travel[0], ' ')
  }

  // "van 14:00 tot 15:30" / "tussen 2 en 3"
  let range = text.match(new RegExp(String.raw`\b(?:van|tussen)\s+${TIME_RE}\s+(?:tot|en|-)\s+${TIME_RE}`, 'iu'))
  if (range) {
    result.start = parseTimeToken(range[1].trim()) || ''
    result.end = parseTimeToken(range[2].trim()) || ''
    text = text.replace(range[0], ' ')
  } else {
    const at = text.match(new RegExp(String.raw`\b(?:om|vanaf)\s+${TIME_RE}`, 'iu'))
    if (at) { result.start = parseTimeToken(at[1].trim()) || ''; text = text.replace(at[0], ' ') }
    const until = text.match(new RegExp(String.raw`\btot\s+${TIME_RE}`, 'iu'))
    if (until) { result.end = parseTimeToken(until[1].trim()) || ''; text = text.replace(until[0], ' ') }
  }

  // "duurt een uur" / "voor anderhalf uur" / "2 uur lang"
  if (result.start && !result.end) {
    const dur = text.match(/(?:duurt|voor|ongeveer)\s+([^,.]*?(?:uur|min(?:uten)?|kwartier))|([^,.\s]+\s+(?:uur|minuten))\s+lang/iu)
    const mins = parseMinutes(dur?.[1] || dur?.[2])
    result.end = toHHMM(toMin(result.start) + (mins || 60))
    if (dur) text = text.replace(dur[0], ' ')
  }

  // Location: "in Utrecht", "bij de tandarts", "op kantoor", "naar Amsterdam"
  const loc = text.match(/\b(?:in|bij|op|naar)\s+([^,.]+?)(?=\s*(?:,|\.|$|\s+(?:om|van|tot|en dan|daarna)\b))/iu)
  if (loc) {
    result.location = loc[1].trim()
    text = text.replace(loc[0], ' ')
  }

  const title = text
    .replace(/\b(?:ik heb|heb ik|er is|vandaag|morgen|nog|een|last[- ]?min(?:ute)?|onverwacht|afspraak)\b/giu, ' ')
    .replace(/[,.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  result.title = title ? title.charAt(0).toUpperCase() + title.slice(1) : 'Afspraak'
  if (!title && result.location) result.title = `Afspraak ${loc[0].trim()}`
  return result
}
