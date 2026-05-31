// ============================================
// Street View Image Proxy
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

import { enforceRateLimit } from '../_lib/rateLimit'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ALLOWED_ORIGINS = ['https://travel1.moonwave.kr','https://moonwave-travel.vercel.app','http://localhost:5173','http://localhost:4173']
  const origin = req.headers.origin || ''
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0])

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!enforceRateLimit(req, res, 'maps-streetview-image', 60)) return

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

  // size/heading 검증·정규화 (배열 파라미터 직렬화 및 '&' 주입 방지)
  const sizeStr = typeof size === 'string' && /^\d{1,4}x\d{1,4}$/.test(size) ? size : '400x200'
  const headingNum = typeof heading === 'string' ? parseFloat(heading) : NaN
  const headingStr = !isNaN(headingNum) ? String(((headingNum % 360) + 360) % 360) : '0'

  try {
    const imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=${encodeURIComponent(sizeStr)}&location=${latNum},${lngNum}&heading=${encodeURIComponent(headingStr)}&key=${apiKey}`
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
