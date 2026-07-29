// Selectable gradient presets for the Fintech UI style's hero cards.
// Each has a start/end color for the gradient plus a matching accent (used
// for small highlights like ring fills and change indicators) — picked so
// each preset reads as one deliberate palette, not just two random stops.
export const FINTECH_GRADIENTS = [
  {
    key: 'nebula',
    name: 'Nebula',
    from: '#7C3AED',
    to: '#EC4899',
    accent: '#F5C542',
  },
  {
    key: 'ion',
    name: 'Ion',
    from: '#2563EB',
    to: '#7C3AED',
    accent: '#2DD4BF',
  },
  {
    key: 'wealth',
    name: 'Wealth',
    from: '#059669',
    to: '#A3E635',
    accent: '#FBBF24',
  },
]

export const DEFAULT_FINTECH_GRADIENT = 'nebula'

export function getFintechGradient(key) {
  return FINTECH_GRADIENTS.find((g) => g.key === key) || FINTECH_GRADIENTS[0]
}
