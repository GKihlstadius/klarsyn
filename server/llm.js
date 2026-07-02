import Anthropic from '@anthropic-ai/sdk'

const PROVIDER = process.env.LLM_PROVIDER || 'anthropic'

let anthropicClient
function anthropic() {
  if (!anthropicClient) anthropicClient = new Anthropic()
  return anthropicClient
}

function toOpenAiMessages(system, messages) {
  return [{ role: 'system', content: system }, ...messages]
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Extra params for reasoning-modeller (t.ex. gpt-oss pa Groq). Tomt om ej satt.
const reasoningParams = process.env.OPENAI_REASONING_EFFORT
  ? { reasoning_effort: process.env.OPENAI_REASONING_EFFORT }
  : {}

// POST mot OpenAI-kompatibel endpoint med retry vid 429 (respekterar foreslagen vantetid).
async function openaiFetch(body) {
  const url = `${process.env.OPENAI_BASE_URL}/chat/completions`
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (res.status !== 429) return res
    const text = await res.text()
    if (attempt === 3) throw new Error(`LLM 429: ${text}`)
    const secs = Number(text.match(/try again in ([\d.]+)s/)?.[1])
    await sleep(Number.isFinite(secs) ? secs * 1000 + 500 : 4000)
  }
}

// Streamar textchunks från modellen (async generator).
export async function* streamText({ system, messages, model, maxTokens = 2000 }) {
  if (PROVIDER === 'anthropic') {
    const stream = anthropic().messages.stream({
      model,
      max_tokens: maxTokens,
      system,
      messages,
    })
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
    return
  }

  // OpenAI-kompatibel (Groq, Gemini via kompatibel endpoint, m.fl.)
  const res = await openaiFetch({
    model,
    max_tokens: maxTokens,
    stream: true,
    ...reasoningParams,
    messages: toOpenAiMessages(system, messages),
  })
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {
        // ofullständig chunk, ignorera
      }
    }
  }
}

// Icke-streamande anrop som förväntar JSON tillbaka. Robust mot ```-fences.
export async function completeJSON({ system, messages, model, maxTokens = 1500 }) {
  let text
  if (PROVIDER === 'anthropic') {
    const res = await anthropic().messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages,
    })
    text = res.content.find((b) => b.type === 'text')?.text || ''
  } else {
    const res = await openaiFetch({
      model,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
      ...reasoningParams,
      messages: toOpenAiMessages(system, messages),
    })
    if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`)
    const json = await res.json()
    text = json.choices?.[0]?.message?.content || ''
  }
  if (!text) throw new Error('LLM returnerade tomt svar')
  return parseJson(text)
}

function parseJson(text) {
  let cleaned = text.trim()
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) cleaned = fence[1].trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1)
  return JSON.parse(cleaned)
}
