import { useEffect, useRef, useState } from 'react'
import { streamSse } from './api.js'
import './Interview.css'

export default function Interview({ onComplete, onExit }) {
  const [messages, setMessages] = useState([])
  const [progress, setProgress] = useState(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(true)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState(null)

  const sessionRef = useRef(null)
  const startedRef = useRef(false)
  const scrollRef = useRef(null)

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
      setError(String(err.message || err))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    runStream('/api/interview/start')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function send() {
    const text = input.trim()
    if (!text || busy || finished) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text }])
    runStream('/api/interview/message', { sessionId: sessionRef.current, message: text })
  }

  const pct = progress ? Math.round((progress.partsDone / progress.partsTotal) * 100) : 0

  return (
    <div className="iv">
      <header className="iv-top">
        <button className="iv-back" onClick={onExit}>
          Avbryt
        </button>
        <div className="iv-progress">
          <div className="iv-progress-label">
            {progress ? progress.activeTitle : 'Startar samtal'}
            <span className="iv-progress-count">{progress ? `${progress.partsDone}/${progress.partsTotal}` : ''}</span>
          </div>
          <div className="iv-progress-bar">
            <div className="iv-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

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

      {!finished && (
        <footer className="iv-input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={busy ? 'Vänta på konsulten...' : 'Skriv ditt svar'}
            rows={1}
            disabled={busy}
          />
          <button className="iv-send" onClick={send} disabled={busy || !input.trim()}>
            Skicka
          </button>
        </footer>
      )}
    </div>
  )
}
