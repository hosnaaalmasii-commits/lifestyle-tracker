// Shared by Sidebar.jsx (the nav drawer) and More.jsx (which still owns
// routing to each item's actual page component) — one source of the
// "everything else" menu structure so the two never drift out of sync.
// Grouped by what you're doing (2026-10-16 cleanup). Titles are
// translated via i18n 'menuSection.<index>', items via 'menu.<id>'.
export const MORE_SECTIONS = [
  {
    title: 'Mijn plan',
    items: [
      { id: 'dailyschedule', label: 'Dagschema & Menu', desc: 'Taken per dag en menurotatie', icon: 'repeat' },
      { id: 'pantry', label: 'Voorraad & Menu', desc: 'Wat je in huis hebt, menu wisselen, boodschappen', icon: 'carrot' },
      { id: 'recipes', label: 'Recipes', desc: 'Ask for one, save your favorites', icon: 'utensils' },
      { id: 'schedule', label: 'Schedule', desc: 'Upcoming items', icon: 'calendar' },
    ],
  },
  {
    title: 'Lichaam',
    items: [
      { id: 'weight', label: 'Weight', desc: 'Trend over time', icon: 'scale' },
      { id: 'weeklyprogress', label: 'Voortgang', desc: 'Week/maand score, streak, omtrekmaten', icon: 'trendUp' },
      { id: 'photos', label: "Voortgangsfoto's", desc: 'Foto’s en vergelijken', icon: 'camera' },
      { id: 'cycle', label: 'Cycle', desc: 'Flow & symptoms', icon: 'droplet' },
      { id: 'nutrition', label: 'Nutrition', desc: 'Daily checklist', icon: 'apple' },
    ],
  },
  {
    title: 'Gevoel & leven',
    items: [
      { id: 'mood', label: 'Mood', desc: 'Scale & notes', icon: 'faceGood' },
      { id: 'alcohol', label: 'Alcohol', desc: 'Drinks logged', icon: 'droplet' },
      { id: 'budget', label: 'Budget', desc: 'Expenses & spending', icon: 'scale' },
      { id: 'notes', label: 'Notes', desc: 'Quick jottings, no AI needed', icon: 'chat' },
    ],
  },
  {
    title: 'Motivatie',
    items: [
      { id: 'companion', label: 'Je figuurtje', desc: 'Hoe je metgezel groeit', icon: 'flame' },
      { id: 'insights', label: 'Insights', desc: 'Patterns in your data', icon: 'trendUp' },
      { id: 'contracts', label: 'Habit Contracts', desc: 'If-then agreements with yourself', icon: 'handshake' },
      { id: 'gps', label: 'Lifestyle GPS', desc: 'Your phased roadmap', icon: 'compass' },
      { id: 'badges', label: 'Badges & Level', desc: 'Achievements, XP, challenges', icon: 'trophy' },
    ],
  },
  {
    title: 'Instellingen',
    items: [
      { id: 'coachsettings', label: 'Je coach', desc: 'Gezicht, stem en geheugen', icon: 'sparkle' },
      { id: 'settings', label: 'Settings', desc: 'Colors, theme, data', icon: 'gear' },
    ],
  },
]
