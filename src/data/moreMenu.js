// Shared by Sidebar.jsx (the nav drawer) and More.jsx (which still owns
// routing to each item's actual page component) — one source of the
// "everything else" menu structure so the two never drift out of sync.
export const MORE_SECTIONS = [
  {
    title: 'Coach & guidance',
    items: [
      { id: 'coach', label: 'Coach', desc: 'AI chat grounded in your data', icon: 'sparkle' },
      { id: 'gps', label: 'Lifestyle GPS', desc: 'Your phased roadmap', icon: 'compass' },
      { id: 'contracts', label: 'Habit Contracts', desc: 'If-then agreements with yourself', icon: 'handshake' },
      { id: 'insights', label: 'Insights', desc: 'Patterns in your data', icon: 'trendUp' },
    ],
  },
  {
    title: 'Transformation plan',
    items: [
      { id: 'dailyschedule', label: 'Dagschema & Menu', desc: 'Taken per dag en menurotatie', icon: 'repeat' },
      { id: 'weeklyprogress', label: 'Voortgang', desc: 'Week/maand score, streak, omtrekmaten', icon: 'trendUp' },
    ],
  },
  {
    title: 'Health & body',
    items: [
      { id: 'weight', label: 'Weight', desc: 'Trend over time', icon: 'scale' },
      { id: 'mood', label: 'Mood', desc: 'Scale & notes', icon: 'faceGood' },
      { id: 'nutrition', label: 'Nutrition', desc: 'Daily checklist', icon: 'apple' },
      { id: 'recipes', label: 'Recipes', desc: 'Ask for one, save your favorites', icon: 'utensils' },
      { id: 'cycle', label: 'Cycle', desc: 'Flow & symptoms', icon: 'droplet' },
      { id: 'alcohol', label: 'Alcohol', desc: 'Drinks logged', icon: 'droplet' },
    ],
  },
  {
    title: 'Life',
    items: [
      { id: 'budget', label: 'Budget', desc: 'Expenses & spending', icon: 'scale' },
      { id: 'schedule', label: 'Schedule', desc: 'Upcoming items', icon: 'calendar' },
      { id: 'notes', label: 'Notes', desc: 'Quick jottings, no AI needed', icon: 'chat' },
    ],
  },
  {
    title: 'Account',
    items: [
      { id: 'badges', label: 'Badges & Level', desc: 'Achievements, XP, challenges', icon: 'trophy' },
      { id: 'settings', label: 'Settings', desc: 'Colors, theme, data', icon: 'gear' },
    ],
  },
]
