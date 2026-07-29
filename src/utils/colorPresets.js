// Curated, grouped preset swatches for every color picker in Settings.
// Grouped (rather than one long undifferentiated row) so the range reads as
// deliberate — a handful of rich, distinct families instead of many
// near-identical purples.
export const COLOR_GROUPS = [
  {
    name: 'Purple',
    swatches: [
      { name: 'Violet', hex: '#8A5CB8' },
      { name: 'Amethyst', hex: '#9966CC' },
      { name: 'Deep Indigo', hex: '#5D3FD3' },
      { name: 'Orchid', hex: '#C77DD2' },
      { name: 'Plum', hex: '#8E4585' },
      { name: 'Lavender', hex: '#B9A6E0' },
    ],
  },
  {
    name: 'Jewel tones',
    swatches: [
      { name: 'Emerald', hex: '#0E8F6E' },
      { name: 'Sapphire', hex: '#1D4F91' },
      { name: 'Ruby', hex: '#A61E4D' },
      { name: 'Garnet', hex: '#7B2942' },
      { name: 'Topaz', hex: '#C98A1F' },
      { name: 'Jade', hex: '#2F9C7A' },
      { name: 'Cobalt', hex: '#2451A3' },
    ],
  },
  {
    name: 'Metallics & luxury',
    swatches: [
      { name: 'Champagne Gold', hex: '#D4B96A' },
      { name: 'Antique Gold', hex: '#C9A227' },
      { name: 'Rose Gold', hex: '#B76E79' },
      { name: 'Bronze', hex: '#A97142' },
      { name: 'Platinum', hex: '#B9B4A8' },
      { name: 'Pearl', hex: '#E4D9C0' },
      { name: 'Onyx', hex: '#2B2620' },
    ],
  },
  {
    name: 'Earth & nature',
    swatches: [
      { name: 'Moss', hex: '#6B7F52' },
      { name: 'Sage', hex: '#8DA377' },
      { name: 'Forest', hex: '#3F6B4A' },
      { name: 'Terracotta', hex: '#B0704A' },
      { name: 'Clay', hex: '#A9673F' },
    ],
  },
  {
    name: 'Ocean & sky',
    swatches: [
      { name: 'Ocean', hex: '#4E8FB0' },
      { name: 'Teal', hex: '#2C8C89' },
      { name: 'Slate Blue', hex: '#6C6EA0' },
      { name: 'Periwinkle', hex: '#8C9EDE' },
    ],
  },
  {
    name: 'Warm & sunset',
    swatches: [
      { name: 'Coral', hex: '#C97B63' },
      { name: 'Rose', hex: '#C06C84' },
      { name: 'Copper', hex: '#B4652F' },
      { name: 'Cognac', hex: '#8A5A32' },
      { name: 'Burgundy', hex: '#6E2142' },
    ],
  },
]

// Flat list retained for lookups (e.g. matching the currently selected hex).
export const COLOR_PRESETS = COLOR_GROUPS.flatMap((g) => g.swatches)

export const DEFAULT_COLORS = {
  accent: '#8A5CB8',
  ring: '#8A5CB8',
  water: '#4E8FB0',
  sleep: '#6C6EA0',
  workout: '#B0704A',
  gradientEnd: '#C9A6F2',
}

export const THEME_PRESETS = [
  { name: 'Signature Purple', colors: { accent: '#8A5CB8', ring: '#8A5CB8', water: '#4E8FB0', sleep: '#6C6EA0', workout: '#B0704A', gradientEnd: '#C9A6F2' } },
  { name: 'Midnight Sapphire', colors: { accent: '#1D4F91', ring: '#2451A3', water: '#4E8FB0', sleep: '#6C6EA0', workout: '#A61E4D', gradientEnd: '#8C9EDE' } },
  { name: 'Emerald & Gold', colors: { accent: '#0E8F6E', ring: '#C9A227', water: '#2C8C89', sleep: '#3F6B4A', workout: '#A97142', gradientEnd: '#D4B96A' } },
  { name: 'Ruby Noir', colors: { accent: '#A61E4D', ring: '#7B2942', water: '#6C6EA0', sleep: '#8E4585', workout: '#6E2142', gradientEnd: '#B76E79' } },
  { name: 'Lavender Fields', colors: { accent: '#9B8AC4', ring: '#B9A6E0', water: '#7FA8C9', sleep: '#8C9EDE', workout: '#C9A0DC', gradientEnd: '#E3D5F5' } },
  { name: 'Sage & Plum', colors: { accent: '#8E4585', ring: '#9B7EBD', water: '#6B7F52', sleep: '#8DA377', workout: '#8E4585', gradientEnd: '#CDA4DE' } },
  { name: 'Champagne Gold', colors: { accent: '#C9A227', ring: '#D4B96A', water: '#7FA8B0', sleep: '#9B8A6B', workout: '#A97142', gradientEnd: '#F0DFA8' } },
  { name: 'Onyx & Gold', colors: { accent: '#C9A227', ring: '#D4B96A', water: '#5B6B75', sleep: '#6B5B4A', workout: '#8C6B2E', gradientEnd: '#E8C87A' } },
]
