// ============================================
// Google Routes API Proxy - Route Optimization
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

interface Waypoint {
  lat: number
  lng: number
  planId: number
}

interface OptimizeRequestBody {
  waypoints: Waypoint[]
  travelMode?: string
  language?: string
}

interface LegResult {
  distanceMeters: number
  duration: string
  durationText: string
  distanceText: string
  encodedPolyline: string
}

const VALID_TRAVEL_MODES = ['DRIVE', 'WALK', 'TRANSIT', 'BICYCLE'] as const

function formatDuration(durationStr: string): string {
  const match = durationStr.match(/^(\d+)s$/)
  if (!match) return durationStr

  let totalSeconds = parseInt(match[1], 10)

  const hours = Math.floor(totalSeconds / 3600)
  totalSeconds %= 3600
  const minutes = Math.floor(totalSeconds / 60)

  if (hours > 0 && minutes > 0) {
    return `${hours}시간 ${minutes}분`
  }
  if (hours > 0) {
    return `${hours}시간`
  }
  if (minutes > 0) {
    return `${minutes}분`
  }
  return '1분 미만'
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000
    return km % 1 === 0 ? `${km} km` : `${km.toFixed(1)} km`
  }
  return `${meters} m`
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
    console.error('[Route Optimize] GOOGLE_PLACES_API_KEY not configured')
    return res.status(500).json({ error: 'API key not configured' })
  }

  const { waypoints, travelMode, language = 'ko' } = req.body as OptimizeRequestBody

  if (!waypoints || !Array.isArray(waypoints) || waypoints.length < 2) {
    return res.status(400).json({ error: 'At least 2 waypoints are required' })
  }

  for (const wp of waypoints) {
    if (typeof wp.lat !== 'number' || typeof wp.lng !== 'number' || typeof wp.planId !== 'number') {
      return res.status(400).json({ error: 'Each waypoint must have lat, lng, and planId as numbers' })
    }
  }

  const mode = VALID_TRAVEL_MODES.includes(travelMode as typeof VALID_TRAVEL_MODES[number])
    ? travelMode
    : 'DRIVE'

  const origin = waypoints[0]
  const destination = waypoints[waypoints.length - 1]
  const intermediates = waypoints.slice(1, -1)

  try {
    const fieldMask = [
      'routes.optimizedIntermediateWaypointIndex',
      'routes.legs.distanceMeters',
      'routes.legs.duration',
      'routes.legs.polyline.encodedPolyline',
    ].join(',')

    const requestBody: Record<string, unknown> = {
      origin: {
        location: {
          latLng: { latitude: origin.lat, longitude: origin.lng },
        },
      },
      destination: {
        location: {
          latLng: { latitude: destination.lat, longitude: destination.lng },
        },
      },
      travelMode: mode,
      optimizeWaypointOrder: true,
      languageCode: language,
    }

    if (intermediates.length > 0) {
      requestBody.intermediates = intermediates.map(wp => ({
        location: {
          latLng: { latitude: wp.lat, longitude: wp.lng },
        },
      }))
    }

    const response = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
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
      console.error('[Route Optimize] API error:', response.status, errorText)
      return res.status(502).json({ error: 'Routes API request failed' })
    }

    const data = await response.json()

    if (!data.routes || data.routes.length === 0) {
      return res.status(404).json({ error: 'No route found for the given waypoints' })
    }

    const route = data.routes[0]

    // Map optimized order back to planId order
    const optimizedIndices: number[] = route.optimizedIntermediateWaypointIndex || []
    const optimizedOrder: number[] = [origin.planId]
    for (const idx of optimizedIndices) {
      optimizedOrder.push(intermediates[idx].planId)
    }
    optimizedOrder.push(destination.planId)

    // Format legs
    const legs: LegResult[] = (route.legs || []).map((leg: {
      distanceMeters?: number
      duration?: string
      polyline?: { encodedPolyline?: string }
    }) => {
      const distanceMeters = leg.distanceMeters || 0
      const duration = leg.duration || '0s'

      return {
        distanceMeters,
        duration,
        durationText: formatDuration(duration),
        distanceText: formatDistance(distanceMeters),
        encodedPolyline: leg.polyline?.encodedPolyline || '',
      }
    })

    res.setHeader('Cache-Control', 'no-cache')
    res.status(200).json({ optimizedOrder, legs })
  } catch (err) {
    console.error('[Route Optimize] Error:', err)
    res.status(500).json({ error: 'Route optimization proxy error' })
  }
}
