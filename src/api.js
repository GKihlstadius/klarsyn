// Konsumerar en SSE-ström från backend. onEvent(name, data) för varje event,
// onDelta(text) för textchunks.
export async function streamSse(path, body, { onDelta, onEvent }) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
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
  const res = await fetch(`/api/report/${sessionId}/generate`, { method: 'POST' })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Kunde inte generera rapport')
  return json.report
}

export async function fetchReport(sessionId) {
  const res = await fetch(`/api/report/${sessionId}`)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Rapporten kunde inte hämtas')
  return json
}

export async function saveReport(sessionId, report) {
  const res = await fetch(`/api/report/${sessionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report }),
  })
  if (!res.ok) throw new Error('Kunde inte spara')
  return (await res.json()).report
}

export async function approveReport(sessionId, approved) {
  const res = await fetch(`/api/report/${sessionId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved }),
  })
  if (!res.ok) throw new Error('Kunde inte godkänna')
  return (await res.json()).approved
}

export async function listSessions() {
  const res = await fetch('/api/admin/sessions')
  if (!res.ok) throw new Error('Kunde inte hämta sessioner')
  return (await res.json()).sessions
}
