import { completeJSON } from './llm.js'
import { PART_ORDER, PARTS } from './prompts.js'

const REPORT_MODEL = process.env.REPORT_MODEL || 'claude-opus-4-8'

const SCORE_AREAS = [
  'ai_mognad',
  'digital_mognad',
  'datamognad',
  'processmognad',
  'automatiseringspotential',
  'roi_potential',
]

const REPORT_SYSTEM = `Du är en senior managementkonsult som skriver en AI-mognadsrapport på svenska utifrån en genomförd intervju. Rapporten ska vara praktisk, affärsnära och konkret. Inga tankestreck.

Regler:
- Hitta inte på fakta. Bygg allt på intervjudatan. Om något saknas, säg det som ett antagande.
- Betyg 1-10 ska motiveras kort och baseras på intervjun, inte gissas.
- ROI får vara överslagsmässig men alla antaganden ska framgå tydligt.
- Verktyg ska kopplas till kundens faktiska problem.

Svara ENDAST med giltig JSON enligt exakt detta schema:
{
  "executive_summary": {
    "storsta_problemet": "string",
    "storsta_mojligheten": "string",
    "storsta_risken": "string",
    "tre_atgarder": ["string", "string", "string"],
    "forvantad_nytta": "string"
  },
  "bolagsprofil": {
    "verksamhet": "string",
    "storlek": "string",
    "bransch": "string",
    "affarsmodell": "string",
    "viktigaste_mal": "string"
  },
  "scores": {
    "ai_mognad": {"score": 1, "motivering": "string"},
    "digital_mognad": {"score": 1, "motivering": "string"},
    "datamognad": {"score": 1, "motivering": "string"},
    "processmognad": {"score": 1, "motivering": "string"},
    "automatiseringspotential": {"score": 1, "motivering": "string"},
    "roi_potential": {"score": 1, "motivering": "string"}
  },
  "flaskhalsar": [
    {"problem": "string", "konsekvens": "string", "funktion": "string", "ai_losning": "string", "uppskattad_effekt": "string", "prioritet": "hog|medel|lag"}
  ],
  "ai_mojligheter": [
    {"namn": "string", "kategori": "string", "affarsvarde": "hog|medel|lag", "komplexitet": "hog|medel|lag", "tid_till_effekt": "string", "kostnadsniva": "hog|medel|lag", "prioritet": "hog|medel|lag"}
  ],
  "roi": {
    "timmar_sparade_per_vecka": "string",
    "kostnadsbesparing_per_manad": "string",
    "kostnadsbesparing_per_ar": "string",
    "aterbetalningstid": "string",
    "antaganden": ["string"],
    "nytta_fran_dag_ett": true
  },
  "rekommenderade_verktyg": [
    {"verktyg": "string", "syfte": "string", "kopplat_till": "string"}
  ],
  "roadmap": {
    "fas1_0_30": ["string"],
    "fas2_30_60": ["string"],
    "fas3_60_90": ["string"]
  },
  "nasta_steg": ["string"]
}`

export async function generateReport(session) {
  const { state, transcript } = session
  const partStatus = PART_ORDER.map((k) => `${PARTS[k].title}: ${state.parts[k].status}`).join(', ')

  const userContent = `Extraherad data från intervjun:
${JSON.stringify(state.extracted, null, 2)}

Delstatus: ${partStatus}

Fullständigt transkript:
${transcript.map((t) => `${t.role === 'assistant' ? 'Konsult' : 'Kund'}: ${t.content}`).join('\n')}

Skriv rapporten. Prioritera flaskhalsar och AI-möjligheter efter affärsvärde. Ge 3-6 flaskhalsar och 3-8 möjligheter om underlaget räcker.`

  const report = await completeJSON({
    system: REPORT_SYSTEM,
    messages: [{ role: 'user', content: userContent }],
    model: REPORT_MODEL,
    maxTokens: 5000,
  })

  return sanitize(report)
}

// Klampar betyg till 1-10 och sakerstaller att alla score-omraden finns.
function sanitize(report) {
  report.scores = report.scores || {}
  for (const area of SCORE_AREAS) {
    const s = report.scores[area] || {}
    let score = Number(s.score)
    if (!Number.isFinite(score)) score = 5
    score = Math.min(10, Math.max(1, Math.round(score)))
    report.scores[area] = { score, motivering: s.motivering || 'Ingen motivering angiven.' }
  }
  report.flaskhalsar = Array.isArray(report.flaskhalsar) ? report.flaskhalsar : []
  report.ai_mojligheter = Array.isArray(report.ai_mojligheter) ? report.ai_mojligheter : []
  report.rekommenderade_verktyg = Array.isArray(report.rekommenderade_verktyg)
    ? report.rekommenderade_verktyg
    : []
  return report
}
