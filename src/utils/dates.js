const pad = (n) => String(n).padStart(2, '0')

export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayKey() {
  return dateKey(new Date())
}

export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDaysToKey(key, delta) {
  const d = keyToDate(key)
  d.setDate(d.getDate() + delta)
  return dateKey(d)
}

export function lastNDayKeys(n, endKey = todayKey()) {
  const keys = []
  for (let i = n - 1; i >= 0; i--) keys.push(addDaysToKey(endKey, -i))
  return keys
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function weekdayShort(key) {
  return WEEKDAY_SHORT[keyToDate(key).getDay()]
}

export function humanDate(key) {
  const d = keyToDate(key)
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
}

export function humanDateFull(key) {
  const d = keyToDate(key)
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function isToday(key) {
  return key === todayKey()
}

// Monday-start week containing `key` (defaults to today), as 7 date keys.
export function currentWeekKeys(key = todayKey()) {
  const d = keyToDate(key)
  const dow = d.getDay() // 0=Sun..6=Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = addDaysToKey(key, mondayOffset)
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(monday, i))
}

export function previousWeekKeys(key = todayKey()) {
  return currentWeekKeys(addDaysToKey(key, -7))
}

// ISO-ish week number (Monday-start), stable enough for rotating weekly challenges.
export function weekNumber(key = todayKey()) {
  const d = keyToDate(key)
  const oneJan = new Date(d.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((d - oneJan) / 86400000) + 1
  return Math.ceil((dayOfYear + (oneJan.getDay() || 7) - 1) / 7)
}
