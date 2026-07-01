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

export function initialState() {
  const parts = {}
  for (const key of PART_ORDER) parts[key] = { status: 'not_started', notes: '' }
  parts.business.status = 'in_progress'
  return {
    activePart: 'business',
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

  try {
    const result = await completeJSON({
      system,
      messages,
      model: INTERVIEW_MODEL,
      maxTokens: 1500,
    })
    return normalizeState(state, result)
  } catch {
    return state
  }
}

function normalizeState(prev, result) {
  const parts = { ...prev.parts }
  for (const key of PART_ORDER) {
    const incoming = result.parts?.[key]
    if (incoming?.status && STATUS_ORDER.includes(incoming.status)) {
      parts[key] = { status: incoming.status, notes: incoming.notes || parts[key].notes }
    }
  }
  let activePart = result.activePart
  if (!PART_ORDER.includes(activePart)) {
    activePart = PART_ORDER.find((k) => !isSufficient(parts[k].status)) || 'priorities'
  }
  return {
    activePart,
    parts,
    extracted: { ...prev.extracted, ...(result.extracted || {}) },
  }
}

// Genererar och streamar nästa fråga (eller avslutning) utifrån state.
export function streamNextQuestion(state, transcript) {
  const finished = allPartsCovered(state)
  const guidance = finished
    ? 'Alla fyra delar är tillräckligt täckta. Avsluta intervjun varmt: tacka kunden, sammanfatta i en mening det viktigaste du hört, och förklara att en rapport med AI Readiness Score, flaskhalsar, ROI och en 90-dagars plan nu tas fram. Ställ ingen ny fråga.'
    : `Fortsätt intervjun. ${buildStateSummary(state)}\n\nOm senaste svaret var svagt (kort, generellt, utan volym eller konsekvens): gräv djupare med en följdfråga. Annars för samtalet framåt inom den aktiva delen, eller gå vidare till nästa del när den aktiva känns tillräckligt förstådd. Återkoppla gärna till något kunden nämnt tidigare. Ställ EN fråga.`

  const messages = [
    ...transcriptToMessages(transcript),
    { role: 'user', content: `[Instruktion till dig som konsult, visas inte för kunden] ${guidance}` },
  ]

  return streamText({ system: SYSTEM_PROMPT, messages, model: INTERVIEW_MODEL, maxTokens: 700 })
}
