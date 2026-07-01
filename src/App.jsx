import { useState } from 'react'
import LandingPage from './LandingPage.jsx'
import Interview from './Interview.jsx'
import Report from './Report.jsx'

export default function App() {
  const [screen, setScreen] = useState('landing')
  const [sessionId, setSessionId] = useState(null)

  if (screen === 'interview') {
    return (
      <Interview
        onComplete={(id) => {
          setSessionId(id)
          setScreen('report')
        }}
        onExit={() => setScreen('landing')}
      />
    )
  }

  if (screen === 'report') {
    return <Report sessionId={sessionId} onExit={() => setScreen('landing')} />
  }

  return <LandingPage onStart={() => setScreen('interview')} />
}
