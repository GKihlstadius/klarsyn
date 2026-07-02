const BASE = 'http://localhost:3001'

async function sse(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = '', text = ''
  const events = {}
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const chunks = buf.split('\n\n')
    buf = chunks.pop()
    for (const c of chunks) {
      const ev = c.match(/event: (.*)/)?.[1]
      const data = JSON.parse(c.match(/data: (.*)/s)?.[1] || '{}')
      if (ev === 'delta') text += data.text
      else events[ev] = data
    }
  }
  return { text, events }
}

const answers = [
  'Vi är ett bygg- och installationsföretag, 45 anställda, omsätter 120 miljoner. Mest ventilation och el till kommersiella fastigheter.',
  'Bruttovinsten kommer mest från serviceavtal, projekten är tajtare marginal. Mål är att växa service med 20 procent i år.',
  'Största utmaningen är att offert- och anbudsprocessen tar evigt, projektledarna sitter i Excel och räknar manuellt.',
  'Projektledning är flaskhalsen. Fyra projektledare, alla överbelastade. Mycket tid går till att jaga underlag och skriva rapporter till kund.',
  'En projektledare lägger säkert 8 timmar i veckan på rapporter och dokumentation. De kostar runt 650 kr i timmen internt.',
  'Fel uppstår mest i materialbeställningar, dubbelbeställningar och missade leveranser. Kanske 3-4 gånger i månaden och det blir dyrt.',
  'Vi kör ett affärssystem som heter Nästa, plus Excel överallt. Ekonomi i Fortnox. Data dubbelregistreras mellan Nästa och Excel.',
  'Rapportering till ledningen görs manuellt i Excel en gång i månaden, tar en hel dag för ekonomichefen.',
  'Ingen använder AI strukturerat. Några testar ChatGPT privat. Ingen policy, ingen utbildning.',
  'Vi vill helst frigöra tid i projektledningen först, och få snabbare offerter. Det skulle direkt öka försäljningen.',
  'Om en projektledare fick tillbaka en dag i veckan skulle vi kunna ta fler projekt utan att nyanställa. En framgång på 3 månader.',
  'Vi är villiga att investera om det ger tydlig avkastning, säg några hundra tusen för en pilot. Vi vill börja litet och skala.',
]

console.log('=== FULL INTERVJU ===\n')
const start = await sse('/api/interview/start')
const id = start.events.session.sessionId
console.log('Session:', id)
let finished = false
for (let i = 0; i < answers.length && !finished; i++) {
  const r = await sse('/api/interview/message', { sessionId: id, message: answers[i] })
  const p = r.events.progress?.progress
  finished = !!r.events.done?.finished
  console.log(`svar ${i + 1}: ${p?.partsDone}/4 (${p?.activeTitle})${finished ? '  <-- AVSLUTAD' : ''}`)
}
console.log('\nAvslutades av AI:', finished)

console.log('\n=== ADMIN: lista ===')
let list = await (await fetch(BASE + '/api/admin/sessions')).json()
console.log(list.sessions.find((s) => s.id === id))

console.log('\n=== Generera rapport ===')
const gen = await (await fetch(BASE + `/api/report/${id}/generate`, { method: 'POST' })).json()
console.log('AI-mognad score:', gen.report.scores.ai_mognad.score)
console.log('Funktion-falt (ska vara svenska):', gen.report.flaskhalsar.map((f) => f.funktion))
console.log('ROI:', JSON.stringify(gen.report.roi))

console.log('\n=== Hamta (delad lank) ===')
const fetched = await (await fetch(BASE + `/api/report/${id}`)).json()
console.log('approved:', fetched.approved, '| har rapport:', !!fetched.report)

console.log('\n=== Redigera: satt ai_mognad = 9 ===')
const edited = structuredClone(gen.report)
edited.scores.ai_mognad.score = 9
await fetch(BASE + `/api/report/${id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ report: edited }),
})
const after = await (await fetch(BASE + `/api/report/${id}`)).json()
console.log('ai_mognad efter redigering:', after.report.scores.ai_mognad.score)

console.log('\n=== Godkann ===')
await fetch(BASE + `/api/report/${id}/approve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ approved: true }),
})
list = await (await fetch(BASE + '/api/admin/sessions')).json()
console.log('approved i listan:', list.sessions.find((s) => s.id === id)?.approved)
