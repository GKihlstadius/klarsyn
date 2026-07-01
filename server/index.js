import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createSession, getSession, saveSession } from './db.js'
import {
  initialState,
  streamOpening,
  streamNextQuestion,
  updateState,
  allPartsCovered,
} from './interview.js'
import { PART_ORDER, PARTS } from './prompts.js'

const app = express()
app.use(cors())
app.use(express.json())

function sseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
}

function send(res, event, data) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

function progress(state) {
  const done = PART_ORDER.filter(
    (k) => state.parts[k].status === 'sufficiently_understood' || state.parts[k].status === 'completed',
  ).length
  return {
    activePart: state.activePart,
    activeTitle: PARTS[state.activePart].title,
    partsDone: done,
    partsTotal: PART_ORDER.length,
    parts: PART_ORDER.map((k) => ({ key: k, title: PARTS[k].title, status: state.parts[k].status })),
  }
}

// Starta intervju: skapar session och streamar öppningsfrågan.
app.post('/api/interview/start', async (req, res) => {
  const session = createSession(initialState())
  sseHeaders(res)
  send(res, 'session', { sessionId: session.id, progress: progress(session.state) })

  let opening = ''
  try {
    for await (const chunk of streamOpening()) {
      opening += chunk
      send(res, 'delta', { text: chunk })
    }
  } catch (err) {
    send(res, 'error', { message: String(err?.message || err) })
    return res.end()
  }

  const transcript = [{ role: 'assistant', content: opening }]
  saveSession(session.id, { status: 'in_progress', state: session.state, transcript })
  send(res, 'done', { progress: progress(session.state) })
  res.end()
})

// Skicka kundsvar: uppdaterar state och streamar nästa fråga.
app.post('/api/interview/message', async (req, res) => {
  const { sessionId, message } = req.body || {}
  const session = getSession(sessionId)
  if (!session) return res.status(404).json({ error: 'Sessionen finns inte' })
  if (session.status === 'completed') return res.status(409).json({ error: 'Intervjun är avslutad' })

  const transcript = [...session.transcript, { role: 'user', content: message }]

  sseHeaders(res)
  let state
  try {
    state = await updateState(session.state, transcript)
  } catch {
    state = session.state
  }
  send(res, 'progress', { progress: progress(state) })

  let reply = ''
  try {
    for await (const chunk of streamNextQuestion(state, transcript)) {
      reply += chunk
      send(res, 'delta', { text: chunk })
    }
  } catch (err) {
    send(res, 'error', { message: String(err?.message || err) })
    return res.end()
  }

  transcript.push({ role: 'assistant', content: reply })
  const finished = allPartsCovered(state)
  const status = finished ? 'completed' : 'in_progress'
  saveSession(sessionId, { status, state, transcript })
  send(res, 'done', { finished, progress: progress(state) })
  res.end()
})

app.get('/api/interview/:id/state', (req, res) => {
  const session = getSession(req.params.id)
  if (!session) return res.status(404).json({ error: 'Sessionen finns inte' })
  res.json({
    status: session.status,
    progress: progress(session.state),
    extracted: session.state.extracted,
    transcript: session.transcript,
  })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Klarsyn intervjumotor kör på http://localhost:${PORT}`))
