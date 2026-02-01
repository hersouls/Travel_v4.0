// ============================================
// Google Drive - 파일 다운로드 (직접 전달)
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' })
  }

  const accessToken = authHeader.slice(7)
  const { fileId } = req.query

  if (!fileId || typeof fileId !== 'string') {
    return res.status(400).json({ error: 'fileId is required' })
  }

  try {
    // Google Drive에서 파일 다운로드
    const downloadResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text()
      console.error('Download failed:', errorText)
      return res.status(downloadResponse.status).json({ error: 'Download failed' })
    }

    // 파일 내용 반환
    const content = await downloadResponse.text()

    res.setHeader('Content-Type', 'application/json')
    res.status(200).send(content)
  } catch (err) {
    console.error('Download error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
