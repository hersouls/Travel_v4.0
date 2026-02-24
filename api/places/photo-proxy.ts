// ============================================
// Google Places Photo Proxy
// API 키를 서버 사이드에서 처리하여 클라이언트 노출 방지
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const ALLOWED_ORIGINS = ['https://travel1.moonwave.kr','https://moonwave-travel.vercel.app','http://localhost:5173','http://localhost:4173']
  const origin = req.headers.origin || ''
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0])
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  const { name, maxWidthPx = '600' } = req.query

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name parameter is required' })
  }

  // name 형식 검증 (places/xxx/photos/xxx 패턴만 허용)
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(name)) {
    return res.status(400).json({ error: 'Invalid photo name format' })
  }

  try {
    const photoUrl = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${maxWidthPx}&key=${apiKey}`
    const response = await fetch(photoUrl)

    if (!response.ok) {
      return res.status(502).json({ error: 'Photo fetch failed' })
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const buffer = await response.arrayBuffer()

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.status(200).send(Buffer.from(buffer))
  } catch (err) {
    console.error('[Photo Proxy] Error:', err)
    res.status(500).json({ error: 'Photo proxy error' })
  }
}
