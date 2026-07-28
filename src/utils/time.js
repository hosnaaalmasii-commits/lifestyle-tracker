// Parses a rest string like "60-90 sec" or "2-3 min" into seconds,
// taking the upper bound of a range.
export function parseRestSeconds(rest) {
  if (!rest) return 60
  const isMin = /min/.test(rest)
  const numbers = rest.match(/\d+(\.\d+)?/g)?.map(Number) || [60]
  const value = numbers[numbers.length - 1]
  return Math.round(isMin ? value * 60 : value)
}

export function formatSeconds(total) {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
