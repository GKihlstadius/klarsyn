import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { streamSse, mySessions, getInterviewState } from './api.js'
import './Interview.css'

const EASE = [0.16, 1, 0.3, 1]

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
  const [previous, setPrevious] = useState([])
  const [messages, setMessages] = useState([])
  const [progress, setProgress] = useState(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState(null)

  const sessionRef = useRef(null)
  const scrollRef = useRef(null)
  const taRef = useRef(null)

  const started = messages.length > 0

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

  useEffect(() => {
    if (!busy) taRef.current?.focus()
  }, [busy])

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
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  function send() {
    const text = input.trim()
    if (!text || busy || finished) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text }])
    if (!sessionRef.current) {
      runStream('/api/interview/start', { message: text })
    } else {
      runStream('/api/interview/message', { sessionId: sessionRef.current, message: text })
    }
  }

  const pct = progress ? Math.round((progress.partsDone / progress.partsTotal) * 100) : 0

  return (
    <div className={`iv ${started ? 'iv-started' : 'iv-fresh'}`}>
      <header className="iv-top">
        <button className="iv-back" onClick={onExit}>
          {started ? 'Avbryt' : 'Till startsidan'}
        </button>
        {started && (
          <motion.div
            className="iv-progress"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="iv-progress-label">
              {progress ? progress.activeTitle : 'Startar samtal'}
              <span className="iv-progress-count">
                {progress ? `${progress.partsDone}/${progress.partsTotal}` : ''}
              </span>
            </div>
            <div className="iv-progress-bar">
              <div className="iv-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </motion.div>
        )}
      </header>

      <div className="iv-body">
        <AnimatePresence>
          {!started && (
            <motion.div
              className="iv-hero"
              key="hero"
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              <LogoMark />
              <h1 className="iv-greeting">{greeting()}.</h1>
              <p className="iv-sub">Redo att se var AI skapar störst värde i ditt företag?</p>
            </motion.div>
          )}
        </AnimatePresence>

        {started && (
          <main className="iv-chat" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`iv-row ${m.role}`}>
                <div className="iv-bubble">
                  {m.text || <span className="iv-typing">skriver</span>}
                </div>
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
        )}

        {!finished && (
          <motion.div layout transition={{ duration: 0.5, ease: EASE }} className="iv-inputwrap">
            <div className="iv-input-card">
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder={
                  started
                    ? busy
                      ? 'Konsulten skriver...'
                      : 'Skriv ditt svar'
                    : 'Berätta kort vad ditt företag gör...'
                }
                rows={1}
                disabled={busy}
                autoFocus
              />
              <button
                className="iv-send"
                onClick={send}
                disabled={busy || !input.trim()}
                aria-label="Skicka"
              >
                ↑
              </button>
            </div>
          </motion.div>
        )}

        {!started && error && <div className="iv-error">{error}</div>}

        <AnimatePresence>
          {!started && previous.length > 0 && (
            <motion.div
              className="iv-previous"
              key="previous"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <span className="iv-previous-label">Dina analyser</span>
              {previous.slice(0, 5).map((s) => (
                <div key={s.id} className="iv-previous-item">
                  <span>
                    {new Date(s.updatedAt).toLocaleDateString('sv-SE')}
                    {s.status === 'in_progress' && (
                      <em className="iv-previous-status"> pågående</em>
                    )}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
