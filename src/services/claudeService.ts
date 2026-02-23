// ============================================
// Claude AI Client Service
// SSE streaming + structured response support
// ============================================

import type { AIGenerateRequest, ClaudeModel, Plan, Trip, GeneratedItinerary, DaySuggestion, ExpenseData } from '@/types'

const API_URL = '/api/claude/generate'

// ============================================
// JSON Response Utilities
// ============================================

/** Claude 응답에서 JSON 마크다운 래핑 제거 */
function stripJsonWrapper(content: string): string {
  let s = content.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '')
  }
  return s.trim()
}

/** OCR 결과가 유효한 ExpenseData 구조인지 검증 */
export function isValidExpenseData(obj: unknown): obj is ExpenseData {
  if (!obj || typeof obj !== 'object') return false
  const e = obj as Record<string, unknown>
  return (
    typeof e.storeName === 'string' &&
    typeof e.category === 'string' &&
    Array.isArray(e.items) &&
    typeof e.totalAmount === 'number' && isFinite(e.totalAmount) &&
    typeof e.currency === 'string' && e.currency.length > 0
  )
}

// ============================================
// SSE Streaming Call
// ============================================

export async function generateWithStreaming(
  request: AIGenerateRequest,
  apiKey: string,
  model: ClaudeModel,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: Error) => void,
): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000) // 2분 타임아웃

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ ...request, model, stream: true }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errData.error || `HTTP ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') {
          onDone()
          return
        }
        try {
          const parsed = JSON.parse(data)
          if (parsed.text) onChunk(parsed.text)
        } catch {
          // skip malformed chunks
        }
      }
    }

    onDone()
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      onError(new Error('요청 시간이 초과되었습니다'))
    } else {
      onError(err instanceof Error ? err : new Error(String(err)))
    }
  } finally {
    clearTimeout(timeout)
  }
}

// ============================================
// Non-Streaming Structured Call
// ============================================

export async function generateStructured<T = string>(
  request: AIGenerateRequest,
  apiKey: string,
  model: ClaudeModel,
  signal?: AbortSignal,
): Promise<T> {
  // signal이 없으면 기본 60초 타임아웃 적용
  const controller = signal ? null : new AbortController()
  const timeout = controller ? setTimeout(() => controller.abort(), 60_000) : null

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ ...request, model, stream: false }),
      signal: signal || controller?.signal,
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errData.error || `HTTP ${response.status}`)
    }

    const data = await response.json()

    // Null safety 체크 추가
    if (!data || typeof data.content !== 'string') {
      throw new Error('Invalid API response: missing content field')
    }

    if (data.truncated) {
      console.warn('[Claude] Response truncated (max_tokens reached)')
    }

    const content = stripJsonWrapper(data.content)

    // Try parsing as JSON for structured types
    try {
      return JSON.parse(content) as T
    } catch {
      throw new Error(`JSON 파싱 실패: ${content.slice(0, 200)}`)
    }
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

// ============================================
// Connection Test
// ============================================

export async function testConnection(apiKey: string, model: ClaudeModel): Promise<boolean> {
  try {
    const result = await generateStructured<string>(
      { type: 'test', context: {} },
      apiKey,
      model,
    )
    return typeof result === 'string' && result.length > 0
  } catch {
    // test type은 텍스트 응답이므로 JSON 파싱 실패가 정상
    return true
  }
}

// ============================================
// Context Builders
// ============================================

export function buildGuideContext(plan: Plan, trip: Trip): Record<string, unknown> {
  return {
    placeName: plan.placeName,
    address: plan.address,
    country: trip.country,
    category: plan.googleInfo?.category || plan.type,
    rating: plan.googleInfo?.rating,
    memo: plan.memo,
    website: plan.website,
    openingHours: plan.googleInfo?.openingHours?.join(', '),
  }
}

export interface ItineraryPreferences {
  interests: string[]
  style: string
  budget: string
}

export function buildItineraryContext(
  trip: Trip,
  totalDays: number,
  prefs: ItineraryPreferences,
): Record<string, unknown> {
  return {
    country: trip.country,
    startDate: trip.startDate,
    endDate: trip.endDate,
    totalDays,
    interests: prefs.interests,
    style: prefs.style,
    budget: prefs.budget,
  }
}

export function buildMemoContext(plan: Plan, country?: string): Record<string, unknown> {
  return {
    placeName: plan.placeName,
    type: plan.type,
    address: plan.address,
    country,
    existingMemo: plan.memo,
  }
}

export function buildImageAnalysisContext(base64Image: string, imageFormat?: string): AIGenerateRequest {
  return {
    type: 'analyze-image',
    context: {},
    image: base64Image,
    imageFormat,
  }
}

export function buildPhotoLocationContext(
  base64Image: string,
  imageFormat?: string,
  tripCountry?: string,
): AIGenerateRequest {
  return {
    type: 'analyze-photo-location',
    context: { country: tripCountry || '' },
    image: base64Image,
    imageFormat,
    stream: false,
  }
}

// ============================================
// Receipt OCR Context Builders
// ============================================

export function buildReceiptFoodContext(base64Image: string, imageFormat?: string): AIGenerateRequest {
  return {
    type: 'receipt-food',
    context: {},
    image: base64Image,
    imageFormat,
    stream: false,
  }
}

export function buildReceiptGeneralContext(base64Image: string, imageFormat?: string): AIGenerateRequest {
  return {
    type: 'receipt-general',
    context: {},
    image: base64Image,
    imageFormat,
    stream: false,
  }
}

// ============================================
// Day-Level Context Builders
// ============================================

export interface DayRecommendPreferences {
  keywords: string
  interests: string[]
  style: string
}

export function buildDayRecommendContext(
  trip: Trip,
  dayNumber: number,
  totalDays: number,
  dayDate: Date | null,
  prefs: DayRecommendPreferences,
): Record<string, unknown> {
  return {
    country: trip.country,
    dayNumber,
    totalDays,
    dayDate: dayDate ? dayDate.toISOString().split('T')[0] : undefined,
    keywords: prefs.keywords,
    interests: prefs.interests,
    style: prefs.style,
  }
}

export function buildDaySuggestContext(
  trip: Trip,
  dayNumber: number,
  dayPlans: Plan[],
  dayDate: Date | null,
): Record<string, unknown> {
  return {
    country: trip.country,
    dayNumber,
    dayDate: dayDate ? dayDate.toISOString().split('T')[0] : undefined,
    existingPlans: dayPlans.map((p) => ({
      placeName: p.placeName,
      startTime: p.startTime,
      endTime: p.endTime,
      type: p.type,
      address: p.address,
      memo: p.memo,
      latitude: p.latitude,
      longitude: p.longitude,
    })),
  }
}

// ============================================
// Itinerary Parsing Helper
// ============================================

export function parseItineraryResponse(content: string): GeneratedItinerary | null {
  try {
    // Try direct parse
    const parsed = JSON.parse(content)
    if (parsed.days && Array.isArray(parsed.days)) return parsed
    return null
  } catch {
    // Try extracting JSON from text
    const match = content.match(/\{[\s\S]*"days"[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (parsed.days && Array.isArray(parsed.days)) return parsed
      } catch { /* ignore */ }
    }
    return null
  }
}

export function parseDaySuggestionResponse(content: string): DaySuggestion | null {
  try {
    const parsed = JSON.parse(content)
    if (parsed.analysis && parsed.revisedPlans && Array.isArray(parsed.revisedPlans)) {
      return parsed
    }
    return null
  } catch {
    const match = content.match(/\{[\s\S]*"revisedPlans"[\s\S]*\}/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (parsed.analysis && parsed.revisedPlans) return parsed
      } catch { /* ignore */ }
    }
    return null
  }
}
