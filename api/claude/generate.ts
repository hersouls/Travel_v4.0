// ============================================
// Anthropic Claude AI Generate API Proxy
// SSE streaming + structured JSON support
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

const MAX_BODY_SIZE = 2 * 1024 * 1024 // 2MB

const MODEL_MAP: Record<string, string> = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-5-20250929',
  opus: 'claude-opus-4-6',
}

function resolveModel(model?: string): string {
  return MODEL_MAP[model || 'sonnet'] || MODEL_MAP.sonnet
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
주어진 여행 정보를 기반으로 최적의 일정을 JSON으로 생성하세요.
반드시 아래 JSON 형식만 출력하세요 (다른 텍스트 없이):
{
  "days": [
    {
      "day": 1,
      "plans": [
        {
          "placeName": "장소명",
          "startTime": "09:00",
          "endTime": "10:30",
          "type": "attraction|restaurant|hotel|transport|other",
          "address": "주소 (알려진 경우)",
          "memo": "간단한 메모"
        }
      ]
    }
  ]
}
- 각 일정은 현실적인 이동 시간 고려
- 식사 시간 포함 (아침/점심/저녁)
- 관심사와 여행 스타일 반영
- 가능하면 위도/경도 포함`

    case 'day-recommend':
      return `당신은 전문 여행 플래너입니다.
주어진 여행 정보와 키워드를 기반으로 특정 하루의 일정을 JSON으로 생성하세요.
반드시 아래 JSON 형식만 출력하세요 (다른 텍스트 없이):
{
  "days": [
    {
      "day": ${context.dayNumber || 1},
      "plans": [
        {
          "placeName": "장소명",
          "startTime": "09:00",
          "endTime": "10:30",
          "type": "attraction|restaurant|hotel|transport|other",
          "address": "주소 (알려진 경우)",
          "memo": "간단한 한줄 메모",
          "latitude": 위도,
          "longitude": 경도
        }
      ]
    }
  ]
}
- 키워드/관심 장소를 중심으로 현실적인 하루 일정 구성
- 아침부터 저녁까지 시간대별로 5~8개 일정
- 식사 시간 포함 (아침/점심/저녁 중 적절한 것)
- 장소 간 이동 시간과 거리를 고려한 현실적인 시간 배분
- 해당 국가/도시의 실제 존재하는 장소만 추천
- 가능하면 위도/경도 포함 (소수점 6자리)`

    case 'day-suggest':
      return `당신은 전문 여행 일정 컨설턴트입니다.
기존 하루 일정을 분석하고 개선안을 JSON으로 제안하세요.
반드시 아래 JSON 형식만 출력하세요 (다른 텍스트 없이):
{
  "analysis": "현재 일정에 대한 전체 분석 (2-3문장)",
  "suggestions": [
    "개선 제안 1",
    "개선 제안 2"
  ],
  "revisedPlans": [
    {
      "placeName": "장소명",
      "startTime": "09:00",
      "endTime": "10:30",
      "type": "attraction|restaurant|hotel|transport|other",
      "address": "주소",
      "memo": "메모",
      "latitude": 위도,
      "longitude": 경도
    }
  ]
}
- 기존 일정의 장단점을 솔직하게 분석
- 동선 최적화, 누락된 식사, 시간 배분 개선을 구체적으로 제안
- 기존 장소를 최대한 유지하면서 순서/시간 조정
- 필요시 빠진 식사나 쉼 시간을 추가
- revisedPlans는 개선된 전체 하루 일정 (기존 장소 + 새 제안 포함)
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
- 순수 텍스트 + 이모지 섹션 헤더만 사용
- 볼드(**) 대신 "라벨: 값" 형식, 테이블 대신 "항목: 금액" 나열`

    case 'analyze-image':
      return `당신은 여행 사진 분석 전문가입니다.
사진을 분석하여 다음 정보를 JSON으로 추출하세요:
{
  "placeName": "식별된 장소 이름 (확실하지 않으면 빈 문자열)",
  "type": "attraction|restaurant|hotel|transport|other",
  "description": "장소에 대한 2-3줄 설명",
  "tips": ["유용한 팁1", "팁2"],
  "estimatedLocation": "추정 위치 (도시/국가)"
}
- 확실하지 않은 정보는 빈 값으로
- 한국어로 작성`

    case 'receipt-food':
      return `당신은 영수증 OCR 전문가입니다.
음식점/카페 영수증 사진을 분석하여 아래 JSON을 정확히 추출하세요:
{
  "storeName": "가게 이름",
  "category": "food",
  "items": [
    { "name": "메뉴명", "quantity": 1, "unitPrice": 10000, "amount": 10000 }
  ],
  "totalAmount": 합계금액,
  "currency": "KRW",
  "receiptDate": "YYYY-MM-DD"
}
- 금액은 순수 숫자만 (쉼표/통화기호 제거)
- currency는 ISO 4217 코드 (KRW, JPY, USD, EUR, THB, VND 등)
- 읽을 수 없는 항목은 빈 문자열이나 0
- 반드시 JSON만 출력 (다른 텍스트 없이)`

    case 'receipt-general':
      return `당신은 영수증 OCR 전문가입니다.
일반 영수증/결제 내역 사진을 분석하여 아래 JSON을 정확히 추출하세요:
{
  "storeName": "가게/서비스 이름",
  "category": "food|transport|accommodation|shopping|attraction|other",
  "items": [
    { "name": "항목명", "quantity": 1, "unitPrice": 10000, "amount": 10000 }
  ],
  "totalAmount": 합계금액,
  "currency": "KRW",
  "receiptDate": "YYYY-MM-DD"
}
- category는 가게 유형에 따라 자동 분류
- 금액은 순수 숫자만
- currency는 ISO 4217 코드
- 반드시 JSON만 출력 (다른 텍스트 없이)`

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
      parts.push('\n위 조건에 맞는 여행 일정을 JSON으로 생성해주세요.')
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
      parts.push('\n위 키워드를 중심으로 이 날의 하루 일정을 JSON으로 생성해주세요.')
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
      parts.push('\n위 일정을 분석하고 개선안을 JSON으로 제안해주세요.')
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

    case 'receipt-food':
      return '이 음식점 영수증에서 가게 이름, 메뉴, 금액을 추출해주세요.'

    case 'receipt-general':
      return '이 영수증/결제 내역에서 정보를 추출해주세요.'

    case 'test':
      return '연결 테스트'

    default:
      return context.prompt as string || '안녕하세요'
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — origin whitelist (allow all in dev via env)
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
    return res.status(413).json({ error: 'Request body too large (max 2MB)' })
  }

  // API key: user-provided header or server env fallback
  const apiKey = (req.headers['x-api-key'] as string) || process.env.CLAUDE_API_KEY
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return res.status(401).json({ error: 'Valid Anthropic API key required (sk-ant-...)' })
  }

  // Rate limiting (30 requests per minute per API key)
  const rateLimitKey = apiKey.slice(-8) // use last 8 chars as key
  const { allowed, remaining, resetAt } = checkRateLimit(rateLimitKey, 30, 60_000)
  res.setHeader('X-RateLimit-Remaining', String(remaining))
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
  if (!allowed) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' })
  }

  const { type, context = {}, image, model, stream = true } = req.body || {}

  if (!type) {
    return res.status(400).json({ error: 'Request type is required' })
  }

  try {
    const client = new Anthropic({ apiKey })
    const systemPrompt = buildSystemPrompt(type, context)
    const resolvedModel = resolveModel(model)

    // Build messages — support Vision (image) for analyze-image
    const userContent: Anthropic.MessageCreateParams['messages'][0]['content'] = []

    if (image && ['analyze-image', 'receipt-food', 'receipt-general'].includes(type)) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: image,
        },
      })
    }

    userContent.push({
      type: 'text',
      text: buildUserMessage(type, context),
    })

    if (stream) {
      // SSE streaming response
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')

      const response = client.messages.stream({
        model: resolvedModel,
        max_tokens: ['itinerary', 'day-recommend', 'day-suggest'].includes(type) ? 8192 : ['receipt-food', 'receipt-general'].includes(type) ? 2048 : 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
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
    } else {
      // Non-streaming structured response
      const response = await client.messages.create({
        model: resolvedModel,
        max_tokens: ['itinerary', 'day-recommend', 'day-suggest'].includes(type) ? 8192 : ['receipt-food', 'receipt-general'].includes(type) ? 2048 : 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      res.status(200).json({
        content: textBlock ? textBlock.text : '',
        model: response.model,
        usage: response.usage,
      })
    }
  } catch (err: unknown) {
    console.error('[Claude] Error:', err)
    const message = err instanceof Error ? err.message : 'Claude API proxy error'
    const status = message.includes('authentication') || message.includes('api_key') ? 401 : 500
    res.status(status).json({ error: message })
  }
}
