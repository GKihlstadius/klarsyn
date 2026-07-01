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
  );
  CREATE TABLE IF NOT EXISTS reports (
    session_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    approved INTEGER NOT NULL DEFAULT 0,
    report_json TEXT NOT NULL
  );
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

export function saveReport(sessionId, report) {
  db.prepare(
    `INSERT INTO reports (session_id, created_at, approved, report_json)
     VALUES (?, ?, 0, ?)
     ON CONFLICT(session_id) DO UPDATE SET created_at = excluded.created_at, report_json = excluded.report_json`,
  ).run(sessionId, new Date().toISOString(), JSON.stringify(report))
}

export function getReport(sessionId) {
  const row = db.prepare('SELECT * FROM reports WHERE session_id = ?').get(sessionId)
  if (!row) return null
  return { sessionId: row.session_id, approved: !!row.approved, report: JSON.parse(row.report_json) }
}

export function setReportApproved(sessionId, approved) {
  const res = db
    .prepare('UPDATE reports SET approved = ? WHERE session_id = ?')
    .run(approved ? 1 : 0, sessionId)
  return res.changes > 0
}
