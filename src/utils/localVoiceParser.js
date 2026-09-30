// Rule-based fallback for the voice/text-logging pipeline: turns everyday
// Dutch (and some English) sentences into the same intent shape the
// Claude parser returns, so "ik heb vandaag een banaan gegeten" lands in
// Voeding with calories even without an API key. Deliberately heuristic —
// the Claude parser is the upgrade path; this covers the common cases and
// saves anything it can't place as a note, so nothing said is ever lost.

// Per typical portion. g = portion weight, so "200 gram kip" can scale.
// veg: also ticks the vegetables item of the daily nutrition checklist.
const FOODS = [
  { name: 'Banaan', keys: ['banaan', 'bananen', 'banaantje', 'banaantjes', 'banana', 'bananas'], kcal: 105, p: 1.3, c: 27, f: 0.4 },
  { name: 'Appel', keys: ['appel', 'appels', 'appeltje', 'appeltjes', 'apple', 'apples'], kcal: 80, p: 0.4, c: 21, f: 0.3 },
  { name: 'Peer', keys: ['peer', 'peren', 'peertje', 'pear'], kcal: 100, p: 0.6, c: 27, f: 0.2 },
  { name: 'Sinaasappel', keys: ['sinaasappel', 'sinaasappels', 'orange'], kcal: 60, p: 1.2, c: 15, f: 0.2 },
  { name: 'Mandarijn', keys: ['mandarijn', 'mandarijnen', 'mandarijntje', 'mandarijntjes'], kcal: 40, p: 0.6, c: 10, f: 0.2 },
  { name: 'Kiwi', keys: ['kiwi', "kiwi's", 'kiwis'], kcal: 45, p: 0.8, c: 10, f: 0.4 },
  { name: 'Aardbeien', keys: ['aardbeien', 'aardbei', 'strawberries'], g: 150, kcal: 50, p: 1, c: 11, f: 0.5 },
  { name: 'Blauwe bessen', keys: ['blauwe bessen', 'blauwbessen', 'bessen', 'blueberries'], g: 100, kcal: 57, p: 0.7, c: 14, f: 0.3 },
  { name: 'Druiven', keys: ['druiven', 'druif', 'grapes'], g: 100, kcal: 70, p: 0.7, c: 18, f: 0.2 },
  { name: 'Fruit', keys: ['fruit', 'stuk fruit'], kcal: 70, p: 0.7, c: 17, f: 0.2 },
  { name: 'Avocado (half)', keys: ['avocado', 'avocados', "avocado's"], kcal: 120, p: 1.5, c: 6, f: 11 },

  { name: 'Ei', keys: ['gekookt ei', 'gekookte eieren', 'eitje', 'eitjes', 'eieren', 'ei', 'eggs', 'egg'], kcal: 75, p: 6.5, c: 0.5, f: 5 },
  { name: 'Omelet', keys: ['omelet', 'omelette', 'roerei', 'scrambled eggs'], kcal: 220, p: 14, c: 1, f: 17 },
  { name: 'Boterham', keys: ['sneetjes brood', 'sneetje brood', 'boterhammen', 'boterham', 'sneetjes', 'sneetje', 'volkorenbrood', 'bruin brood', 'brood', 'toast', 'bread'], kcal: 90, p: 3.5, c: 15, f: 1.2 },
  { name: 'Kaas', keys: ['plakjes kaas', 'plakje kaas', 'plak kaas', 'kaas', 'cheese'], kcal: 70, p: 5, c: 0, f: 5.5 },
  { name: 'Pindakaas', keys: ['pindakaas', 'peanut butter'], kcal: 95, p: 3.5, c: 2, f: 8 },
  { name: 'Havermout', keys: ['overnight oats', 'havermout', 'havervlokken', 'oatmeal', 'oats', 'pap'], g: 50, kcal: 190, p: 6.5, c: 30, f: 3.5 },
  { name: 'Muesli', keys: ['muesli', 'granola', 'cruesli'], g: 50, kcal: 220, p: 5, c: 32, f: 8 },
  { name: 'Croissant', keys: ['croissant', 'croissants', 'croissantje'], kcal: 230, p: 5, c: 26, f: 12 },
  { name: 'Rijstwafel', keys: ['rijstwafel', 'rijstwafels', 'rijstwafeltje', 'rice cake', 'rice cakes'], kcal: 30, p: 0.7, c: 6.5, f: 0.2 },
  { name: 'Cracker', keys: ['crackers', 'cracker', 'knäckebröd', 'knackebrod'], kcal: 40, p: 1, c: 7, f: 1 },

  { name: 'Griekse yoghurt', keys: ['griekse yoghurt', 'greek yogurt', 'greek yoghurt'], g: 150, kcal: 145, p: 15, c: 6, f: 7 },
  { name: 'Skyr', keys: ['skyr'], g: 150, kcal: 95, p: 16, c: 6, f: 0.3 },
  { name: 'Kwark', keys: ['magere kwark', 'kwark', 'quark'], g: 150, kcal: 90, p: 16, c: 6, f: 0.3 },
  { name: 'Yoghurt', keys: ['yoghurt', 'yogurt'], g: 150, kcal: 90, p: 6, c: 7, f: 4.5 },
  { name: 'Melk', keys: ['glas melk', 'melk', 'milk'], kcal: 115, p: 8.5, c: 12, f: 4 },
  { name: 'Eiwitshake', keys: ['proteïneshake', 'proteineshake', 'protein shake', 'eiwitshake', 'eiwit shake', 'shake'], kcal: 120, p: 24, c: 3, f: 1.5 },
  { name: 'Eiwitreep', keys: ['proteïnereep', 'proteinereep', 'protein bar', 'eiwitreep', 'eiwit reep'], kcal: 200, p: 20, c: 20, f: 7 },
  { name: 'Smoothie', keys: ['smoothie', 'smoothies'], kcal: 150, p: 3, c: 32, f: 1 },
  { name: 'Jus d\'orange', keys: ["jus d'orange", 'jus', 'sinaasappelsap', 'sap', 'juice'], kcal: 90, p: 1, c: 20, f: 0 },
  { name: 'Cola', keys: ['cola', 'coca cola', 'frisdrank', 'fanta', 'sprite', 'soda'], kcal: 140, p: 0, c: 35, f: 0 },

  { name: 'Noten', keys: ['handje noten', 'amandelen', 'walnoten', 'cashewnoten', 'cashews', 'pinda\'s', 'pindas', 'noten', 'nuts', 'almonds'], g: 25, kcal: 150, p: 5, c: 4, f: 13 },
  { name: 'Kipfilet', keys: ['kipfilet', 'kippenborst', 'kip', 'chicken'], g: 150, kcal: 165, p: 34, c: 0, f: 2.5 },
  { name: 'Zalm', keys: ['zalm', 'salmon'], g: 125, kcal: 250, p: 25, c: 0, f: 16 },
  { name: 'Tonijn', keys: ['tonijn', 'tuna'], g: 120, kcal: 130, p: 29, c: 0, f: 1 },
  { name: 'Vis', keys: ['vis', 'kabeljauw', 'fish'], g: 150, kcal: 140, p: 28, c: 0, f: 2 },
  { name: 'Gehakt', keys: ['gehaktbal', 'gehaktballen', 'gehakt', 'mince'], g: 100, kcal: 250, p: 20, c: 0, f: 18 },
  { name: 'Biefstuk', keys: ['biefstuk', 'steak', 'rundvlees', 'beef'], g: 150, kcal: 200, p: 32, c: 0, f: 8 },
  { name: 'Tofu', keys: ['tofu'], g: 150, kcal: 180, p: 18, c: 3, f: 11 },
  { name: 'Rijst', keys: ['rijst', 'rice'], g: 200, kcal: 260, p: 5, c: 57, f: 0.6 },
  { name: 'Pasta', keys: ['spaghetti', 'macaroni', 'penne', 'pasta', 'noodles', 'noedels'], g: 200, kcal: 300, p: 11, c: 60, f: 1.8 },
  { name: 'Aardappelen', keys: ['aardappelen', 'aardappels', 'aardappel', 'potatoes', 'potato'], g: 200, kcal: 150, p: 4, c: 33, f: 0.2 },
  { name: 'Zoete aardappel', keys: ['zoete aardappel', 'zoete aardappelen', 'sweet potato'], g: 200, kcal: 170, p: 3, c: 40, f: 0.2 },
  { name: 'Kipwrap', keys: ['kipwrap', 'kip wrap', 'chicken wrap'], kcal: 400, p: 30, c: 40, f: 12 },
  { name: 'Wrap', keys: ['wraps', 'wrap', 'tortilla'], kcal: 180, p: 5, c: 30, f: 4.5 },
  { name: 'Salade', keys: ['salade', 'salad'], kcal: 150, p: 5, c: 10, f: 10, veg: true },
  { name: 'Soep', keys: ['soep', 'soup'], kcal: 150, p: 6, c: 18, f: 5, veg: true },
  { name: 'Groenten', keys: ['groenten', 'groente', 'broccoli', 'spinazie', 'sperziebonen', 'bloemkool', 'paprika', 'wortels', 'wortelen', 'wortel', 'komkommer', 'tomaten', 'tomaat', 'sla', 'vegetables', 'veggies'], g: 150, kcal: 40, p: 2.5, c: 6, f: 0.5, veg: true },
  { name: 'Pizza', keys: ['stuk pizza', 'punt pizza', 'slice of pizza'], kcal: 270, p: 12, c: 32, f: 10 },
  { name: 'Pizza', keys: ['pizza'], kcal: 800, p: 35, c: 95, f: 30 },
  { name: 'Hamburger', keys: ['hamburger', 'burger'], kcal: 500, p: 25, c: 40, f: 25 },
  { name: 'Friet', keys: ['patatje', 'frietjes', 'friet', 'patat', 'fries'], kcal: 400, p: 5, c: 50, f: 20 },
  { name: 'Chips', keys: ['zakje chips', 'chips', 'crisps'], g: 40, kcal: 210, p: 2.5, c: 21, f: 13 },
  { name: 'Chocolade', keys: ['stukje chocola', 'reep chocola', 'chocolade', 'chocola', 'chocolate'], g: 25, kcal: 135, p: 2, c: 14, f: 8 },
  { name: 'Koekje', keys: ['koekjes', 'koekje', 'koek', 'cookie', 'cookies', 'biscuit'], kcal: 60, p: 1, c: 8, f: 3 },
  { name: 'Taart', keys: ['stuk taart', 'taart', 'cake', 'gebak'], kcal: 350, p: 4, c: 45, f: 17 },
  { name: 'IJs', keys: ['bolletje ijs', 'ijsje', 'ijs', 'ice cream'], kcal: 140, p: 2.5, c: 17, f: 7 },
]

const NUMBER_WORDS = {
  een: 1, één: 1, a: 1, an: 1, one: 1, twee: 2, two: 2, drie: 3, three: 3, vier: 4, four: 4,
  vijf: 5, five: 5, zes: 6, six: 6, zeven: 7, acht: 8, negen: 9, tien: 10, halve: 0.5, half: 0.5,
  paar: 2, couple: 2, anderhalve: 1.5, anderhalf: 1.5,
}
const NUM = String.raw`\d+(?:[.,]\d+)?`

function toNumber(word) {
  if (word == null) return null
  const w = word.toLowerCase()
  if (w in NUMBER_WORDS) return NUMBER_WORDS[w]
  const n = Number(w.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Word-boundary match that also works for accented letters.
function wordRe(key) {
  return new RegExp(`(^|[^\\p{L}])(${escapeRe(key)})(?=$|[^\\p{L}])`, 'iu')
}

const exact = (value) => ({ value, confidence: 'exact' })
const est = (value) => ({ value, confidence: 'estimated' })
const round = (n) => Math.round(n * 10) / 10

function slotFor(clause, fullText) {
  const s = `${clause} ${fullText}`.toLowerCase()
  if (/ontbijt|breakfast|ochtend/.test(s)) return 'breakfast'
  if (/lunch|middag/.test(s)) return 'lunch'
  if (/avondeten|diner|dinner|avondmaal|avond/.test(s)) return 'dinner'
  if (/snack|tussendoor/.test(s)) return 'snacks'
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 14) return 'lunch'
  if (h >= 17 && h < 21) return 'dinner'
  return 'snacks'
}

function parseFoods(clause, fullText) {
  let rest = ` ${clause} `
  const found = []
  const keys = FOODS.flatMap((food) => food.keys.map((key) => ({ key, food }))).sort((a, b) => b.key.length - a.key.length)
  for (const { key, food } of keys) {
    const m = rest.match(wordRe(key))
    if (!m) continue
    const start = m.index + m[1].length
    const before = rest.slice(0, start)
    let factor = 1
    let exactAmount = false
    const grams = before.match(new RegExp(`(${NUM})\\s*(?:g|gr|gram)\\s+(?:\\p{L}+\\s+)?$`, 'iu'))
    const qty = before.match(new RegExp(`(?:^|[^\\p{L}\\d])(${NUM}|${Object.keys(NUMBER_WORDS).join('|')})\\s+(?:\\p{L}+\\s+)?$`, 'iu'))
    if (grams) { if (food.g) { factor = toNumber(grams[1]) / food.g; exactAmount = true } }
    else if (qty) { factor = toNumber(qty[1]) || 1; exactAmount = true }
    // Blank out the match so "sneetjes brood" doesn't also count as "brood".
    rest = rest.slice(0, start) + ' '.repeat(m[2].length) + rest.slice(start + m[2].length)
    const count = grams && food.g ? `${grams[1]} g ` : factor !== 1 ? `${factor}× ` : ''
    found.push({
      category: 'food',
      summary: `${count}${food.name} — ${Math.round(food.kcal * factor)} kcal`,
      fields: {
        name: exact(`${count}${food.name}`.trim()),
        slot: est(slotFor(clause, fullText)),
        calories: est(Math.round(food.kcal * factor)),
        proteinG: est(round(food.p * factor)),
        carbsG: est(round(food.c * factor)),
        fatG: est(round(food.f * factor)),
      },
      veg: !!food.veg,
      exactAmount,
    })
  }
  return found
}

function parseDrink(clause) {
  const s = clause.toLowerCase()
  const alcohol = s.match(new RegExp(`(?:(${NUM}|${Object.keys(NUMBER_WORDS).join('|')})\\s+)?(?:\\p{L}+\\s+)?(biertjes|biertje|bier|pils|wijntjes|wijntje|wijn|cocktails|cocktail|glazen wijn|beers?|wine|drankjes|drankje)`, 'iu'))
  if (alcohol) {
    const count = toNumber(alcohol[1]) || 1
    return { category: 'alcohol', summary: `Alcohol — ${count} ${count === 1 ? 'drankje' : 'drankjes'}`, fields: { count: alcohol[1] ? exact(count) : est(count) } }
  }
  if (!/water|thee|koffie|tea|coffee|cappuccino|latte|espresso|drinken|gedronken|drank|drunk|drink/.test(s)) return null
  let ml = null
  let confident = true
  const mlMatch = s.match(new RegExp(`(${NUM})\\s*(ml|milliliter|cl|l|liter|liters|litre)\\b`, 'i'))
  if (mlMatch) {
    const n = toNumber(mlMatch[1])
    ml = /^cl/i.test(mlMatch[2]) ? n * 10 : /^l/i.test(mlMatch[2]) ? n * 1000 : n
  } else {
    const unit = s.match(new RegExp(`(?:(${NUM}|${Object.keys(NUMBER_WORDS).join('|')})\\s+)?(glazen|glaasjes|glaasje|glas|flessen|flesjes|flesje|fles|bekers|beker|mokken|mok|kopjes|kopje|kop|kopjes|cups?|glasses|glass|bottles?)`, 'i'))
    const n = unit ? toNumber(unit[1]) || 1 : 1
    const u = unit ? unit[2].toLowerCase() : ''
    const size = /fles|bottle/.test(u) ? (/flesje/.test(u) ? 330 : 500) : /kop|cup|mok|beker/.test(u) ? 200 : /glaas/.test(u) ? 150 : !unit && /koffie|thee|coffee|tea|cappuccino|latte|espresso/.test(s) ? 200 : 250
    ml = n * size
    confident = !!unit
  }
  if (!(ml > 0)) return null
  const what = /koffie|coffee|cappuccino|latte|espresso/.test(s) ? 'Koffie' : /thee|tea/.test(s) ? 'Thee' : 'Water'
  return { category: 'drink', summary: `${what} — ${Math.round(ml)} ml`, fields: { volumeMl: confident ? exact(Math.round(ml)) : est(Math.round(ml)) } }
}

function parseSleep(clause) {
  const s = clause.toLowerCase()
  if (!/slaap|sliep|geslapen|slept|sleep/.test(s)) return null
  const m = s.match(new RegExp(`(${NUM}|${Object.keys(NUMBER_WORDS).join('|')})\\s*(?:en een half\\s*)?(?:uur|uren|u\\b|hours?|hrs?)`, 'i'))
  if (!m) return null
  let hours = toNumber(m[1])
  if (/en een half/.test(m[0])) hours += 0.5
  if (!(hours > 0 && hours <= 16)) return null
  const quality = /slecht|onrustig|kort|badly|bad|rough/.test(s) ? 2 : /heerlijk|super|geweldig|great/.test(s) ? 5 : /goed|lekker|well|good/.test(s) ? 4 : 3
  return { category: 'sleep', summary: `Slaap — ${hours} uur`, fields: { hours: exact(hours), quality: est(quality) } }
}

function parseWeight(clause) {
  const s = clause.toLowerCase()
  if (!/weeg|gewogen|gewicht|weigh|weight|op de weegschaal/.test(s)) return null
  const m = s.match(new RegExp(`(${NUM})\\s*(kg|kilo|kilogram)?`, 'i'))
  if (!m) return null
  const kg = toNumber(m[1])
  if (!(kg > 25 && kg < 300)) return null
  return { category: 'weight', summary: `Gewicht — ${kg} kg`, fields: { kg: exact(kg) } }
}

function parseMood(clause) {
  const s = clause.toLowerCase()
  if (!/voel|ben |stemming|humeur|feel|i'm |i am |gaat /.test(`${s} `)) return null
  const scale = [
    ['Rough', /slecht|rot|ellendig|verdrietig|depressief|awful|terrible|miserable/],
    ['Great', /geweldig|fantastisch|super|top|heerlijk|amazing|great|fantastic/],
    ['Low', /\bmoe\b|matig|niet zo goed|niet goed|gestrest|down|somber|tired|stressed|meh/],
    ['Good', /\bgoed\b|fijn|blij|vrolijk|good|happy/],
    ['Okay', /prima|oké|oke|\bok\b|gaat wel|okay|fine/],
  ]
  const hit = scale.find(([, re]) => re.test(s))
  if (!hit) return null
  const nl = { Rough: 'slecht', Low: 'matig', Okay: 'oké', Good: 'goed', Great: 'geweldig' }
  return { category: 'mood', summary: `Stemming — ${nl[hit[0]]}`, fields: { label: exact(hit[0]), note: est(clause.trim()) } }
}

function parseWorkout(clause) {
  const s = clause.toLowerCase()
  const pr = s.match(new RegExp(`([\\p{L} ]+?)\\s+(?:met\\s+)?(${NUM})\\s*(?:kg|kilo)\\s*(?:voor|x|keer|for)?\\s*(\\d+)\\s*(?:keer|reps|herhalingen|x)?`, 'iu'))
  if (pr && /squat|bench|deadlift|bankdruk|press|curl|row|lunge|hip thrust|lat/.test(pr[1])) {
    const name = pr[1].replace(/^(ik heb|heb|ik|i|did|deed|gedaan)\s+/g, '').trim()
    return { category: 'workout', summary: `${name} — ${pr[2]} kg × ${pr[3]}`, fields: { mode: exact('log_pr'), exerciseName: exact(name), weightKg: exact(toNumber(pr[2])), reps: exact(Number(pr[3])) } }
  }
  if (/getraind|gesport|work(?:ed)? ?out|training gedaan|training af|naar de gym|gym geweest|gefitnest|hardgelopen|gerend|gezwommen|gefietst|yoga gedaan|cardio gedaan|trained|went running|exercised/.test(s)) {
    return { category: 'workout', summary: 'Training gedaan', fields: { mode: exact('complete_today') } }
  }
  return null
}

function parseBudget(clause) {
  const s = clause.toLowerCase()
  const m = s.match(new RegExp(`(?:€\\s*(${NUM})|(${NUM})\\s*(?:euro|eur|€))`, 'i'))
  if (!m) return null
  if (!/uitgegeven|betaald|gekocht|kostte|kost|spent|paid|bought|€|euro/.test(s)) return null
  const amount = toNumber(m[1] || m[2])
  const category = /boodschappen|eten|lunch|diner|restaurant|supermarkt|groceries|food/.test(s) ? 'food'
    : /benzine|tank|trein|bus|ov|taxi|uber|parkeren|train|fuel/.test(s) ? 'transport'
    : /kleding|kleren|schoenen|clothes|shoes|shop/.test(s) ? 'shopping'
    : /huur|rekening|abonnement|energie|bill|rent/.test(s) ? 'bills'
    : /bioscoop|film|concert|uitje|cinema|movie/.test(s) ? 'entertainment'
    : /apotheek|dokter|tandarts|sportschool|gym|pharmacy|doctor/.test(s) ? 'health' : 'other'
  return { category: 'budget', summary: `Uitgave — €${amount}`, fields: { amount: exact(amount), category: est(category), note: est(clause.trim()) } }
}

function parseTaskDone(clause, tasks) {
  const s = clause.toLowerCase()
  if (!/gedaan|gegeten|genomen|gehad|afgerond|klaar|done|finished|ingenomen|gelopen/.test(s)) return null
  for (const task of tasks || []) {
    if (task.done) continue
    const word = task.label.toLowerCase().replace(/\(.*?\)/g, '').split(/[^\p{L}]+/u).find((w) => w.length >= 4)
    if (word && wordRe(word).test(s)) {
      return { category: 'task_done', summary: `${task.time} ${task.label} — afgevinkt`, fields: { taskId: exact(task.id) } }
    }
  }
  return null
}

// context: { tasks: today's tasks [{id,time,label,done}] }
export function parseTranscriptLocally(transcript, context = {}) {
  // '7 en een half uur' → '7.5 uur' before ' en ' splits it into clauses.
  const text = transcript.trim().replace(/(\d+)\s+en\s+een\s+half/gi, '$1.5')
  if (!text) return []
  const when = /gisteren|gisteravond|yesterday|last night|vannacht/i.test(text) && !/vandaag|today/i.test(text) ? 'yesterday' : 'today'
  const clauses = text.split(/[.,;!?](?=\s|$)|\n+|\s+(?:en daarna|daarna|en ook|ook nog|en|and|then|plus)\s+/i).map((c) => c.trim()).filter(Boolean)

  const intents = []
  let vegTicked = false
  const taskIds = new Set()
  for (const clause of clauses) {
    const before = intents.length
    const budget = parseBudget(clause)
    if (budget) { intents.push(budget); continue }
    const sleep = parseSleep(clause)
    if (sleep) intents.push({ ...sleep, when: /vannacht|last night/i.test(text) ? 'today' : when })
    const weight = parseWeight(clause)
    if (weight) intents.push(weight)
    const workout = parseWorkout(clause)
    if (workout) intents.push(workout)
    const drink = parseDrink(clause)
    const foods = parseFoods(clause, text)
    if (drink && !(drink.category === 'drink' && foods.length && !/water|thee|koffie|tea|coffee/i.test(clause))) intents.push(drink)
    for (const food of foods) {
      const { veg, exactAmount, ...intent } = food
      intents.push(intent)
      if (veg && !vegTicked) {
        vegTicked = true
        intents.push({ category: 'meal', summary: 'Groenten gegeten', fields: { slot: est(null), includesVegetables: exact(true) } })
      }
    }
    if (!sleep && !weight && !workout && !foods.length) {
      const mood = parseMood(clause)
      if (mood) intents.push(mood)
    }
    const task = parseTaskDone(clause, context.tasks)
    if (task && !taskIds.has(task.fields.taskId.value)) {
      taskIds.add(task.fields.taskId.value)
      intents.push(task)
    }
    if (intents.length === before && clause.split(/\s+/).length >= 3) {
      intents.push({ category: 'note', summary: `Notitie — ${clause}`, fields: { text: exact(clause) } })
    }
  }

  return intents.map((intent, index) => ({
    id: `${Date.now().toString(36)}-l${index}`,
    when: intent.when || when,
    followUp: null,
    ...intent,
  }))
}
