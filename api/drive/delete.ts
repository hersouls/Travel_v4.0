// ============================================
// Google Drive - 파일 삭제
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'DELETE') {
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
    const deleteResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!deleteResponse.ok && deleteResponse.status !== 204) {
      const errorText = await deleteResponse.text()
      console.error('Delete failed:', errorText)
      return res.status(deleteResponse.status).json({ error: 'Delete failed' })
    }

    res.status(200).json({ success: true })
  } catch (err) {
    console.error('Delete error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
