// ============================================
// Google Places Photos API Proxy
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

interface PhotoResult {
  url: string
  widthPx: number
  heightPx: number
  attribution: string
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
    console.error('[Places Photos] GOOGLE_PLACES_API_KEY not configured')
    return res.status(500).json({ error: 'API key not configured' })
  }

  const { placeId, maxCount = '5' } = req.query

  if (!placeId || typeof placeId !== 'string') {
    return res.status(400).json({ error: 'placeId parameter is required' })
  }

  const limit = Math.min(Math.max(parseInt(String(maxCount), 10) || 5, 1), 10)

  try {
    // Fetch place with photos field mask
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'photos',
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Places Photos] API error:', response.status, errorText)
      return res.status(502).json({ error: 'Places API request failed' })
    }

    const data = await response.json()

    if (!data.photos || data.photos.length === 0) {
      res.setHeader('Cache-Control', 'public, max-age=86400')
      return res.status(200).json({ photos: [] })
    }

    // Limit to maxCount photos and construct media URLs
    const photos: PhotoResult[] = data.photos
      .slice(0, limit)
      .map((photo: {
        name: string
        widthPx?: number
        heightPx?: number
        authorAttributions?: Array<{ displayName?: string }>
      }) => ({
        url: `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=600&key=${apiKey}`,
        widthPx: photo.widthPx || 0,
        heightPx: photo.heightPx || 0,
        attribution: photo.authorAttributions?.[0]?.displayName || '',
      }))

    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.status(200).json({ photos })
  } catch (err) {
    console.error('[Places Photos] Error:', err)
    res.status(500).json({ error: 'Places photos proxy error' })
  }
}
