const BASE = 'http://localhost:3001'

async function sse(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let text = ''
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
  'Vi säljer specialkaffe och utrustning, mest B2B till kontor och caféer. Omsättning runt 40 miljoner, 18 anställda. Bruttovinsten kommer mest från abonnemang på kaffeleveranser.',
  'Största utmaningen är kundtjänst. De är helt pressade. Ungefär 400 ärenden i veckan, mycket är samma frågor om leveransstatus och fakturor. Två personer sitter fast i det heltid och vi tappar affärer när svarstiden blir lång.',
  'Vi kör Fortnox för ekonomi och ett eget ordersystem i Excel egentligen. Data dubbelregistreras mellan systemen. Ingen använder AI idag, ingen policy, ingen utbildning.',
  'Vi vill helst frigöra tid i kundtjänst först. En handläggare kostar runt 400 kr i timmen. Om vi kunde automatisera hälften av ärendena vore det en enorm vinst. Framgång på 3 månader vore halverad svarstid.',
]

const start = await sse('/api/interview/start')
const sessionId = start.events.session.sessionId
console.log('SESSION:', sessionId)
console.log('OPENING:', start.text.slice(0, 120), '...\n')

for (const a of answers) {
  const r = await sse('/api/interview/message', { sessionId, message: a })
  console.log('PROGRESS:', r.events.progress?.progress?.partsDone + '/4', '| Q:', r.text.slice(0, 90), '...')
}

console.log('\nGenererar rapport...')
const rep = await fetch(BASE + `/api/report/${sessionId}/generate`, { method: 'POST' })
const json = await rep.json()
if (json.error) {
  console.log('FEL:', json)
} else {
  const r = json.report
  console.log('\n=== EXECUTIVE SUMMARY ===')
  console.log('Största problem:', r.executive_summary?.storsta_problemet)
  console.log('Största möjlighet:', r.executive_summary?.storsta_mojligheten)
  console.log('Tre åtgärder:', r.executive_summary?.tre_atgarder)
  console.log('\n=== SCORES ===')
  for (const [k, v] of Object.entries(r.scores)) console.log(`${k}: ${v.score}/10 - ${v.motivering}`)
  console.log('\n=== FLASKHALSAR ===', r.flaskhalsar?.length)
  console.log(r.flaskhalsar?.[0])
  console.log('\n=== ROI ===')
  console.log(r.roi)
  console.log('\n=== ROADMAP fas1 ===', r.roadmap?.fas1_0_30)
}
