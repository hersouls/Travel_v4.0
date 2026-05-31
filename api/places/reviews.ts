// ============================================
// Google Places Reviews API Proxy
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

import { enforceRateLimit } from '../_lib/rateLimit'

interface ReviewResult {
  author: string
  rating: number
  text: string
  relativeTime: string
  publishTime: string
}

interface ReviewsResponse {
  rating: number
  reviewCount: number
  reviews: ReviewResult[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  const ALLOWED_ORIGINS = ['https://travel1.moonwave.kr','https://moonwave-travel.vercel.app','http://localhost:5173','http://localhost:4173']
  const origin = req.headers.origin || ''
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0])
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!enforceRateLimit(req, res, 'places-reviews', 30)) return

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    console.error('[Places Reviews] GOOGLE_PLACES_API_KEY not configured')
    return res.status(500).json({ error: 'API key not configured' })
  }

  const { placeId, language = 'ko' } = req.query

  if (!placeId || typeof placeId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(placeId)) {
    return res.status(400).json({ error: 'valid placeId parameter is required' })
  }
  // 언어 코드도 화이트리스트하여 URL 경로/쿼리 주입을 차단
  const lang = typeof language === 'string' && /^[a-zA-Z-]{2,10}$/.test(language) ? language : 'ko'

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=${encodeURIComponent(lang)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'rating,userRatingCount,reviews',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Places Reviews] API error:', response.status, errorText)
      return res.status(502).json({ error: 'Places API request failed' })
    }

    const data = await response.json()

    // Transform reviews
    const reviews: ReviewResult[] = (data.reviews || [])
      .slice(0, 5)
      .map((review: {
        authorAttribution?: { displayName?: string }
        rating?: number
        text?: { text?: string }
        relativePublishTimeDescription?: string
        publishTime?: string
      }) => ({
        author: review.authorAttribution?.displayName || '',
        rating: review.rating || 0,
        text: review.text?.text || '',
        relativeTime: review.relativePublishTimeDescription || '',
        publishTime: review.publishTime || '',
      }))

    const result: ReviewsResponse = {
      rating: data.rating || 0,
      reviewCount: data.userRatingCount || 0,
      reviews,
    }

    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.status(200).json(result)
  } catch (err) {
    console.error('[Places Reviews] Error:', err)
    res.status(500).json({ error: 'Places reviews proxy error' })
  }
}
