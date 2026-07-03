import { useState } from 'react'
import LandingPage from './LandingPage.jsx'
import Login from './Login.jsx'
import Interview from './Interview.jsx'
import Report from './Report.jsx'
import Admin from './Admin.jsx'
import { getToken, clearToken } from './api.js'

function initialRoute() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('admin') !== null) return { screen: 'admin', sessionId: null }
  const report = params.get('report')
  if (report) return { screen: 'shared', sessionId: report }
  return { screen: 'landing', sessionId: null }
}

export default function App() {
  const [route, setRoute] = useState(initialRoute)
  const { screen, sessionId } = route

  const go = (screen, sessionId = null) => setRoute({ screen, sessionId })
  const startFlow = () => go(getToken() ? 'interview' : 'login')

  if (screen === 'login') {
    return <Login onSuccess={() => go('interview')} onExit={() => go('landing')} />
  }

  if (screen === 'interview') {
    return (
      <Interview
        onComplete={(id) => go('report', id)}
        onExit={() => go('landing')}
        onOpenReport={(id) => go('shared', id)}
        onUnauthorized={() => {
          clearToken()
          go('login')
        }}
      />
    )
  }

  if (screen === 'report') {
    return <Report sessionId={sessionId} generate onExit={() => go('landing')} />
  }

  if (screen === 'shared') {
    return <Report sessionId={sessionId} generate={false} onExit={() => go('landing')} />
  }

  if (screen === 'admin') {
    return <Admin onExit={() => go('landing')} onOpenReport={(id) => go('shared', id)} />
  }

  return <LandingPage onStart={startFlow} onAdmin={() => go('admin')} />
}
