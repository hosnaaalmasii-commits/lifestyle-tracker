import Weight from './more/Weight'
import Mood from './more/Mood'
import Nutrition from './more/Nutrition'
import Badges from './more/Badges'
import Insights from './more/Insights'
import Coach from './more/Coach'
import HabitContracts from './more/HabitContracts'
import LifestyleGPS from './more/LifestyleGPS'
import Settings from './more/Settings'
import Cycle from './more/Cycle'
import Budget from './more/Budget'
import Schedule from './more/Schedule'
import DailySchedule from './more/DailySchedule'
import WeeklyProgress from './more/WeeklyProgress'
import Notes from './more/Notes'
import Alcohol from './more/Alcohol'
import Recipes from './more/Recipes'

// The "everything else" hub list used to render here (17 items grouped
// into sections). It's now the Sidebar (components/Sidebar.jsx, opened
// via the hamburger button in App.jsx) instead of a full page you tab
// into — this component's only job now is routing `view` to the right
// page. Section/item data lives in data/moreMenu.js, shared with Sidebar.
export default function More({ view, setView }) {
  if (view === 'weight') return <Weight onBack={() => setView(null)} />
  if (view === 'mood') return <Mood onBack={() => setView(null)} />
  if (view === 'nutrition') return <Nutrition onBack={() => setView(null)} />
  if (view === 'recipes') return <Recipes onBack={() => setView(null)} setView={setView} />
  if (view === 'cycle') return <Cycle onBack={() => setView(null)} />
  if (view === 'budget') return <Budget onBack={() => setView(null)} />
  if (view === 'alcohol') return <Alcohol onBack={() => setView(null)} />
  if (view === 'schedule') return <Schedule onBack={() => setView(null)} />
  if (view === 'dailyschedule') return <DailySchedule onBack={() => setView(null)} />
  if (view === 'weeklyprogress') return <WeeklyProgress onBack={() => setView(null)} />
  if (view === 'notes') return <Notes onBack={() => setView(null)} />
  if (view === 'insights') return <Insights onBack={() => setView(null)} />
  if (view === 'coach') return <Coach onBack={() => setView(null)} setView={setView} />
  if (view === 'contracts') return <HabitContracts onBack={() => setView(null)} />
  if (view === 'gps') return <LifestyleGPS onBack={() => setView(null)} />
  if (view === 'badges') return <Badges onBack={() => setView(null)} />
  if (view === 'settings') return <Settings onBack={() => setView(null)} />

  return null
}
