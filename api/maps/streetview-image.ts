// ============================================
// Street View Image Proxy
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  const { lat, lng, size = '400x200', heading = '0' } = req.query

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng are required' })
  }

  const latNum = parseFloat(String(lat))
  const lngNum = parseFloat(String(lng))

  if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    return res.status(400).json({ error: 'Invalid coordinates' })
  }

  try {
    const imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${latNum},${lngNum}&heading=${heading}&key=${apiKey}`
    const response = await fetch(imageUrl)

    if (!response.ok) {
      return res.status(502).json({ error: 'Street View image fetch failed' })
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const buffer = await response.arrayBuffer()

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=604800')
    res.status(200).send(Buffer.from(buffer))
  } catch (err) {
    console.error('[StreetView Image] Error:', err)
    res.status(500).json({ error: 'Street View image proxy error' })
  }
}
