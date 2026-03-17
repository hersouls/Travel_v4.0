// ============================================
// OpenAI TTS API Proxy
// Proxies text-to-speech requests to OpenAI API
// Returns audio/mpeg blob to client
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = { maxDuration: 60 }

// Inline rate limiter (same pattern as claude/generate.ts)
const _rlStore = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(key: string, max = 10, windowMs = 60_000) {
  const now = Date.now()
  for (const [k, e] of _rlStore) { if (e.resetAt <= now) _rlStore.delete(k) }
  const entry = _rlStore.get(key)
  if (!entry || entry.resetAt <= now) {
    _rlStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs }
  }
  entry.count++
  return { allowed: entry.count <= max, remaining: Math.max(0, max - entry.count), resetAt: entry.resetAt }
}

const ALLOWED_ORIGINS = [
  'https://travel1.moonwave.kr',
  'https://moonwave-travel.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

const MAX_CHUNK_LENGTH = 4096
const VALID_MODELS = ['tts-1', 'tts-1-hd']
const VALID_VOICES = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer']

function splitTextIntoChunks(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text]

  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?。！？\n])\s*/)
  let current = ''

  for (const sentence of sentences) {
    if ((current + sentence).length > maxLength) {
      if (current) chunks.push(current.trim())
      if (sentence.length > maxLength) {
        // Force split long sentences
        for (let i = 0; i < sentence.length; i += maxLength) {
          chunks.push(sentence.slice(i, i + maxLength))
        }
        current = ''
      } else {
        current = sentence
      }
    } else {
      current += (current ? ' ' : '') + sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())

  return chunks.filter(c => c.length > 0)
}

async function fetchTTSAudio(
  apiKey: string,
  text: string,
  model: string,
  voice: string,
): Promise<ArrayBuffer> {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
      voice,
      response_format: 'mp3',
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    if (response.status === 401) {
      throw new Error('OpenAI API 키가 유효하지 않습니다')
    }
    if (response.status === 429) {
      throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도하세요')
    }
    throw new Error(`OpenAI TTS API error: ${response.status} ${errorBody}`)
  }

  return response.arrayBuffer()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const origin = req.headers.origin || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-openai-api-key')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // API key from header or server env
  const apiKey = (req.headers['x-openai-api-key'] as string) || process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(401).json({ error: 'OpenAI API key required' })
  }

  // Rate limiting (10 requests per minute per API key or IP)
  const isServerKey = !req.headers['x-openai-api-key']
  const rateLimitKey = isServerKey
    ? `openai-tts-srv-${(req.headers['x-forwarded-for'] as string || 'unknown').split(',')[0].trim()}`
    : `openai-tts-${apiKey.slice(-8)}`
  const { allowed, remaining, resetAt } = checkRateLimit(rateLimitKey, 10, 60_000)
  res.setHeader('X-RateLimit-Remaining', String(remaining))
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
  if (!allowed) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  const { text, model = 'tts-1', voice = 'alloy' } = req.body || {}

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text is required' })
  }

  if (!VALID_MODELS.includes(model)) {
    return res.status(400).json({ error: `Invalid model. Use: ${VALID_MODELS.join(', ')}` })
  }

  if (!VALID_VOICES.includes(voice)) {
    return res.status(400).json({ error: `Invalid voice. Use: ${VALID_VOICES.join(', ')}` })
  }

  try {
    const chunks = splitTextIntoChunks(text, MAX_CHUNK_LENGTH)

    if (chunks.length === 1) {
      // Single chunk — return directly
      const audioBuffer = await fetchTTSAudio(apiKey, chunks[0], model, voice)
      res.setHeader('Content-Type', 'audio/mpeg')
      res.setHeader('Content-Length', String(audioBuffer.byteLength))
      return res.status(200).send(Buffer.from(audioBuffer))
    }

    // Multiple chunks — concatenate mp3 buffers
    const audioBuffers: ArrayBuffer[] = []
    for (const chunk of chunks) {
      const buffer = await fetchTTSAudio(apiKey, chunk, model, voice)
      audioBuffers.push(buffer)
    }

    // Concatenate all mp3 buffers
    const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.byteLength, 0)
    const combined = new Uint8Array(totalLength)
    let offset = 0
    for (const buf of audioBuffers) {
      combined.set(new Uint8Array(buf), offset)
      offset += buf.byteLength
    }

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Length', String(totalLength))
    return res.status(200).send(Buffer.from(combined))
  } catch (err: unknown) {
    console.error('[OpenAI TTS] Error:', err)
    const message = err instanceof Error ? err.message : 'OpenAI TTS API error'
    const status = message.includes('API 키') ? 401 : message.includes('너무 많') ? 429 : 500
    return res.status(status).json({ error: message })
  }
}
