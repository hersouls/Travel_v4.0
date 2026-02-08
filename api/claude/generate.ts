// ============================================
// Anthropic Claude AI Generate API Proxy
// SSE streaming + structured JSON support
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

export const config = { maxDuration: 60 }

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
- 한국어로 작성`

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

    case 'test':
      return '연결 테스트'

    default:
      return context.prompt as string || '안녕하세요'
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // API key: user-provided header or server env fallback
  const apiKey = (req.headers['x-api-key'] as string) || process.env.CLAUDE_API_KEY
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return res.status(401).json({ error: 'Valid Anthropic API key required (sk-ant-...)' })
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

    if (image && type === 'analyze-image') {
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
        max_tokens: type === 'itinerary' ? 8192 : 4096,
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
        max_tokens: type === 'itinerary' ? 8192 : 4096,
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
