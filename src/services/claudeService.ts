// ============================================
// Claude AI Client Service
// SSE streaming + structured response support
// ============================================

import type { AIGenerateRequest, ClaudeModel, Plan, Trip, GeneratedItinerary } from '@/types'

const API_URL = '/api/claude/generate'

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
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ ...request, model, stream: true }),
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
    onError(err instanceof Error ? err : new Error(String(err)))
  }
}

// ============================================
// Non-Streaming Structured Call
// ============================================

export async function generateStructured<T = string>(
  request: AIGenerateRequest,
  apiKey: string,
  model: ClaudeModel,
): Promise<T> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ ...request, model, stream: false }),
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errData.error || `HTTP ${response.status}`)
  }

  const data = await response.json()
  const content = data.content as string

  // Try parsing as JSON for structured types
  try {
    return JSON.parse(content) as T
  } catch {
    return content as T
  }
}

// ============================================
// Connection Test
// ============================================

export async function testConnection(apiKey: string, model: ClaudeModel): Promise<boolean> {
  const result = await generateStructured<string>(
    { type: 'test', context: {} },
    apiKey,
    model,
  )
  return typeof result === 'string' && result.length > 0
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

export function buildImageAnalysisContext(base64Image: string): AIGenerateRequest {
  return {
    type: 'analyze-image',
    context: {},
    image: base64Image,
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
