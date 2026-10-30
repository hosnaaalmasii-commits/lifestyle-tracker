// One-off reminders the user asks for in their own words — "herinner me om
// 15:00 om water te drinken", "remind me in 20 minutes to stretch" — stored
// in data.reminders ({ id, date: 'YYYY-MM-DD', time: 'HH:MM', text }) and
// sent as a push notification by the send-due-notifications Edge Function,
// like plan tasks. Added 2026-10-30 ("i want the app to send me
// notification, if i ask so").
//
// parseReminder is rule-based (no API key, no cost) and deliberately
// strict: it only fires on an explicit "herinner me / remind me / zet een
// herinnering", so an ordinary sentence with a time in it is never turned
// into a reminder by accident.

const pad = (n) => String(n).padStart(2, '0')
export const dateKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const TRIGGER = /\b(herinner(?:\s+me|\s+mij)?|remind\s+me|zet\s+(?:een\s+)?herinnering|reminder|stuur\s+me\s+(?:een\s+)?melding|geef\s+me\s+(?:een\s+)?seintje)\b/i

const WORD_NUMBERS = {
  een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10,
  elf: 11, twaalf: 12, kwartier: 15, half: 30, halfuur: 30, one: 1, two: 2, three: 3, five: 5, ten: 10,
  fifteen: 15, twenty: 20, thirty: 30, a: 1, an: 1,
}
const num = (s) => (/^\d+$/.test(s) ? Number(s) : WORD_NUMBERS[s?.toLowerCase()] ?? null)

// What's left after removing the trigger and the time: "om water te
// drinken" → "Water drinken".
function cleanText(rest) {
  // Word edges that also respect letters like é/è (\b doesn't: "crème").
  const W = (words) => new RegExp(`(^|[^\\p{L}])(${words})(?![\\p{L}])`, 'giu')
  let t = rest
    .replace(TRIGGER, ' ')
    .replace(W('eraan|er\\s+aan|me|mij|dat\\s+ik|moet|to|that\\s+i|please|alsjeblieft|aub|svp'), '$1 ')
    .replace(/^[\s,:;-]*(om|aan|dat|te|voor|van|about|of|for)(?![\p{L}])/iu, ' ')
    .replace(/^[\s,:;-]+/, '')
    .replace(/\s+(te|moet|moeten|need\s+to)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  // "water te drinken" → "water drinken"
  t = t.replace(/\bte\s+(\w+en)\b/gi, '$1').replace(/^(om|aan|dat|to)\s+/i, '')
  t = t.replace(/[.!?,;:]+$/, '').replace(/^(de|het|een|the|a|an)\s+/i, '').trim()
  return t ? t[0].toUpperCase() + t.slice(1) : ''
}

/**
 * → { date, time, text } or null. `now` is injectable for tests.
 */
export function parseReminder(input, now = new Date()) {
  const text = (input || '').trim()
  if (!text || !TRIGGER.test(text)) return null
  let rest = text
  let when = null

  // Relative: "over 20 minuten", "over een uur", "in 2 hours", "over een half uur"
  const rel = rest.match(/\b(?:over|in)\s+(?:een\s+)?(\d+|[a-zé]+)?\s*(halfuur|half\s+uur|kwartier|minuten|minuut|min|uur|uren|minutes?|mins?|hours?)\b/i)
  if (rel) {
    const unit = rel[2].toLowerCase()
    let minutes
    if (/half/.test(unit) || /^half$/i.test(rel[1] || '')) minutes = 30
    else if (unit === 'kwartier') minutes = 15 * (num(rel[1]) || 1)
    else {
      const n = num(rel[1]) ?? 1
      minutes = /^(uur|uren|hours?)$/.test(unit) ? n * 60 : n
    }
    if (minutes > 0) {
      when = new Date(now.getTime() + minutes * 60000)
      rest = rest.replace(rel[0], ' ')
    }
  }

  // Absolute: "om 15:00", "om 3 uur", "om half 4", "at 3pm", "at 15.30"
  if (!when) {
    let hour = null
    let minute = 0
    let pm = false
    let explicit24 = false
    const halfM = rest.match(/\bom\s+half\s+(\d{1,2})\b/i)
    const clockM = rest.match(/\b(?:om|at|@|tegen)?\s*(\d{1,2})[:.h](\d{2})\s*(am|pm)?\b/i)
    const hourM = rest.match(/\b(?:om|at|tegen)\s+(\d{1,2})\s*(uur|u|am|pm|o'?clock)?\b/i)
    if (halfM) {
      hour = Number(halfM[1]) - 1; minute = 30
      rest = rest.replace(halfM[0], ' ')
    } else if (clockM) {
      hour = Number(clockM[1]); minute = Number(clockM[2]); pm = /pm/i.test(clockM[3] || '')
      explicit24 = hour >= 13 || hour === 0 || /^0\d/.test(clockM[1])
      rest = rest.replace(clockM[0], ' ')
    } else if (hourM) {
      hour = Number(hourM[1]); pm = /pm/i.test(hourM[2] || '')
      rest = rest.replace(hourM[0], ' ')
    }
    if (hour !== null && hour <= 23 && minute <= 59) {
      if (pm && hour < 12) hour += 12
      if (/\b('s\s*avonds|vanavond|avond|evening|tonight|'s\s*middags|namiddag|afternoon)\b/i.test(text) && hour < 12) hour += 12
      const day = new Date(now)
      if (/\bovermorgen\b/i.test(text)) day.setDate(day.getDate() + 2)
      else if (/\b(morgen|tomorrow)\b/i.test(text)) day.setDate(day.getDate() + 1)
      day.setHours(hour, minute, 0, 0)
      // "om 3 uur" in the afternoon: 03:00 is past, 15:00 isn't → 15:00.
      const sameDay = !/\b(morgen|overmorgen|tomorrow)\b/i.test(text)
      if (sameDay && day <= now && !explicit24 && !pm && hour < 12) {
        const later = new Date(day); later.setHours(hour + 12)
        if (later > now) day.setHours(hour + 12)
      }
      if (sameDay && day <= now) day.setDate(day.getDate() + 1) // already past → tomorrow
      when = day
    }
  }
  if (!when) return null

  rest = rest.replace(/\b(vandaag|vanavond|morgen|overmorgen|tomorrow|today|tonight|'s\s*avonds|'s\s*ochtends|'s\s*middags|uur)\b/gi, ' ')
  const label = cleanText(rest) || 'Herinnering'
  return { date: dateKeyOf(when), time: `${pad(when.getHours())}:${pad(when.getMinutes())}`, text: label }
}

// "vandaag om 15:00" / "morgen om 08:00" / "di 4 nov om 09:00"
export function describeReminder(r, now = new Date()) {
  const today = dateKeyOf(now)
  const tomorrow = dateKeyOf(new Date(now.getTime() + 86400000))
  const day = r.date === today ? 'vandaag' : r.date === tomorrow ? 'morgen'
    : new Date(`${r.date}T12:00:00`).toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${day} om ${r.time}`
}

export function isUpcoming(r, now = new Date()) {
  return `${r.date}T${r.time}` >= `${dateKeyOf(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`
}
