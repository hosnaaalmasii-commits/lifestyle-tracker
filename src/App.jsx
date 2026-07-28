import { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { getComebackStatus } from './utils/comeback'
import TabBar from './components/TabBar'
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
  const [moreView, setMoreView] = useState(null)
  const [comebackDismissed, setComebackDismissed] = useState(false)

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

  const comeback = getComebackStatus(data)
  if (comeback.isComeback && !comebackDismissed) {
    return (
      <div className="app-shell">
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
