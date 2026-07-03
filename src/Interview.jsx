import { useEffect, useRef, useState } from 'react'
import { streamSse, mySessions, getInterviewState } from './api.js'
import './Interview.css'

function greeting() {
  const h = new Date().getHours()
  if (h >= 5 && h < 10) return 'God morgon'
  if (h >= 10 && h < 12) return 'God förmiddag'
  if (h >= 12 && h < 18) return 'God eftermiddag'
  return 'God kväll'
}

function LogoMark() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="8" width="16" height="7" rx="3.5" fill="#000" transform="rotate(-35 12 12)" />
      <rect
        x="4"
        y="8"
        width="16"
        height="7"
        rx="3.5"
        fill="#000"
        transform="rotate(-35 12 12) translate(0 6)"
      />
    </svg>
  )
}

export default function Interview({ onComplete, onExit, onOpenReport, onUnauthorized }) {
  const [mode, setMode] = useState('welcome')
  const [previous, setPrevious] = useState([])
  const [welcomeInput, setWelcomeInput] = useState('')
  const [messages, setMessages] = useState([])
  const [progress, setProgress] = useState(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState(null)

  const sessionRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    mySessions()
      .then(setPrevious)
      .catch((err) => {
        if (String(err.message) === 'unauthorized') onUnauthorized()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const appendDelta = (text) =>
    setMessages((prev) => {
      const next = [...prev]
      next[next.length - 1] = { ...next[next.length - 1], text: next[next.length - 1].text + text }
      return next
    })

  async function runStream(path, body) {
    setBusy(true)
    setMessages((prev) => [...prev, { role: 'assistant', text: '' }])
    try {
      await streamSse(path, body, {
        onDelta: appendDelta,
        onEvent: (name, data) => {
          if (name === 'session') {
            sessionRef.current = data.sessionId
            setProgress(data.progress)
          } else if (name === 'progress') {
            setProgress(data.progress)
          } else if (name === 'done') {
            if (data.progress) setProgress(data.progress)
            if (data.finished) setFinished(true)
          } else if (name === 'error') {
            setError(data.message)
          }
        },
      })
    } catch (err) {
      if (String(err.message) === 'unauthorized') return onUnauthorized()
      setError(String(err.message || err))
    } finally {
      setBusy(false)
    }
  }

  async function resume(id) {
    try {
      const data = await getInterviewState(id)
      sessionRef.current = id
      setMessages(data.transcript.map((t) => ({ role: t.role, text: t.content })))
      setProgress(data.progress)
      setFinished(data.status === 'completed')
      setMode('chat')
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  function startWithMessage() {
    const text = welcomeInput.trim()
    if (!text || busy) return
    setWelcomeInput('')
    setMessages([{ role: 'user', text }])
    setMode('chat')
    runStream('/api/interview/start', { message: text })
  }

  function send() {
    const text = input.trim()
    if (!text || busy || finished) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text }])
    runStream('/api/interview/message', { sessionId: sessionRef.current, message: text })
  }

  const pct = progress ? Math.round((progress.partsDone / progress.partsTotal) * 100) : 0

  if (mode === 'welcome') {
    return (
      <div className="iv iv-welcome">
        <header className="iv-top iv-top-plain">
          <button className="iv-back" onClick={onExit}>
            Till startsidan
          </button>
        </header>
        <div className="iv-hero">
          <LogoMark />
          <h1 className="iv-greeting">{greeting()}.</h1>
          <p className="iv-sub">Redo att se var AI skapar störst värde i ditt företag?</p>

          <div className="iv-start-card">
            <textarea
              value={welcomeInput}
              onChange={(e) => setWelcomeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  startWithMessage()
                }
              }}
              placeholder="Berätta kort vad ditt företag gör..."
              rows={1}
              autoFocus
            />
            <button
              className="iv-start-btn"
              onClick={startWithMessage}
              disabled={!welcomeInput.trim()}
            >
              Starta
            </button>
          </div>

          {error && <div className="iv-error">{error}</div>}

          {previous.length > 0 && (
            <div className="iv-previous">
              <span className="iv-previous-label">Dina analyser</span>
              {previous.slice(0, 5).map((s) => (
                <div key={s.id} className="iv-previous-item">
                  <span>
                    {new Date(s.updatedAt).toLocaleDateString('sv-SE')}
                    {s.status === 'in_progress' && <em className="iv-previous-status"> pågående</em>}
                  </span>
                  {s.status === 'in_progress' ? (
                    <button className="iv-previous-open" onClick={() => resume(s.id)}>
                      Fortsätt
                    </button>
                  ) : s.hasReport ? (
                    <button className="iv-previous-open" onClick={() => onOpenReport(s.id)}>
                      Visa rapport
                    </button>
                  ) : (
                    <button className="iv-previous-open" onClick={() => onComplete(s.id)}>
                      Skapa rapport
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="iv">
      <header className="iv-top">
        <button className="iv-back" onClick={onExit}>
          Avbryt
        </button>
        <div className="iv-progress">
          <div className="iv-progress-label">
            {progress ? progress.activeTitle : 'Startar samtal'}
            <span className="iv-progress-count">
              {progress ? `${progress.partsDone}/${progress.partsTotal}` : ''}
            </span>
          </div>
          <div className="iv-progress-bar">
            <div className="iv-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      <main className="iv-chat" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`iv-row ${m.role}`}>
            <div className="iv-bubble">{m.text || <span className="iv-typing">skriver</span>}</div>
          </div>
        ))}
        {error && <div className="iv-error">{error}</div>}
        {finished && (
          <div className="iv-done">
            <p>Tack, alla delar är genomgångna. Din rapport är redo att tas fram.</p>
            <button className="iv-report-btn" onClick={() => onComplete(sessionRef.current)}>
              Skapa min rapport
            </button>
          </div>
        )}
      </main>

      {!finished && (
        <footer className="iv-inputbar">
          <div className="iv-input-card">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder={busy ? 'Konsulten skriver...' : 'Skriv ditt svar'}
              rows={1}
              disabled={busy}
            />
            <button className="iv-send" onClick={send} disabled={busy || !input.trim()} aria-label="Skicka">
              ↑
            </button>
          </div>
        </footer>
      )}
    </div>
  )
}
