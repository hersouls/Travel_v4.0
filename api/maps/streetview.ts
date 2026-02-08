// ============================================
// Google Street View Availability & Image URL API
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

interface StreetViewResponse {
  imageUrl: string | null
  available: boolean
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
    console.error('[StreetView] GOOGLE_PLACES_API_KEY not configured')
    return res.status(500).json({ error: 'API key not configured' })
  }

  const { lat, lng, size = '400x200', heading = '0' } = req.query

  if (!lat || !lng || typeof lat !== 'string' || typeof lng !== 'string') {
    return res.status(400).json({ error: 'lat and lng query parameters are required' })
  }

  const latNum = parseFloat(lat)
  const lngNum = parseFloat(lng)

  if (isNaN(latNum) || isNaN(lngNum)) {
    return res.status(400).json({ error: 'lat and lng must be valid numbers' })
  }

  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    return res.status(400).json({ error: 'lat must be between -90 and 90, lng between -180 and 180' })
  }

  const sizeStr = typeof size === 'string' ? size : '400x200'
  const headingStr = typeof heading === 'string' ? heading : '0'

  try {
    // Check metadata first to determine availability
    const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${latNum},${lngNum}&key=${apiKey}`
    const metadataResponse = await fetch(metadataUrl)

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text()
      console.error('[StreetView] Metadata API error:', metadataResponse.status, errorText)
      return res.status(502).json({ error: 'Street View metadata request failed' })
    }

    const metadata = await metadataResponse.json()

    if (metadata.status !== 'OK') {
      const result: StreetViewResponse = {
        imageUrl: null,
        available: false,
      }
      res.setHeader('Cache-Control', 'public, max-age=604800')
      return res.status(200).json(result)
    }

    // Street View is available, construct the image URL
    const imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=${sizeStr}&location=${latNum},${lngNum}&heading=${headingStr}&key=${apiKey}`

    const result: StreetViewResponse = {
      imageUrl,
      available: true,
    }

    res.setHeader('Cache-Control', 'public, max-age=604800')
    res.status(200).json(result)
  } catch (err) {
    console.error('[StreetView] Error:', err)
    res.status(500).json({ error: 'Street View proxy error' })
  }
}
