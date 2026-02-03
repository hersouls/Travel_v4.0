// ============================================
// Google Places Autocomplete API Proxy
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

interface AutocompleteRequest {
  input: string
  language?: string
}

interface PlacePrediction {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
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
    console.error('[Places Autocomplete] GOOGLE_PLACES_API_KEY not configured')
    return res.status(500).json({ error: 'API key not configured' })
  }

  const { input, language = 'ko' } = req.body as AutocompleteRequest

  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'input parameter is required' })
  }

  if (input.length < 2) {
    return res.status(400).json({ error: 'input must be at least 2 characters' })
  }

  try {
    // Google Places Autocomplete (New) API
    const response = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify({
          input,
          languageCode: language,
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Places Autocomplete] API error:', response.status, errorText)
      return res.status(502).json({ error: 'Places API request failed' })
    }

    const data = await response.json()

    // Transform response to simpler format
    const predictions: PlacePrediction[] = (data.suggestions || [])
      .filter((s: { placePrediction?: unknown }) => s.placePrediction)
      .map((s: { placePrediction: {
        placeId: string
        text: { text: string }
        structuredFormat?: {
          mainText?: { text: string }
          secondaryText?: { text: string }
        }
      }}) => ({
        placeId: s.placePrediction.placeId,
        description: s.placePrediction.text?.text || '',
        mainText: s.placePrediction.structuredFormat?.mainText?.text || '',
        secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text || '',
      }))

    res.setHeader('Cache-Control', 'public, max-age=300') // 5 minute cache
    res.status(200).json({ predictions })
  } catch (err) {
    console.error('[Places Autocomplete] Error:', err)
    res.status(500).json({ error: 'Places autocomplete proxy error' })
  }
}
