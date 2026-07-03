// Bas-URL till backend. Tom i dev (Vite-proxy), sätts via VITE_API_URL i produktion.
const API = import.meta.env.VITE_API_URL || ''

// Konsumerar en SSE-ström från backend. onEvent(name, data) för varje event,
// onDelta(text) för textchunks.
export async function streamSse(path, body, { onDelta, onEvent }) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body || {}),
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok || !res.body) throw new Error(`Serverfel ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop()
    for (const chunk of chunks) {
      const name = chunk.match(/event: (.*)/)?.[1]
      const raw = chunk.match(/data: (.*)/s)?.[1]
      if (!name || !raw) continue
      const data = JSON.parse(raw)
      if (name === 'delta') onDelta?.(data.text)
      else onEvent?.(name, data)
    }
  }
}

export async function generateReport(sessionId) {
  const res = await fetch(API + `/api/report/${sessionId}/generate`, {
    method: 'POST',
    headers: authHeaders(),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Kunde inte generera rapport')
  return json.report
}

export async function mySessions() {
  const res = await fetch(API + '/api/my/sessions', { headers: authHeaders() })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error('Kunde inte hämta analyser')
  return (await res.json()).sessions
}

export async function fetchReport(sessionId) {
  const res = await fetch(API + `/api/report/${sessionId}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Rapporten kunde inte hämtas')
  return json
}

const TOKEN_KEY = 'klarsyn_admin_token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

function authHeaders() {
  return { Authorization: `Bearer ${getToken() || ''}` }
}

export async function adminLogin(user, pass) {
  const res = await fetch(API + '/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, pass }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Inloggning misslyckades')
  setToken(json.token)
  return json.token
}

export async function saveReport(sessionId, report) {
  const res = await fetch(API + `/api/report/${sessionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ report }),
  })
  if (!res.ok) throw new Error('Kunde inte spara')
  return (await res.json()).report
}

export async function approveReport(sessionId, approved) {
  const res = await fetch(API + `/api/report/${sessionId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ approved }),
  })
  if (!res.ok) throw new Error('Kunde inte godkänna')
  return (await res.json()).approved
}

export async function listSessions() {
  const res = await fetch(API + '/api/admin/sessions', { headers: authHeaders() })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error('Kunde inte hämta sessioner')
  return (await res.json()).sessions
}
