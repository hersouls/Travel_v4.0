// ============================================
// TTS Proxy - Google Translate TTS CORS Proxy
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { text, lang = 'ko' } = req.query

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text parameter is required' })
  }

  // 텍스트 길이 제한 (Google TTS는 약 200자 제한)
  if (text.length > 200) {
    return res.status(400).json({ error: 'Text too long. Max 200 characters.' })
  }

  const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(text)}`

  try {
    const response = await fetch(googleTtsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://translate.google.com/',
      },
    })

    if (!response.ok) {
      console.error('[TTS Proxy] Google TTS failed:', response.status, response.statusText)
      return res.status(502).json({ error: 'TTS fetch failed' })
    }

    const audioBuffer = await response.arrayBuffer()

    // 오디오 데이터 반환
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'public, max-age=86400') // 24시간 캐시
    res.status(200).send(Buffer.from(audioBuffer))
  } catch (err) {
    console.error('[TTS Proxy] Error:', err)
    res.status(500).json({ error: 'TTS proxy error' })
  }
}
