// Shared preset swatches for every color picker in Settings. Purples get an
// extensive range since that's the app's home palette; a handful of other
// warm/cool tones are included so Water/Sleep/Workout can be told apart.
export const COLOR_PRESETS = [
  { name: 'Lavender', hex: '#B9A6E0' },
  { name: 'Wisteria', hex: '#C9A0DC' },
  { name: 'Orchid', hex: '#C77DD2' },
  { name: 'Thistle', hex: '#CDA4DE' },
  { name: 'Amethyst', hex: '#9966CC' },
  { name: 'Violet', hex: '#8A5CB8' },
  { name: 'Iris', hex: '#5A4FCF' },
  { name: 'Deep Purple', hex: '#5D3FD3' },
  { name: 'Mauve', hex: '#9B7EBD' },
  { name: 'Plum', hex: '#8E4585' },
  { name: 'Eggplant', hex: '#5B3256' },
  { name: 'Periwinkle', hex: '#8C9EDE' },
  { name: 'Slate Blue', hex: '#6C6EA0' },
  { name: 'Teal', hex: '#4E9490' },
  { name: 'Ocean', hex: '#4E8FB0' },
  { name: 'Moss', hex: '#6B7F52' },
  { name: 'Sage', hex: '#8DA377' },
  { name: 'Terracotta', hex: '#B0704A' },
  { name: 'Coral', hex: '#C97B63' },
  { name: 'Rose', hex: '#C06C84' },
  { name: 'Charcoal', hex: '#4A4A45' },
  // Luxury metallics
  { name: 'Champagne Gold', hex: '#D4B96A' },
  { name: 'Antique Gold', hex: '#C9A227' },
  { name: 'Rose Gold', hex: '#B76E79' },
  { name: 'Bronze', hex: '#A97142' },
  { name: 'Platinum', hex: '#B9B4A8' },
  { name: 'Pearl', hex: '#E4D9C0' },
  { name: 'Onyx', hex: '#2B2620' },
]

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
  { name: 'Lavender Fields', colors: { accent: '#9B8AC4', ring: '#B9A6E0', water: '#7FA8C9', sleep: '#8C9EDE', workout: '#C9A0DC', gradientEnd: '#E3D5F5' } },
  { name: 'Midnight Amethyst', colors: { accent: '#5D3FD3', ring: '#8E6FE0', water: '#4E6FB0', sleep: '#5A4FCF', workout: '#8E4585', gradientEnd: '#B9A6E0' } },
  { name: 'Sage & Plum', colors: { accent: '#8E4585', ring: '#9B7EBD', water: '#6B7F52', sleep: '#8DA377', workout: '#8E4585', gradientEnd: '#CDA4DE' } },
  { name: 'Orchid Bloom', colors: { accent: '#C77DD2', ring: '#C77DD2', water: '#4E9490', sleep: '#9B7EBD', workout: '#C06C84', gradientEnd: '#F0C6F5' } },
  { name: 'Moss & Mauve', colors: { accent: '#9B7EBD', ring: '#9966CC', water: '#6B7F52', sleep: '#6B7F52', workout: '#B0704A', gradientEnd: '#CDA4DE' } },
  { name: 'Champagne Gold', colors: { accent: '#C9A227', ring: '#D4B96A', water: '#7FA8B0', sleep: '#9B8A6B', workout: '#A97142', gradientEnd: '#F0DFA8' } },
  { name: 'Onyx & Gold', colors: { accent: '#C9A227', ring: '#D4B96A', water: '#5B6B75', sleep: '#6B5B4A', workout: '#8C6B2E', gradientEnd: '#E8C87A' } },
]
