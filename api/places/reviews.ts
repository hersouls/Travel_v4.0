// ============================================
// Google Places Reviews API Proxy
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

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
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    console.error('[Places Reviews] GOOGLE_PLACES_API_KEY not configured')
    return res.status(500).json({ error: 'API key not configured' })
  }

  const { placeId, language = 'ko' } = req.query

  if (!placeId || typeof placeId !== 'string') {
    return res.status(400).json({ error: 'placeId parameter is required' })
  }

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?languageCode=${language}`,
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
