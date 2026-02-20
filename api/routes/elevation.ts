// ============================================
// Google Elevation API Proxy
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

interface ElevationPoint {
  lat: number
  lng: number
  elevation: number
  resolution: number
}

interface ElevationRequestBody {
  encodedPolyline?: string
  samples?: number
  locations?: Array<{ lat: number; lng: number }>
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
    console.error('[Elevation] GOOGLE_PLACES_API_KEY not configured')
    return res.status(500).json({ error: 'API key not configured' })
  }

  const { encodedPolyline, samples = 100, locations } = req.body as ElevationRequestBody

  // Support both encodedPolyline (path sampling) and locations (individual points)
  let apiUrl: string

  if (locations && Array.isArray(locations) && locations.length > 0) {
    // Individual point elevation lookup
    const locationStr = locations
      .slice(0, 50) // limit to 50 points
      .map((loc) => `${loc.lat},${loc.lng}`)
      .join('|')
    apiUrl = `https://maps.googleapis.com/maps/api/elevation/json?locations=${encodeURIComponent(locationStr)}&key=${apiKey}`
  } else if (encodedPolyline && typeof encodedPolyline === 'string') {
    // Path sampling elevation lookup
    const sampleCount = Math.min(Math.max(parseInt(String(samples), 10) || 100, 2), 512)
    apiUrl = `https://maps.googleapis.com/maps/api/elevation/json?path=enc:${encodeURIComponent(encodedPolyline)}&samples=${sampleCount}&key=${apiKey}`
  } else {
    return res.status(400).json({ error: 'Either encodedPolyline or locations parameter is required' })
  }

  try {
    const response = await fetch(apiUrl, { method: 'GET' })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Elevation] API error:', response.status, errorText)
      return res.status(502).json({ error: 'Elevation API request failed' })
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      console.error('[Elevation] API status:', data.status, data.error_message)
      return res.status(502).json({ error: `Elevation API error: ${data.status}` })
    }

    const elevations: ElevationPoint[] = (data.results || []).map((result: {
      location: { lat: number; lng: number }
      elevation: number
      resolution: number
    }) => ({
      lat: result.location.lat,
      lng: result.location.lng,
      elevation: result.elevation,
      resolution: result.resolution,
    }))

    res.setHeader('Cache-Control', 'public, max-age=604800')
    res.status(200).json({ elevations, results: data.results })
  } catch (err) {
    console.error('[Elevation] Error:', err)
    res.status(500).json({ error: 'Elevation proxy error' })
  }
}
