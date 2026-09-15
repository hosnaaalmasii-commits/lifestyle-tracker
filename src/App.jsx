import { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { getComebackStatus } from './utils/comeback'
import TabBar from './components/TabBar'
import Sidebar from './components/Sidebar'
import Icon from './components/Icon'
import Wallpaper from './components/Wallpaper'
import ComebackScreen from './components/ComebackScreen'
import Overview from './pages/Overview'
import Water from './pages/Water'
import Sleep from './pages/Sleep'
import Workouts from './pages/Workouts'
import Progress from './pages/Progress'
import More from './pages/More'

function Shell() {
  const { data } = useApp()
  const [activeTab, setActiveTab] = useState('overview')
  const [moreView, setMoreViewState] = useState(null)
  const [comebackDismissed, setComebackDismissed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navigate = (tab, subView = null) => {
    setActiveTab(tab)
    if (tab === 'more') setMoreViewState(subView)
  }

  // There's no more a "More" hub page to land on — closing a More sub-page
  // (any onBack={() => setView(null)} inside pages/more/*) now leaves the
  // More section entirely rather than showing an empty page. Navigating
  // to another sub-page within More (e.g. Coach's "Set up in Settings"
  // link, setView('settings')) is unaffected — only the null case redirects.
  const setMoreView = (view) => {
    setMoreViewState(view)
    if (view === null) setActiveTab('overview')
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
  }

  const handleSidebarSelect = (itemId) => {
    navigate('more', itemId)
    setSidebarOpen(false)
  }

  const comeback = getComebackStatus(data)
  if (comeback.isComeback && !comebackDismissed) {
    return (
      <div className="app-shell">
        <Wallpaper type={data.settings.wallpaper} />
        <ComebackScreen
          gapDays={comeback.gapDays}
          onContinue={() => setComebackDismissed(true)}
          onGoToWorkout={() => { setComebackDismissed(true); setActiveTab('workouts') }}
        />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Wallpaper type={data.settings.wallpaper} />
      <div className="menu-fab-wrap">
        <div className="menu-fab-inner">
          <button className="menu-fab" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Icon name="menu" size={19} />
          </button>
        </div>
      </div>
      {activeTab === 'overview' && <Overview onNavigate={navigate} />}
      {activeTab === 'water' && <Water />}
      {activeTab === 'sleep' && <Sleep />}
      {activeTab === 'workouts' && <Workouts />}
      {activeTab === 'progress' && <Progress />}
      {activeTab === 'more' && <More view={moreView} setView={setMoreView} />}
      <TabBar active={activeTab} onChange={handleTabChange} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onSelect={handleSidebarSelect} />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
