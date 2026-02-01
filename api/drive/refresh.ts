// ============================================
// Google Drive OAuth - Token Refresh
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { refresh_token } = req.body

  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token is required' })
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token refresh failed:', errorData)
      return res.status(401).json({ error: 'Token refresh failed' })
    }

    const tokens = await tokenResponse.json()

    res.status(200).json({
      access_token: tokens.access_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
    })
  } catch (err) {
    console.error('Token refresh error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
