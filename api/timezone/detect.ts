// ============================================
// Google Time Zone API Proxy
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

interface TimezoneResponse {
  timeZoneId: string
  timeZoneName: string
  rawOffset: number
  dstOffset: number
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
    console.error('[Timezone Detect] GOOGLE_PLACES_API_KEY not configured')
    return res.status(500).json({ error: 'API key not configured' })
  }

  const { lat, lng, timestamp } = req.query

  if (!lat || !lng || typeof lat !== 'string' || typeof lng !== 'string') {
    return res.status(400).json({ error: 'lat and lng parameters are required' })
  }

  const latNum = parseFloat(lat)
  const lngNum = parseFloat(lng)

  if (isNaN(latNum) || isNaN(lngNum)) {
    return res.status(400).json({ error: 'lat and lng must be valid numbers' })
  }

  const ts = timestamp && typeof timestamp === 'string'
    ? parseInt(timestamp, 10)
    : Math.floor(Date.now() / 1000)

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/timezone/json?location=${latNum},${lngNum}&timestamp=${ts}&key=${apiKey}`,
      {
        method: 'GET',
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Timezone Detect] API error:', response.status, errorText)
      return res.status(502).json({ error: 'Timezone API request failed' })
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      console.error('[Timezone Detect] API status:', data.status, data.errorMessage)
      return res.status(502).json({ error: `Timezone API error: ${data.status}` })
    }

    const result: TimezoneResponse = {
      timeZoneId: data.timeZoneId,
      timeZoneName: data.timeZoneName,
      rawOffset: data.rawOffset,
      dstOffset: data.dstOffset,
    }

    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.status(200).json(result)
  } catch (err) {
    console.error('[Timezone Detect] Error:', err)
    res.status(500).json({ error: 'Timezone detect proxy error' })
  }
}
