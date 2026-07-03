import { useState } from 'react'
import { adminLogin } from './api.js'
import './Admin.css'

export default function Login({ onSuccess, onExit }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await adminLogin(user, pass)
      onSuccess()
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ad ad-login-wrap">
      <form className="ad-login" onSubmit={submit}>
        <div className="ad-login-brand">Klarsyn</div>
        <p className="ad-login-sub">Logga in för att starta din AI-analys.</p>
        <input
          placeholder="Användarnamn"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          placeholder="Lösenord"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
        />
        {error && <span className="ad-login-error">{error}</span>}
        <button className="ad-btn primary" type="submit" disabled={busy}>
          {busy ? 'Loggar in...' : 'Logga in'}
        </button>
        <button type="button" className="ad-login-back" onClick={onExit}>
          Tillbaka till startsidan
        </button>
      </form>
    </div>
  )
}
