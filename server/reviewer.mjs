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

async function runPersona(name, answers) {
  console.log(`\n\n################  PERSONA: ${name}  ################\n`)
  const start = await sse('/api/interview/start')
  const sessionId = start.events.session.sessionId
  console.log('KONSULT (öppning):\n' + start.text + '\n')

  for (let i = 0; i < answers.length; i++) {
    console.log(`VD: ${answers[i]}\n`)
    const r = await sse('/api/interview/message', { sessionId, message: answers[i] })
    const p = r.events.progress?.progress
    console.log(`KONSULT [${p ? p.partsDone + '/4, ' + p.activeTitle : ''}]:\n${r.text}\n`)
    if (r.events.done?.finished) {
      console.log('*** Intervjun avslutades av AI ***')
      break
    }
  }
  return sessionId
}

// Persona 1: advokatbyrå. Blandar detaljerat, vagt och en kurva (nämner GDPR-oro).
const lawFirm = [
  'Vi är en advokatbyrå i Stockholm, 25 jurister och 8 i administration. Mest affärsjuridik och tvister. Omsättning runt 90 miljoner.',
  'Ärligt talat vet jag inte, det bara funkar väl ungefär.',
  'Okej, om jag ska vara konkret så går enormt mycket tid åt till att juristerna själva sammanställer dokument och letar i gamla ärenden. En jurist debiterar 2800 i timmen men lägger kanske 10 timmar i veckan på sånt som inte är debiterbart.',
  'Vi kör ett gammalt dokumenthanteringssystem, allt ligger i Word och mappar. Ingen använder AI, och juristerna är skeptiska, mycket oro kring sekretess och GDPR.',
  'Vi skulle vilja frigöra debiterbar tid. Men jag är orolig att AI hittar på fel i juridiska texter, det kan bli katastrof.',
  'En vinst på 3 månader vore om varje jurist fick tillbaka några timmar i veckan utan att vi tummar på sekretessen.',
]

// Persona 2: e-handel, ger korta svar for att testa om AI:n gräver.
const ecom = [
  'Vi säljer träningskläder online, D2C. 12 anställda, 60 miljoner i omsättning.',
  'Lagret är ett problem.',
  'Vi får mycket returer och kundtjänsten drunknar i frågor om storlekar.',
  'Vi kör Shopify och Klaviyo. Lite ChatGPT privat men inget strukturerat.',
  'Returer och storleksfrågor, det kostar oss mest.',
]

const s1 = await runPersona('Advokatbyrå (blandad svarskvalitet + GDPR-oro)', lawFirm)
console.log('\n\n=== RAPPORT PERSONA 1 (advokatbyrå) ===\n')
const rep1 = await (await fetch(BASE + `/api/report/${s1}/generate`, { method: 'POST' })).json()
console.log(JSON.stringify(rep1.report, null, 2))

const s2 = await runPersona('E-handel (korta svar)', ecom)
console.log('\n\n=== RAPPORT PERSONA 2 (e-handel) ===\n')
const rep2 = await (await fetch(BASE + `/api/report/${s2}/generate`, { method: 'POST' })).json()
console.log(JSON.stringify(rep2.report?.executive_summary, null, 2))
console.log('ROI:', JSON.stringify(rep2.report?.roi, null, 2))
