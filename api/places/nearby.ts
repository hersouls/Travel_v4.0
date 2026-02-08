// ============================================
// Google Places Nearby Search API Proxy
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

interface NearbyRequestBody {
  latitude: number
  longitude: number
  radiusMeters?: number
  types?: string[]
  language?: string
  maxResults?: number
}

interface NearbyPlace {
  placeId: string
  name: string
  address: string
  latitude: number
  longitude: number
  rating?: number
  reviewCount?: number
  category?: string
  photoUrl?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    console.error('[Places Nearby] GOOGLE_PLACES_API_KEY not configured')
    return res.status(500).json({ error: 'API key not configured' })
  }

  const {
    latitude,
    longitude,
    radiusMeters = 1000,
    types,
    language = 'ko',
    maxResults = 10,
  } = req.body as NearbyRequestBody

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'Valid latitude and longitude are required' })
  }

  try {
    const fieldMask = [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.location',
      'places.rating',
      'places.userRatingCount',
      'places.primaryType',
      'places.photos',
    ].join(',')

    const requestBody: Record<string, unknown> = {
      locationRestriction: {
        circle: {
          center: { latitude, longitude },
          radius: radiusMeters,
        },
      },
      languageCode: language,
      maxResultCount: maxResults,
    }

    if (types && types.length > 0) {
      requestBody.includedTypes = types
    }

    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Places Nearby] API error:', response.status, errorText)
      return res.status(502).json({ error: 'Places API request failed' })
    }

    const data = await response.json()

    // Transform response
    const places: NearbyPlace[] = (data.places || []).map((place: {
      id: string
      displayName?: { text: string }
      formattedAddress?: string
      location?: { latitude: number; longitude: number }
      rating?: number
      userRatingCount?: number
      primaryType?: string
      photos?: Array<{ name: string }>
    }) => {
      const result: NearbyPlace = {
        placeId: place.id,
        name: place.displayName?.text || '',
        address: place.formattedAddress || '',
        latitude: place.location?.latitude || 0,
        longitude: place.location?.longitude || 0,
      }

      if (place.rating !== undefined) result.rating = place.rating
      if (place.userRatingCount !== undefined) result.reviewCount = place.userRatingCount
      if (place.primaryType) result.category = place.primaryType
      if (place.photos && place.photos.length > 0) {
        result.photoUrl = `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxWidthPx=600&key=${apiKey}`
      }

      return result
    })

    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.status(200).json({ places })
  } catch (err) {
    console.error('[Places Nearby] Error:', err)
    res.status(500).json({ error: 'Places nearby proxy error' })
  }
}
