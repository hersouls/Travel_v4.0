// ============================================
// Anthropic Claude AI Chat API Proxy
// Multi-turn conversational planner with SSE streaming
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

export const config = { maxDuration: 60 }

// Inline rate limiter (Vercel can't resolve local TS imports)
const _rlStore = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(key: string, max = 30, windowMs = 60_000) {
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

const MAX_BODY_SIZE = 512 * 1024 // 512KB

const MODEL_MAP: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5-20250929',
  opus: 'claude-opus-4-6',
}

function resolveModel(model?: string): string {
  return MODEL_MAP[model || 'sonnet'] || MODEL_MAP.sonnet
}

function buildSystemPrompt(tripContext?: { title?: string; country?: string }): string {
  const country = tripContext?.country || '해외'
  const title = tripContext?.title || '여행'

  return `당신은 친절하고 전문적인 한국어 여행 플래닝 어시스턴트입니다.
사용자는 "${title}" (${country}) 여행을 계획하고 있습니다.

역할:
- 여행 일정 제안 및 최적화
- 현지 맛집, 관광지, 숙소 추천
- 예산 계획 및 교통편 안내
- 현지 문화, 날씨, 주의사항 정보 제공
- 여행 팁 및 실용적 조언

규칙:
- 항상 한국어로 답변하세요
- 구체적이고 실용적인 정보를 제공하세요
- 가능하면 장소명, 주소, 가격 등 실제 정보를 포함하세요
- 친근하고 따뜻한 톤으로 대화하세요
- 불확실한 정보는 솔직하게 알려주세요`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — origin whitelist
  const origin = req.headers.origin || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Body size check
  const contentLength = Number(req.headers['content-length'] || 0)
  if (contentLength > MAX_BODY_SIZE) {
    return res.status(413).json({ error: 'Request body too large (max 512KB)' })
  }

  // API key: user-provided header or server env fallback
  const apiKey = (req.headers['x-api-key'] as string) || process.env.CLAUDE_API_KEY
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return res.status(401).json({ error: 'Valid Anthropic API key required (sk-ant-...)' })
  }

  // Rate limiting (30 requests per minute per API key)
  const rateLimitKey = apiKey.slice(-8)
  const { allowed, remaining, resetAt } = checkRateLimit(rateLimitKey, 30, 60_000)
  res.setHeader('X-RateLimit-Remaining', String(remaining))
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
  if (!allowed) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  const { message, tripContext, history = [], model } = req.body || {}

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' })
  }

  try {
    const client = new Anthropic({ apiKey })
    const systemPrompt = buildSystemPrompt(tripContext)
    const resolvedModel = resolveModel(model)

    // Build messages array from history + new message
    const messages: Anthropic.MessageParam[] = []

    // Add conversation history
    if (Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          // Skip empty assistant messages
          if (msg.role === 'assistant' && (!msg.content || msg.content.trim() === '')) continue
          messages.push({
            role: msg.role,
            content: msg.content,
          })
        }
      }
    }

    // Ensure messages alternate properly and start with user
    // If the last history message already contains the current user message, don't add again
    const lastMsg = messages[messages.length - 1]
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== message) {
      // If last message is also user, we need to add an assistant in between
      if (lastMsg && lastMsg.role === 'user') {
        messages.push({ role: 'assistant', content: '네, 계속 말씀해주세요.' })
      }
      messages.push({ role: 'user', content: message })
    }

    // Ensure the conversation starts with a user message
    if (messages.length > 0 && messages[0].role !== 'user') {
      messages.shift()
    }

    // SSE streaming response
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const response = client.messages.stream({
      model: resolvedModel,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    })

    for await (const event of response) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err: unknown) {
    console.error('[Claude Chat] Error:', err)
    const message = err instanceof Error ? err.message : 'Claude API proxy error'
    const status = message.includes('authentication') || message.includes('api_key') ? 401 : 500

    // If headers already sent (streaming started), end the stream
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    } else {
      res.status(status).json({ error: message })
    }
  }
}
