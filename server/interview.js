import { streamText, completeJSON } from './llm.js'
import { SYSTEM_PROMPT, PARTS, PART_ORDER, buildStateSummary } from './prompts.js'

const INTERVIEW_MODEL = process.env.INTERVIEW_MODEL || 'claude-sonnet-5'

const STATUS_ORDER = [
  'not_started',
  'in_progress',
  'partially_understood',
  'sufficiently_understood',
  'completed',
]

const MAX_EXCHANGES_PER_PART = 3

export function initialState() {
  const parts = {}
  const exchanges = {}
  for (const key of PART_ORDER) {
    parts[key] = { status: 'not_started', notes: '' }
    exchanges[key] = 0
  }
  parts.business.status = 'in_progress'
  return {
    activePart: 'business',
    exchanges,
    parts,
    extracted: {
      company_profile: {},
      business_goals: [],
      departments: [],
      bottlenecks: [],
      systems: [],
      data_sources: [],
      ai_usage: [],
      opportunities: [],
      roi_inputs: [],
    },
  }
}

function isSufficient(status) {
  return STATUS_ORDER.indexOf(status) >= STATUS_ORDER.indexOf('sufficiently_understood')
}

export function allPartsCovered(state) {
  return PART_ORDER.every((key) => isSufficient(state.parts[key].status))
}

function transcriptToMessages(transcript) {
  return transcript.map((t) => ({ role: t.role, content: t.content }))
}

// Genererar och streamar öppningsfrågan.
export function streamOpening() {
  const messages = [
    {
      role: 'user',
      content:
        'Starta intervjun. Hälsa kort, förklara att detta blir ett samtal på cirka 30 minuter, och ställ din första öppna fråga om vad bolaget gör och hur affären fungerar.',
    },
  ]
  return streamText({ system: SYSTEM_PROMPT, messages, model: INTERVIEW_MODEL, maxTokens: 600 })
}

// Uppdaterar state utifrån senaste svaret. Kör som ett separat, billigt anrop.
export async function updateState(state, transcript) {
  const system = `Du är en analysmotor som håller reda på en pågående AI-mognadsintervju. Du får hela transkriptet och nuvarande status. Uppdatera status för de fyra delarna och extrahera strukturerad data.

Statusnivåer (i ordning): not_started, in_progress, partially_understood, sufficiently_understood, completed.
En del är sufficiently_understood först när svaren går att använda i en rapport: konkret problem, berörd funktion, frekvens, tidsåtgång, affärskonsekvens.

Svara ENDAST med giltig JSON i detta format:
{
  "parts": {
    "business": {"status": "...", "notes": "kort sammanfattning"},
    "operations": {"status": "...", "notes": "..."},
    "systems": {"status": "...", "notes": "..."},
    "priorities": {"status": "...", "notes": "..."}
  },
  "activePart": "business|operations|systems|priorities",
  "extracted": {
    "company_profile": {},
    "business_goals": [],
    "departments": [],
    "bottlenecks": [],
    "systems": [],
    "data_sources": [],
    "ai_usage": [],
    "opportunities": [],
    "roi_inputs": []
  }
}
Behåll och bygg vidare på tidigare extraherad data. activePart ska vara den del som behöver mest arbete härnäst (tidigast i ordningen business, operations, systems, priorities som inte är sufficiently_understood).`

  const messages = [
    {
      role: 'user',
      content: `Nuvarande status:\n${JSON.stringify(state.parts)}\n\nTidigare extraherad data:\n${JSON.stringify(
        state.extracted,
      )}\n\nTranskript:\n${transcript.map((t) => `${t.role === 'assistant' ? 'Konsult' : 'Kund'}: ${t.content}`).join('\n')}`,
    },
  ]

  let result = null
  try {
    result = await completeJSON({
      system,
      messages,
      model: INTERVIEW_MODEL,
      maxTokens: 1500,
    })
  } catch {
    result = null
  }
  return normalizeState(state, result)
}

const rank = (status) => STATUS_ORDER.indexOf(status)

function normalizeState(prev, result) {
  const parts = {}
  for (const key of PART_ORDER) {
    const prevPart = prev.parts[key]
    const incoming = result?.parts?.[key]
    // Status kan bara HOJAS, aldrig sankas.
    let status = prevPart.status
    if (incoming?.status && STATUS_ORDER.includes(incoming.status) && rank(incoming.status) > rank(status)) {
      status = incoming.status
    }
    parts[key] = { status, notes: incoming?.notes || prevPart.notes }
  }

  // Rakna utbyten pa den del som var aktiv nar kunden svarade.
  const exchanges = { ...prev.exchanges }
  exchanges[prev.activePart] = (exchanges[prev.activePart] || 0) + 1

  // Tvinga fram progression: efter nagra utbyten accepteras tumregel och delen ar tillrackligt forstadd.
  if (exchanges[prev.activePart] >= MAX_EXCHANGES_PER_PART && !isSufficient(parts[prev.activePart].status)) {
    parts[prev.activePart].status = 'sufficiently_understood'
  }

  // activePart ror sig bara framat: forsta ej-tillrackliga delen fran och med nuvarande.
  const prevIdx = PART_ORDER.indexOf(prev.activePart)
  let activePart = prev.activePart
  for (let i = prevIdx; i < PART_ORDER.length; i++) {
    if (!isSufficient(parts[PART_ORDER[i]].status)) {
      activePart = PART_ORDER[i]
      break
    }
    if (i === PART_ORDER.length - 1) activePart = PART_ORDER[i]
  }
  if (parts[activePart].status === 'not_started') parts[activePart].status = 'in_progress'

  return {
    activePart,
    exchanges,
    parts,
    extracted: { ...prev.extracted, ...(result?.extracted || {}) },
  }
}

// Genererar och streamar nästa fråga (eller avslutning) utifrån state.
export function streamNextQuestion(state, transcript) {
  const finished = allPartsCovered(state)
  const guidance = finished
    ? 'Alla fyra delar är tillräckligt täckta. Avsluta intervjun varmt: tacka kunden, sammanfatta i en mening det viktigaste du hört, och förklara att en rapport med AI Readiness Score, flaskhalsar, ROI och en 90-dagars plan nu tas fram. Ställ ingen ny fråga.'
    : `Fortsätt intervjun. ${buildStateSummary(state)}

Viktigt:
- Ställ ALDRIG en fråga du redan ställt. Om du redan bett om en siffra och fått ett ungefärligt svar eller ett "vet inte", acceptera det, gör ett rimligt antagande och gå vidare. Mal aldrig vidare på exakta siffror.
- Om kunden uttryckt en oro eller invändning (t.ex. sekretess, att AI gör fel, kostnad): bemöt den kort och konkret innan du går vidare. Det bygger förtroende.
- Håll dig till den aktiva delen tills den känns tillräckligt förstådd, gå sedan vidare till nästa del.
- Ställ EN enda fråga, inte två hopbuntade.
- Variera hur du inleder. Använd inte "Om jag förstår rätt så" varje gång. Ibland kan du reflektera, ibland gå rakt på, ibland bjuda på en kort insikt först.`

  const messages = [
    ...transcriptToMessages(transcript),
    { role: 'user', content: `[Instruktion till dig som konsult, visas inte för kunden] ${guidance}` },
  ]

  return streamText({ system: SYSTEM_PROMPT, messages, model: INTERVIEW_MODEL, maxTokens: 700 })
}
