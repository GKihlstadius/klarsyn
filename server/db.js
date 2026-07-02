import pg from 'pg'
import { randomUUID } from 'node:crypto'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.warn('VARNING: DATABASE_URL saknas. Sätt Supabase-anslutningssträngen i .env.')
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')
    ? false
    : { rejectUnauthorized: false },
})

// Idempotent schema, sa lokal koring funkar aven utan att ha kort migrationen.
export async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      status TEXT NOT NULL,
      state JSONB NOT NULL,
      transcript JSONB NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      session_id UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      approved BOOLEAN NOT NULL DEFAULT false,
      report JSONB NOT NULL
    );
  `)
}

export async function createSession(state) {
  const id = randomUUID()
  await pool.query(
    `INSERT INTO sessions (id, status, state, transcript) VALUES ($1, $2, $3, $4)`,
    [id, 'in_progress', JSON.stringify(state), JSON.stringify([])],
  )
  return { id, state, transcript: [] }
}

export async function getSession(id) {
  const { rows } = await pool.query('SELECT * FROM sessions WHERE id = $1', [id])
  if (!rows[0]) return null
  const r = rows[0]
  return { id: r.id, status: r.status, state: r.state, transcript: r.transcript }
}

export async function saveSession(id, { status, state, transcript }) {
  await pool.query(
    `UPDATE sessions SET updated_at = now(), status = $2, state = $3, transcript = $4 WHERE id = $1`,
    [id, status, JSON.stringify(state), JSON.stringify(transcript)],
  )
}

export async function saveReport(sessionId, report) {
  await pool.query(
    `INSERT INTO reports (session_id, report) VALUES ($1, $2)
     ON CONFLICT (session_id) DO UPDATE SET created_at = now(), report = EXCLUDED.report`,
    [sessionId, JSON.stringify(report)],
  )
}

export async function getReport(sessionId) {
  const { rows } = await pool.query('SELECT * FROM reports WHERE session_id = $1', [sessionId])
  if (!rows[0]) return null
  return { sessionId: rows[0].session_id, approved: rows[0].approved, report: rows[0].report }
}

export async function updateReportJson(sessionId, report) {
  const res = await pool.query('UPDATE reports SET report = $2 WHERE session_id = $1', [
    sessionId,
    JSON.stringify(report),
  ])
  return res.rowCount > 0
}

export async function setReportApproved(sessionId, approved) {
  const res = await pool.query('UPDATE reports SET approved = $2 WHERE session_id = $1', [
    sessionId,
    approved,
  ])
  return res.rowCount > 0
}

export async function listSessions() {
  const { rows } = await pool.query(`
    SELECT s.id, s.created_at, s.updated_at, s.status,
           (r.session_id IS NOT NULL) AS has_report,
           COALESCE(r.approved, false) AS approved
    FROM sessions s
    LEFT JOIN reports r ON r.session_id = s.id
    ORDER BY s.updated_at DESC
  `)
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    status: r.status,
    hasReport: r.has_report,
    approved: r.approved,
  }))
}
