// ============================================
// LangChain Claude AI Generate API
// SSE streaming + Zod structured output
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { STRUCTURED_SCHEMAS, STREAMING_TEXT_TYPES } from './schemas'

export const config = { maxDuration: 60 }

// Inline rate limiter
const _rlStore = new Map<string, { count: number; resetAt: number }>()
function checkRateLimit(key: string, max = 30, windowMs = 60_000) {
  const now = Date.now()
  for (const [k, e] of _rlStore) { if (e.resetAt <= now) _rlStore.delete(k) }
  if (_rlStore.size > 1000) {
    const entries = Array.from(_rlStore.entries()).sort((a, b) => a[1].resetAt - b[1].resetAt)
    const toRemove = Math.ceil(entries.length / 2)
    for (let i = 0; i < toRemove; i++) _rlStore.delete(entries[i][0])
  }
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

const MAX_BODY_SIZE = 2 * 1024 * 1024

const CLAUDE_MODEL_MAP: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5-20250929',
  opus: 'claude-opus-4-6',
}

const GEMINI_MODEL_MAP: Record<string, string> = {
  flash: 'gemini-2.0-flash',
  pro: 'gemini-2.5-pro-preview-05-06',
}

function resolveClaudeModel(model?: string): string {
  return CLAUDE_MODEL_MAP[model || 'sonnet'] || CLAUDE_MODEL_MAP.sonnet
}

function resolveGeminiModel(model?: string): string {
  return GEMINI_MODEL_MAP[model || 'flash'] || GEMINI_MODEL_MAP.flash
}

function getMaxTokens(type: string): number {
  if (['itinerary', 'day-recommend', 'day-suggest'].includes(type)) return 8192
  return 4096
}

function buildSystemPrompt(type: string, context: Record<string, unknown>): string {
  switch (type) {
    case 'guide':
      return `당신은 한국어 여행 가이드 전문 작가입니다.
TTS 낭독에 적합한 자연스러운 구어체로 작성하세요.
- 청자가 실제 여행지에서 듣는 상황을 가정
- 역사, 문화, 실용 정보를 자연스럽게 녹여내기
- 마크다운 기호 사용 금지 (순수 텍스트만)
- 3~5분 분량 (약 800~1200자)
- 따뜻하고 친근한 톤`

    case 'itinerary':
      return `당신은 전문 여행 플래너입니다.
주어진 여행 정보를 기반으로 최적의 일정을 생성하세요.
- 각 일정은 현실적인 이동 시간 고려
- 식사 시간 포함 (아침/점심/저녁)
- 관심사와 여행 스타일 반영
- 가능하면 위도/경도 포함`

    case 'day-recommend':
      return `당신은 전문 여행 플래너입니다.
주어진 여행 정보와 키워드를 기반으로 Day ${context.dayNumber || 1} 일정을 생성하세요.
- 키워드/관심 장소를 중심으로 현실적인 하루 일정 구성
- 아침부터 저녁까지 시간대별로 5~8개 일정
- 식사 시간 포함
- 장소 간 이동 시간과 거리를 고려한 현실적인 시간 배분
- 해당 국가/도시의 실제 존재하는 장소만 추천
- 가능하면 위도/경도 포함 (소수점 6자리)`

    case 'day-suggest':
      return `당신은 전문 여행 일정 컨설턴트입니다.
기존 하루 일정을 분석하고 개선안을 제안하세요.
- 기존 일정의 장단점을 솔직하게 분석
- 동선 최적화, 누락된 식사, 시간 배분 개선을 구체적으로 제안
- 기존 장소를 최대한 유지하면서 순서/시간 조정
- 필요시 빠진 식사나 쉼 시간을 추가
- revisedPlans는 개선된 전체 하루 일정
- 가능하면 위도/경도 포함`

    case 'memo':
      return `당신은 여행 정보 전문가입니다.
장소에 대한 실용적인 여행 메모를 작성하세요.
아래 형식을 사용하세요:

📍 기본 정보
주소: ...
운영시간: ...

✅ 방문 전 체크리스트
[ ] 항목1
[ ] 항목2

💡 여행 팁
- 팁1
- 팁2

💰 예상 비용
항목: 금액

🚗 교통
- 접근 방법

- 간결하고 실용적인 정보 위주
- 이모지 섹션 헤더 사용
- 한국어로 작성
- 마크다운 기호 절대 사용 금지 (#, ##, **, *, |테이블|, ---, > 등)
- 순수 텍스트 + 이모지 섹션 헤더만 사용`

    case 'analyze-image':
      return `당신은 여행 사진 분석 전문가입니다.
사진을 분석하여 장소 정보를 추출하세요.
- 확실하지 않은 정보는 빈 값으로
- 한국어로 작성`

    case 'analyze-photo-location':
      return `당신은 여행 사진의 위치를 분석하는 전문가입니다.
사진에서 위치를 식별할 수 있는 모든 단서를 분석하세요:
- 간판, 표지판, 텍스트 (어떤 언어든)
- 랜드마크, 건물 외관, 브랜드 로고
- 음식, 메뉴, 영수증의 가게 이름
- 교통수단, 도로 표지판
- 자연환경, 건축 양식
${context.country ? `\n참고: 이 사진은 "${context.country}" 여행 중 촬영되었습니다.` : ''}`

    case 'receipt-food':
      return `당신은 영수증 OCR 전문가입니다.
음식점/카페 영수증 사진을 분석하여 정보를 정확히 추출하세요.
- 금액은 순수 숫자만 (쉼표/통화기호 제거)
- currency는 ISO 4217 코드 (KRW, JPY, USD, EUR, THB, VND 등)
- 읽을 수 없는 항목은 빈 문자열이나 0
- 다국어 영수증 분석 가능
- 현지 통화 정확히 식별: ฿=THB, ₫=VND, ¥=JPY(일본)/CNY(중국), ₩=KRW, $=USD, €=EUR, £=GBP`

    case 'receipt-general':
      return `당신은 영수증 OCR 전문가입니다.
일반 영수증/결제 내역 사진을 분석하여 정보를 정확히 추출하세요.
- category는 가게 유형에 따라 자동 분류
- 금액은 순수 숫자만
- currency는 ISO 4217 코드
- 다국어 영수증 분석 가능
- 현지 통화 정확히 식별: ฿=THB, ₫=VND, ¥=JPY(일본)/CNY(중국), ₩=KRW, $=USD, €=EUR, £=GBP`

    case 'travel-diary':
      return `당신은 감성적이고 따뜻한 여행 에세이 작가입니다.
주어진 여행 기록 데이터를 기반으로 자연스러운 여행 일기를 작성하세요.
- 1인칭 시점으로 작성
- 장소명과 시간을 자연스럽게 녹여내기
- 감정, 분위기, 날씨 등을 상상하여 풍부하게 묘사
- 마크다운 없이 순수 텍스트로 작성
- 문단 나누기는 빈 줄로
- 800~1500자 분량`

    case 'test':
      return '연결 테스트입니다. "Claude AI 연결 성공! 🎉" 라고만 답하세요.'

    default:
      return '한국어로 간결하게 답변하세요.'
  }
}

function buildUserMessage(type: string, context: Record<string, unknown>): string {
  switch (type) {
    case 'guide': {
      const parts = [`장소: ${context.placeName || '알 수 없음'}`]
      if (context.address) parts.push(`주소: ${context.address}`)
      if (context.country) parts.push(`국가: ${context.country}`)
      if (context.category) parts.push(`카테고리: ${context.category}`)
      if (context.rating) parts.push(`평점: ${context.rating}`)
      if (context.memo) parts.push(`기존 메모:\n${context.memo}`)
      parts.push('\n이 장소에 대한 음성 가이드 스크립트를 작성해주세요.')
      return parts.join('\n')
    }

    case 'itinerary': {
      const parts = [`여행지: ${context.country || '알 수 없음'}`]
      if (context.startDate) parts.push(`출발일: ${context.startDate}`)
      if (context.endDate) parts.push(`종료일: ${context.endDate}`)
      if (context.totalDays) parts.push(`총 일수: ${context.totalDays}일`)
      if (context.interests) parts.push(`관심사: ${(context.interests as string[]).join(', ')}`)
      if (context.style) parts.push(`여행 스타일: ${context.style}`)
      if (context.budget) parts.push(`예산: ${context.budget}`)
      parts.push('\n위 조건에 맞는 여행 일정을 생성해주세요.')
      return parts.join('\n')
    }

    case 'day-recommend': {
      const parts = [`여행지: ${context.country || '알 수 없음'}`]
      parts.push(`Day ${context.dayNumber || 1}`)
      if (context.dayDate) parts.push(`날짜: ${context.dayDate}`)
      if (context.totalDays) parts.push(`전체 여행: ${context.totalDays}일 중`)
      if (context.keywords) parts.push(`관심 키워드/장소: ${context.keywords}`)
      if (context.interests) parts.push(`관심사: ${(context.interests as string[]).join(', ')}`)
      if (context.style) parts.push(`여행 스타일: ${context.style}`)
      parts.push('\n위 키워드를 중심으로 이 날의 하루 일정을 생성해주세요.')
      return parts.join('\n')
    }

    case 'day-suggest': {
      const parts = [`여행지: ${context.country || '알 수 없음'}`]
      parts.push(`Day ${context.dayNumber || 1}`)
      if (context.dayDate) parts.push(`날짜: ${context.dayDate}`)
      const existingPlans = context.existingPlans as Array<{
        placeName: string; startTime: string; endTime?: string;
        type: string; address?: string
      }>
      if (existingPlans && existingPlans.length > 0) {
        parts.push('\n현재 일정:')
        existingPlans.forEach((p, i) => {
          parts.push(`${i + 1}. ${p.startTime}${p.endTime ? '-' + p.endTime : ''} ${p.placeName} (${p.type})${p.address ? ' - ' + p.address : ''}`)
        })
      }
      parts.push('\n위 일정을 분석하고 개선안을 제안해주세요.')
      return parts.join('\n')
    }

    case 'memo': {
      const parts = [`장소: ${context.placeName || '알 수 없음'}`]
      if (context.type) parts.push(`유형: ${context.type}`)
      if (context.address) parts.push(`주소: ${context.address}`)
      if (context.country) parts.push(`국가: ${context.country}`)
      if (context.existingMemo) parts.push(`기존 메모:\n${context.existingMemo}`)
      parts.push('\n이 장소에 대한 실용적인 여행 메모를 작성해주세요.')
      return parts.join('\n')
    }

    case 'analyze-image':
      return '이 사진을 분석하여 장소 정보를 추출해주세요.'

    case 'analyze-photo-location':
      return `이 사진의 촬영 위치를 분석해주세요.${context.country ? ` (여행국가: ${context.country})` : ''}`

    case 'receipt-food':
      return '이 음식점 영수증에서 가게 이름, 메뉴, 금액을 추출해주세요.'

    case 'receipt-general':
      return '이 영수증/결제 내역에서 정보를 추출해주세요.'

    case 'travel-diary': {
      const parts = [`여행 제목: ${context.tripTitle || '나의 여행'}`]
      if (context.dayNumber) parts.push(`Day ${context.dayNumber}`)
      if (context.totalDays) parts.push(`전체 ${context.totalDays}일 여행`)
      if (context.logSummaries) parts.push(`\n여행 기록:\n${context.logSummaries}`)
      parts.push('\n위 여행 기록을 바탕으로 감성적인 여행 일기를 작성해주세요.')
      return parts.join('\n')
    }

    case 'test':
      return '연결 테스트'

    default:
      return context.prompt as string || '안녕하세요'
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  const origin = req.headers.origin || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ''
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key, x-gemini-api-key')
  res.setHeader('Vary', 'Origin')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const contentLength = Number(req.headers['content-length'] || 0)
  if (contentLength > MAX_BODY_SIZE) {
    return res.status(413).json({ error: 'Request body too large (max 2MB)' })
  }

  const { type, context = {}, image, imageFormat, model, stream = true, provider = 'claude' } = req.body || {}

  // Resolve API key based on provider
  let apiKey: string | undefined
  if (provider === 'gemini') {
    apiKey = (req.headers['x-gemini-api-key'] as string) || process.env.GEMINI_API_KEY
    if (!apiKey) {
      return res.status(401).json({ error: 'Gemini API key required' })
    }
  } else {
    apiKey = (req.headers['x-api-key'] as string) || process.env.CLAUDE_API_KEY
    if (!apiKey || !apiKey.startsWith('sk-ant-')) {
      return res.status(401).json({ error: 'Valid Anthropic API key required (sk-ant-...)' })
    }
  }

  const isServerKey = !req.headers['x-api-key'] && !req.headers['x-gemini-api-key']
  const rateLimitKey = isServerKey
    ? `srv-${(req.headers['x-forwarded-for'] as string || 'unknown').split(',')[0].trim()}`
    : apiKey.slice(-8)
  const { allowed, remaining, resetAt } = checkRateLimit(rateLimitKey, 30, 60_000)
  res.setHeader('X-RateLimit-Remaining', String(remaining))
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
  if (!allowed) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  if (!type) {
    return res.status(400).json({ error: 'Request type is required' })
  }

  try {
    const resolvedModel = provider === 'gemini' ? resolveGeminiModel(model) : resolveClaudeModel(model)
    let chatModel: BaseChatModel
    if (provider === 'gemini') {
      chatModel = new ChatGoogleGenerativeAI({
        model: resolvedModel,
        maxOutputTokens: getMaxTokens(type),
        apiKey,
      })
    } else {
      chatModel = new ChatAnthropic({
        model: resolvedModel,
        maxTokens: getMaxTokens(type),
        anthropicApiKey: apiKey,
      })
    }

    const systemPrompt = buildSystemPrompt(type, context)

    // Build user message content (supports vision/image)
    const userText = buildUserMessage(type, context)
    let humanMessage: HumanMessage

    if (image && ['analyze-image', 'analyze-photo-location', 'receipt-food', 'receipt-general'].includes(type)) {
      const validMediaTypes = ['image/jpeg', 'image/webp', 'image/png', 'image/gif'] as const
      const mediaType = (imageFormat && validMediaTypes.includes(imageFormat))
        ? imageFormat as typeof validMediaTypes[number]
        : 'image/jpeg'

      humanMessage = new HumanMessage({
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mediaType};base64,${image}` },
          },
          { type: 'text', text: userText },
        ],
      })
    } else {
      humanMessage = new HumanMessage(userText)
    }

    const messages = [new SystemMessage(systemPrompt), humanMessage]
    const schema = STRUCTURED_SCHEMAS[type]
    const isStreamingTextType = STREAMING_TEXT_TYPES.includes(type) || !schema

    if (stream && isStreamingTextType) {
      // === Streaming text mode (guide, memo, travel-diary, test, unknown) ===
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      let clientConnected = true
      res.on('close', () => { clientConnected = false })

      const streamResponse = await chatModel.stream(messages)

      for await (const chunk of streamResponse) {
        if (!clientConnected) break
        const text = typeof chunk.content === 'string'
          ? chunk.content
          : Array.isArray(chunk.content)
            ? chunk.content.filter((c: { type: string }) => c.type === 'text').map((c: unknown) => (c as { text: string }).text).join('')
            : ''
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`)
        }
      }

      if (clientConnected) {
        res.write('data: [DONE]\n\n')
      }
      res.end()
    } else if (schema) {
      // === Structured output mode (itinerary, receipt, image analysis, etc.) ===
      // Use withStructuredOutput for validated JSON responses
      try {
        const structuredModel = chatModel.withStructuredOutput(schema)
        const result = await structuredModel.invoke(messages)

        res.status(200).json({
          content: JSON.stringify(result),
          model: resolvedModel,
          truncated: false,
        })
      } catch (structuredError) {
        // Fallback: if structured output fails, try plain invoke + manual parse
        console.warn('[LangChain Generate] Structured output failed, falling back to plain invoke:', structuredError)
        const response = await chatModel.invoke(messages)
        const rawText = typeof response.content === 'string'
          ? response.content
          : Array.isArray(response.content)
            ? response.content.filter((c: { type: string }) => c.type === 'text').map((c: unknown) => (c as { text: string }).text).join('')
            : ''

        // Try to extract valid JSON from raw text (AI often wraps JSON in markdown)
        let parsedContent = rawText
        try {
          let cleaned = rawText.trim()
          if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '')
          }
          const parsed = JSON.parse(cleaned)
          parsedContent = JSON.stringify(parsed)
        } catch {
          // If parsing fails, wrap raw text to prevent client JSON.parse crash
          parsedContent = JSON.stringify({ rawText, fallback: true })
        }

        res.status(200).json({
          content: parsedContent,
          model: resolvedModel,
          truncated: false,
        })
      }
    } else {
      // === Non-streaming text (fallback) ===
      const response = await chatModel.invoke(messages)
      const text = typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? response.content.filter((c: { type: string }) => c.type === 'text').map((c: unknown) => (c as { text: string }).text).join('')
          : ''

      res.status(200).json({
        content: text,
        model: resolvedModel,
        truncated: false,
      })
    }
  } catch (err: unknown) {
    console.error('[LangChain Generate] Error:', err)
    const errMsg = err instanceof Error ? err.message : 'LangChain generate error'
    const status = errMsg.includes('authentication') || errMsg.includes('api_key') ? 401 : 500

    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
    } else {
      res.status(status).json({ error: errMsg })
    }
  }
}
