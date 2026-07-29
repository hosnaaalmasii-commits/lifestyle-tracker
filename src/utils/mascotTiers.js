// Mascot tiers piggyback on the existing XP/level curve (gamification.js)
// rather than a second parallel currency — the mascot is just a visual
// skin on progress that already exists, so it can never drift out of sync
// and needs no storage of its own.
import { levelFromXP } from './gamification'

export const MASCOT_TIERS = [
  { name: 'Spark', minLevel: 1, core: 1, rays: 0 },
  { name: 'Glow', minLevel: 3, core: 1.08, rays: 3 },
  { name: 'Flare', minLevel: 5, core: 1.16, rays: 5 },
  { name: 'Aurora', minLevel: 8, core: 1.24, rays: 7 },
  { name: 'Nova', minLevel: 11, core: 1.32, rays: 9 },
  { name: 'Celestia', minLevel: 15, core: 1.4, rays: 12 },
]

export function getMascotTier(xp) {
  const level = levelFromXP(xp)
  let index = 0
  MASCOT_TIERS.forEach((t, i) => { if (level >= t.minLevel) index = i })
  const tier = MASCOT_TIERS[index]
  const next = MASCOT_TIERS[index + 1] || null
  return {
    ...tier,
    index,
    level,
    next,
    levelsToNext: next ? next.minLevel - level : null,
  }
}
