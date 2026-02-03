// ============================================
// Google Places Details API Proxy
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

interface PlaceDetails {
  name: string
  address: string
  latitude: number
  longitude: number
  website?: string
  phone?: string
  rating?: number
  reviewCount?: number
  category?: string
  openingHours?: string[]
  priceLevel?: number
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
    console.error('[Places Details] GOOGLE_PLACES_API_KEY not configured')
    return res.status(500).json({ error: 'API key not configured' })
  }

  const { placeId, language = 'ko' } = req.query

  if (!placeId || typeof placeId !== 'string') {
    return res.status(400).json({ error: 'placeId parameter is required' })
  }

  try {
    // Google Places Details (New) API
    const fields = [
      'displayName',
      'formattedAddress',
      'location',
      'websiteUri',
      'internationalPhoneNumber',
      'rating',
      'userRatingCount',
      'primaryType',
      'regularOpeningHours',
      'priceLevel',
    ].join(',')

    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?languageCode=${language}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fields,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Places Details] API error:', response.status, errorText)
      return res.status(502).json({ error: 'Places API request failed' })
    }

    const data = await response.json()

    // Transform to PlaceDetails format
    const details: PlaceDetails = {
      name: data.displayName?.text || '',
      address: data.formattedAddress || '',
      latitude: data.location?.latitude || 0,
      longitude: data.location?.longitude || 0,
      website: data.websiteUri,
      phone: data.internationalPhoneNumber,
      rating: data.rating,
      reviewCount: data.userRatingCount,
      category: data.primaryType,
      openingHours: data.regularOpeningHours?.weekdayDescriptions,
      priceLevel: data.priceLevel,
    }

    res.setHeader('Cache-Control', 'public, max-age=3600') // 1 hour cache
    res.status(200).json(details)
  } catch (err) {
    console.error('[Places Details] Error:', err)
    res.status(500).json({ error: 'Places details proxy error' })
  }
}
