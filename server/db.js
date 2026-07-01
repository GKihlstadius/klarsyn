import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

const db = new Database(process.env.DB_PATH || 'klarsyn.db')
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    status TEXT NOT NULL,
    state_json TEXT NOT NULL,
    transcript_json TEXT NOT NULL
  )
`)

export function createSession(state) {
  const id = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `INSERT INTO sessions (id, created_at, updated_at, status, state_json, transcript_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, now, now, 'in_progress', JSON.stringify(state), JSON.stringify([]))
  return { id, state, transcript: [] }
}

export function getSession(id) {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id)
  if (!row) return null
  return {
    id: row.id,
    status: row.status,
    state: JSON.parse(row.state_json),
    transcript: JSON.parse(row.transcript_json),
  }
}

export function saveSession(id, { status, state, transcript }) {
  db.prepare(
    `UPDATE sessions SET updated_at = ?, status = ?, state_json = ?, transcript_json = ? WHERE id = ?`,
  ).run(new Date().toISOString(), status, JSON.stringify(state), JSON.stringify(transcript), id)
}
