// The app's one visual style ("Richting E": dark, soft coloured glow,
// outlined pill chips in a second colour, filled pill primary buttons —
// designed in the Figma file, see CLAUDE.md) comes in a few colour themes
// the user picks in Settings. Every theme sets the same set of CSS
// variables (applied in AppContext.jsx), so components only ever read
// var(--accent), var(--second), etc. and never care which theme is on.
//
// accent  — filled buttons, selected states, progress, the active tab
// second  — outlined chips/pills and the far end of gradients
// onAccent — text/icons sitting on an accent fill
// glow    — the soft radial light behind the bottom of every page
export const COLOR_THEMES = [
  {
    key: 'paars',
    label: 'Paars',
    bg: '#141218', surface: '#1E1B24', surfaceSoft: '#26222E', surfaceRaised: '#2C2835',
    text: '#F4F2F8', textSoft: '#B5B0BF', textFaint: '#8C8797',
    accent: '#9B5CFF', second: '#7EE0A8', onAccent: '#FFFFFF', glow: '#7B3FF2',
    water: '#6FB7FF', sleep: '#B79CFF', workout: '#FF8A5B',
  },
  {
    key: 'warm',
    label: 'Warm',
    bg: '#111914', surface: '#1A251F', surfaceSoft: '#213029', surfaceRaised: '#27372F',
    text: '#F4F0E8', textSoft: '#C4C2B6', textFaint: '#9AA59C',
    accent: '#E08A2E', second: '#E9D8B4', onAccent: '#1A120A', glow: '#D97A1A',
    water: '#7FC4D9', sleep: '#C9B8E8', workout: '#F2A65A',
  },
  {
    key: 'neon',
    label: 'Neon',
    bg: '#0B171C', surface: '#132830', surfaceSoft: '#1A333C', surfaceRaised: '#203D47',
    text: '#FFFFFF', textSoft: '#B8C9CF', textFaint: '#8FA6AE',
    accent: '#F5E614', second: '#53D6C5', onAccent: '#0F1E24', glow: '#C9BD10',
    water: '#53D6C5', sleep: '#A9B8FF', workout: '#F5E614',
  },
]

export const DEFAULT_COLOR_THEME = 'paars'

export function getColorTheme(key) {
  return COLOR_THEMES.find((t) => t.key === key) || COLOR_THEMES[0]
}
