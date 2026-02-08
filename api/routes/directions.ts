// ============================================
// Google Routes API Proxy - Directions
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

interface DirectionsRequestBody {
  origin: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  travelMode: string
  language?: string
}

interface DirectionsResponse {
  distanceMeters: number
  duration: string
  durationText: string
  distanceText: string
  encodedPolyline: string
  steps: Array<{
    instruction: string
    distance: string
    duration: string
  }>
  fallback?: boolean
}

const VALID_TRAVEL_MODES = ['DRIVE', 'WALK', 'TRANSIT', 'BICYCLE'] as const

// Average speeds (km/h) for Haversine fallback (e.g. South Korea where Routes API has no coverage)
const FALLBACK_SPEEDS: Record<string, number> = {
  DRIVE: 40,
  WALK: 5,
  TRANSIT: 30,
  BICYCLE: 15,
}

function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function buildFallbackResult(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: string,
): DirectionsResponse {
  const straightLine = haversineDistance(origin.lat, origin.lng, destination.lat, destination.lng)
  // Road distance is roughly 1.3x straight-line distance
  const distanceMeters = Math.round(straightLine * 1.3)
  const speedKmH = FALLBACK_SPEEDS[mode] || 40
  const durationSeconds = Math.round((distanceMeters / 1000 / speedKmH) * 3600)
  const duration = `${durationSeconds}s`

  return {
    distanceMeters,
    duration,
    durationText: formatDuration(duration),
    distanceText: formatDistance(distanceMeters),
    encodedPolyline: '',
    steps: [],
    fallback: true,
  }
}

function formatDuration(durationStr: string): string {
  // "1200s" -> seconds
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
    console.error('[Directions] GOOGLE_PLACES_API_KEY not configured')
    return res.status(500).json({ error: 'API key not configured' })
  }

  const { origin, destination, travelMode, language = 'ko' } = req.body as DirectionsRequestBody

  if (!origin || typeof origin.lat !== 'number' || typeof origin.lng !== 'number') {
    return res.status(400).json({ error: 'Valid origin with lat and lng is required' })
  }

  if (!destination || typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
    return res.status(400).json({ error: 'Valid destination with lat and lng is required' })
  }

  const mode = VALID_TRAVEL_MODES.includes(travelMode as typeof VALID_TRAVEL_MODES[number])
    ? travelMode
    : 'DRIVE'

  try {
    const fieldMask = [
      'routes.distanceMeters',
      'routes.duration',
      'routes.polyline.encodedPolyline',
      'routes.legs.steps.navigationInstruction',
      'routes.legs.steps.localizedValues',
    ].join(',')

    const response = await fetch(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify({
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
          languageCode: language,
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Directions] API error:', response.status, errorText)
      return res.status(502).json({ error: 'Routes API request failed' })
    }

    const data = await response.json()

    if (!data.routes || data.routes.length === 0) {
      // Fallback for regions without Routes API coverage (e.g. South Korea)
      const fallback = buildFallbackResult(origin, destination, mode)
      res.setHeader('Cache-Control', 'public, max-age=86400')
      return res.status(200).json(fallback)
    }

    const route = data.routes[0]
    const distanceMeters = route.distanceMeters || 0
    const duration = route.duration || '0s'
    const encodedPolyline = route.polyline?.encodedPolyline || ''

    // Extract steps from legs
    const steps: DirectionsResponse['steps'] = []
    if (route.legs) {
      for (const leg of route.legs) {
        if (leg.steps) {
          for (const step of leg.steps) {
            steps.push({
              instruction: step.navigationInstruction?.instructions || '',
              distance: step.localizedValues?.distance?.text || '',
              duration: step.localizedValues?.duration?.text || '',
            })
          }
        }
      }
    }

    const result: DirectionsResponse = {
      distanceMeters,
      duration,
      durationText: formatDuration(duration),
      distanceText: formatDistance(distanceMeters),
      encodedPolyline,
      steps,
    }

    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.status(200).json(result)
  } catch (err) {
    console.error('[Directions] Error:', err)
    res.status(500).json({ error: 'Directions proxy error' })
  }
}
