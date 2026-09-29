// "Cook with what you have" — rule-based, no AI. The meal rotation's meals
// are free-text Dutch strings ("Kipfilet grill + zoete aardappel +
// broccoli"), so this splits them into ingredient phrases and checks each
// against the pantry by a normalized keyword match. Swapping in another
// meal from the *same slot* of the rotation keeps the day roughly on its
// calorie/protein target, since the whole rotation was written against
// the same targets — that's what makes this safe without macro math.

import { addDaysToKey } from './dates'
import { getMealsForDate } from './taskSchedule'

export const MEAL_SLOTS = ['ontbijt', 'lunch', 'diner', 'snack']
export const MEAL_SLOT_LABELS = { ontbijt: 'Ontbijt', lunch: 'Lunch', diner: 'Diner', snack: 'Snack' }
export const PANTRY_LOCATIONS = [
  { value: 'koelkast', label: 'Koelkast' },
  { value: 'vriezer', label: 'Vriezer' },
  { value: 'kast', label: 'Kast' },
]

// Descriptive words that say nothing about *which* ingredient it is.
const FILLER_WORDS = new Set([
  'volkoren', 'light', 'lichte', 'licht', 'mager', 'magere', 'grote', 'groot', 'gegrilde', 'grill',
  'gegrild', 'verse', 'vers', 'halve', 'half', 'in', 'met', 'en', 'of', 'de', 'het', 'een', 'op', 'van', '0%', 'bruine',
  'achtige', 'caesar-achtige', 'kleine', 'wat', 'beetje',
])

// Seasoning/condiment-level items nobody should be told they "miss".
const ALWAYS_AVAILABLE = ['kaneel', 'zout', 'peper', 'kruiden', 'sojasaus', 'olie', 'olijfolie', 'dressing', 'honing', 'water']

// Different words for the same shopping item. Each group maps to its first
// entry; matching compares canonical forms.
const SYNONYMS = [
  ['ei', 'eieren', 'eiwit-ei', 'omelet'],
  ['kip', 'kipfilet', 'kipreepjes', 'kipsalade', 'kipwrap', 'kipcurry', 'kipsoep'],
  ['kalkoen', 'kalkoenfilet', 'kalkoengehakt', 'kalkoengehaktballetjes'],
  ['rundergehakt', 'gehakt', 'mager rundergehakt'],
  ['kwark', 'magere kwark'],
  ['cottage cheese', 'hüttenkäse', 'huttenkase', 'huttenkäse'],
  ['yoghurt', 'griekse yoghurt'],
  ['havermout', 'oats', 'overnight oats'],
  ['eiwitpoeder', 'eiwitshake', 'proteine', 'proteïne', 'whey'],
  ['wrap', 'wraps', 'volkorenwrap', 'tortilla'],
  ['brood', 'boterham', 'toast', 'volkorenboterham', 'volkorenbrood'],
  ['rijst', 'bruine rijst', 'bloemkoolrijst'],
  ['aardappel', 'aardappelen', 'zoete aardappel', 'zoete aardappelpuree'],
  ['courgette', 'courgette-noedels'],
  ['noedels', 'volkoren noedels'],
  ['pasta', 'volkoren pasta'],
  ['bessen', 'blauwe bessen', 'frambozen'],
  ['noten', 'walnoot', 'walnoten', 'amandelen'],
  ['tomaat', 'tomaten', 'tomatensaus'],
  ['mozzarella', 'mozzarella light'],
]

const canonicalMap = new Map()
for (const group of SYNONYMS) for (const word of group) canonicalMap.set(word, group[0])

export function normalizeName(text) {
  const cleaned = text
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/^\s*\d+\s*(x|st|stuks|gram|g)?\s+/, '')
    .split(/\s+/)
    .filter((w) => w && !FILLER_WORDS.has(w))
    .join(' ')
    .trim()
  return canonicalMap.get(cleaned) || cleaned
}

// "Kipsalade (kip, sla, tomaat, mais, lichte dressing)" — a parenthetical
// *list* is the real ingredient list and replaces the dish name before it;
// a single parenthetical item ("curry (kokosmelk light)") is just one more
// ingredient. Then split on "+" and ",".
export function mealIngredients(mealText) {
  const source = mealText.replace(/([^+,()]*?)\s*\(([^)]*)\)/g, (_, head, inner) =>
    /[,+]/.test(inner) ? inner.replace(/,/g, '+') : `${head} + ${inner}`)
  const parts = source
    .split(/\s*[+,]\s*|\s+met\s+|\s+en\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !ALWAYS_AVAILABLE.some((a) => part.toLowerCase().includes(a)))
  // A dish name like "kipwrap" or "kipsalade" also needs its base — wraps,
  // lettuce — which would otherwise hide behind the "kip" match.
  const out = []
  for (const part of parts) {
    const recipe = DISH_RECIPES[normalizeName(part)]
    if (recipe) { for (const r of recipe) if (!out.includes(r)) out.push(r); continue }
    out.push(part)
    const lower = part.toLowerCase()
    for (const [marker, need] of DISH_BASES) {
      if (lower.includes(marker) && normalizeName(part) !== normalizeName(need) && !wordsOf(part).includes(need) && !out.includes(need)) out.push(need)
    }
  }
  return out
}

// Dishes that are really a short recipe of pantry items.
const DISH_RECIPES = { eiwitpannenkoek: ['ei', 'kwark', 'havermout'] }

const DISH_BASES = [['wrap', 'wrap'], ['salade', 'sla'], ['pasta', 'pasta'], ['noedels', 'noedels'], ['toast', 'brood'], ['boterham', 'brood']]

// "Cottage cheese + komkommer / eiwitshake" — a slash means "or", so each
// side is its own option.
export function mealAlternatives(mealText) {
  return mealText.split(/\s+\/\s+/).map((s) => s.trim()).filter(Boolean)
}

function wordsOf(text) {
  return normalizeName(text).split(/[^\p{L}%]+/u).filter((w) => w.length > 1 && !FILLER_WORDS.has(w))
}

// Generic words in the meal plan that any item of that kind satisfies.
const GENERIC = {
  groenten: ['broccoli', 'spinazie', 'courgette', 'paprika', 'komkommer', 'tomaat', 'sla', 'champignons', 'sperziebonen', 'wortel', 'bloemkool', 'ui', 'prei', 'andijvie', 'boerenkool', 'rucola', 'spitskool', 'aubergine', 'bonen', 'mais', 'erwten'],
  roerbakgroenten: ['broccoli', 'paprika', 'courgette', 'champignons', 'wortel', 'bloemkool', 'spitskool', 'prei', 'ui'],
  sla: ['sla', 'rucola', 'spinazie', 'andijvie', 'veldsla', 'ijsbergsla', 'romaine'],
  fruit: ['appel', 'banaan', 'peer', 'bessen', 'mango', 'kiwi', 'druiven', 'sinaasappel', 'mandarijn', 'aardbeien', 'ananas', 'perzik'],
}

// Word-level matching, not raw substrings — "appel" must not match inside
// "aardappel". A pantry word matches an ingredient word when equal, when
// the ingredient word is a compound starting with it ("kip" → "kipfilet",
// "aardappel" → "aardappelpuree"), or for plurals ("rijstwafel(s)").
function wordMatches(ingWord, pantryWord) {
  if (ingWord === pantryWord) return true
  if (pantryWord.length >= 3 && ingWord.startsWith(pantryWord)) return true
  return ingWord.length >= 4 && pantryWord.startsWith(ingWord) && pantryWord.length - ingWord.length <= 2
}

// Words that name a dish or style rather than something you buy — "Kip-quinoa
// bowl" needs kip and quinoa, not a "bowl".
const DISH_WORDS = new Set([
  'bowl', 'salade', 'maaltijdsalade', 'grill', 'roerbak', 'ovenschotel', 'schotel', 'stoofpotje', 'curry', 'soep',
  'caesar', 'caprese', 'chili', 'con', 'carne', 'mexicaanse', 'griekse', 'restjes',
  'teriyaki', 'bord', 'overnight', 'puree',
])

function wordCovered(pantryNames, word) {
  return pantryNames.some((p) => {
    if (wordMatches(word, p)) return true
    return GENERIC[word]?.some((g) => wordMatches(p, g))
  })
}

function pantryHas(pantryNames, ingredient) {
  // "Tofu- of kipcurry" — either one will do.
  const alternatives = ingredient.split(/\s+of\s+/i)
  if (alternatives.length > 1) return alternatives.some((alt) => pantryHas(pantryNames, alt))

  const ing = normalizeName(ingredient)
  // Whole phrase first: "Overnight oats" → havermout, "zoete aardappel".
  if (pantryNames.some((p) => p === ing || wordMatches(ing, p))) return true
  const content = wordsOf(ingredient)
    .map((w) => canonicalMap.get(w) || w)
    .filter((w) => !DISH_WORDS.has(w))
  // Every real ingredient word has to be in the house.
  return content.every((w) => wordCovered(pantryNames, w))
}

export function pantryNameSet(pantry) {
  return pantry.map((p) => normalizeName(p.name)).filter(Boolean)
}

// { have: [...], missing: [...], coverage: 0..1 } for one meal option.
export function checkMeal(mealText, pantryNames) {
  const ingredients = mealIngredients(mealText)
  if (!ingredients.length) return { have: [], missing: [], coverage: 1 }
  const have = []
  const missing = []
  for (const ing of ingredients) (pantryHas(pantryNames, ing) ? have : missing).push(ing)
  return { have, missing, coverage: have.length / ingredients.length }
}

// Best option for a whole meal string — picks whichever "/" alternative is
// most covered, since you only need to be able to make one of them.
export function bestOption(mealText, pantryNames) {
  let best = null
  for (const option of mealAlternatives(mealText)) {
    const result = { option, ...checkMeal(option, pantryNames) }
    if (!best || result.coverage > best.coverage) best = result
  }
  return best
}

// Every distinct meal the rotation contains for this slot, as candidates
// to swap in. "Restjes ..." (leftovers of an earlier meal) is excluded —
// it depends on having cooked that other meal, not on the pantry.
export function rotationOptionsForSlot(mealRotation, slot) {
  const seen = new Set()
  const out = []
  for (const week of Object.values(mealRotation?.meals_by_week || {})) {
    for (const day of Object.values(week || {})) {
      const text = day?.[slot]
      if (!text) continue
      for (const option of mealAlternatives(text)) {
        const key = option.toLowerCase()
        if (seen.has(key) || /^restjes/i.test(option)) continue
        seen.add(key)
        out.push(option)
      }
    }
  }
  return out
}

// Ranked swap suggestions for one slot: most-covered first, then fewest
// missing items. Only options that are actually better than the planned
// meal are useful, so the caller passes the planned coverage to beat.
export function suggestSwaps(mealRotation, slot, pantryNames, { limit = 3, minCoverage = 0 } = {}) {
  return rotationOptionsForSlot(mealRotation, slot)
    .map((option) => ({ option, ...checkMeal(option, pantryNames) }))
    .filter((r) => r.coverage > minCoverage)
    .sort((a, b) => b.coverage - a.coverage || a.missing.length - b.missing.length)
    .slice(0, limit)
}

// Shopping list for the next `days` days: every ingredient of the planned
// (or swapped-in) meals that the pantry doesn't cover, with the meals that
// need it — so you can see why something's on the list.
export function shoppingList(mealRotation, dayOverrides, pantryNames, startKey, days = 7) {
  const items = new Map()
  for (let i = 0; i < days; i++) {
    const dateKey = addDaysToKey(startKey, i)
    const info = getMealsForDate(mealRotation, dateKey, dayOverrides)
    if (!info?.meals) continue
    for (const slot of MEAL_SLOTS) {
      const text = info.meals[slot]
      if (!text || /^restjes/i.test(text)) continue
      const best = bestOption(text, pantryNames)
      for (const ing of best?.missing || []) {
        const key = normalizeName(ing)
        if (!items.has(key)) items.set(key, { name: ing, dates: new Set() })
        items.get(key).dates.add(dateKey)
      }
    }
  }
  return [...items.values()]
    .map((it) => ({ name: it.name, dates: [...it.dates].sort() }))
    .sort((a, b) => a.dates[0].localeCompare(b.dates[0]) || a.name.localeCompare(b.name))
}

// "eieren, spinazie en kipfilet" → ['eieren', 'spinazie', 'kipfilet'] — for
// quick-adding several pantry items from one typed or dictated line.
export function parsePantryInput(text) {
  return text
    .split(/\s*[,;\n]\s*|\s+en\s+|\s+\+\s+/i)
    .map((s) => s.trim().replace(/[.!]$/, ''))
    .filter(Boolean)
}
