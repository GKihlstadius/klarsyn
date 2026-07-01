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
  const res = await fetch(`${process.env.OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      stream: true,
      messages: toOpenAiMessages(system, messages),
    }),
  })
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
    const res = await fetch(`${process.env.OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: toOpenAiMessages(system, messages),
      }),
    })
    const json = await res.json()
    text = json.choices?.[0]?.message?.content || ''
  }
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
