import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.warn('VARNING: SUPABASE_URL eller SUPABASE_SECRET_KEY saknas i miljon.')
}

const supabase = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_SECRET_KEY || 'saknas', {
  auth: { persistSession: false },
})

function must(res, what) {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res.data
}

// Verifierar att tabellerna finns och ger tydligt fel annars.
export async function ensureSchema() {
  const { error } = await supabase.from('sessions').select('id').limit(1)
  if (error) {
    throw new Error(
      `Databastabellerna saknas eller gar inte att na (${error.message}). Kor migrationen i supabase/migrations/ via Supabase SQL Editor eller "supabase db push".`,
    )
  }
}

export async function createSession(state) {
  const id = randomUUID()
  must(
    await supabase.from('sessions').insert({
      id,
      status: 'in_progress',
      state,
      transcript: [],
    }),
    'createSession',
  )
  return { id, state, transcript: [] }
}

export async function getSession(id) {
  const { data, error } = await supabase.from('sessions').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(`getSession: ${error.message}`)
  if (!data) return null
  return { id: data.id, status: data.status, state: data.state, transcript: data.transcript }
}

export async function saveSession(id, { status, state, transcript }) {
  must(
    await supabase
      .from('sessions')
      .update({ updated_at: new Date().toISOString(), status, state, transcript })
      .eq('id', id),
    'saveSession',
  )
}

export async function saveReport(sessionId, report) {
  must(
    await supabase
      .from('reports')
      .upsert({ session_id: sessionId, created_at: new Date().toISOString(), report }),
    'saveReport',
  )
}

export async function getReport(sessionId) {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()
  if (error) throw new Error(`getReport: ${error.message}`)
  if (!data) return null
  return { sessionId: data.session_id, approved: data.approved, report: data.report }
}

export async function updateReportJson(sessionId, report) {
  const { data, error } = await supabase
    .from('reports')
    .update({ report })
    .eq('session_id', sessionId)
    .select('session_id')
  if (error) throw new Error(`updateReportJson: ${error.message}`)
  return data.length > 0
}

export async function setReportApproved(sessionId, approved) {
  const { data, error } = await supabase
    .from('reports')
    .update({ approved })
    .eq('session_id', sessionId)
    .select('session_id')
  if (error) throw new Error(`setReportApproved: ${error.message}`)
  return data.length > 0
}

export async function deleteSession(id) {
  const { data, error } = await supabase.from('sessions').delete().eq('id', id).select('id')
  if (error) throw new Error(`deleteSession: ${error.message}`)
  return data.length > 0
}

export async function listSessions(owner) {
  let query = supabase
    .from('sessions')
    .select('id, created_at, updated_at, status, reports(approved)')
    .order('updated_at', { ascending: false })
  if (owner) query = query.eq('state->>owner', owner)
  const { data, error } = await query
  if (error) throw new Error(`listSessions: ${error.message}`)
  return data.map((r) => {
    const report = Array.isArray(r.reports) ? r.reports[0] : r.reports
    return {
      id: r.id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      status: r.status,
      hasReport: !!report,
      approved: report?.approved || false,
    }
  })
}
