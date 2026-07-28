import { useState } from 'react'
import { AppProvider } from './context/AppContext'
import TabBar from './components/TabBar'
import Overview from './pages/Overview'
import Water from './pages/Water'
import Sleep from './pages/Sleep'
import Workouts from './pages/Workouts'
import Progress from './pages/Progress'
import More from './pages/More'

function Shell() {
  const [activeTab, setActiveTab] = useState('overview')
  const [moreView, setMoreView] = useState(null)

  const navigate = (tab, subView = null) => {
    setActiveTab(tab)
    if (tab === 'more') setMoreView(subView)
  }

  const handleTabChange = (tab) => {
    if (tab === 'more' && activeTab === 'more') {
      setMoreView(null) // tapping More again while already there goes back to the hub
    } else if (tab === 'more') {
      setMoreView(null)
    }
    setActiveTab(tab)
  }

  return (
    <div className="app-shell">
      {activeTab === 'overview' && <Overview onNavigate={navigate} />}
      {activeTab === 'water' && <Water />}
      {activeTab === 'sleep' && <Sleep />}
      {activeTab === 'workouts' && <Workouts />}
      {activeTab === 'progress' && <Progress />}
      {activeTab === 'more' && <More view={moreView} setView={setMoreView} />}
      <TabBar active={activeTab} onChange={handleTabChange} />
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
