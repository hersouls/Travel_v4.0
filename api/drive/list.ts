// ============================================
// Google Drive - 백업 파일 목록 조회
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

const BACKUP_FOLDER_NAME = 'Moonwave Travel Backups'

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

  try {
    // 1. 백업 폴더 찾기 (쿼리 URL 인코딩 필수)
    const folderQuery = `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    const folderResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQuery)}&fields=files(id)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!folderResponse.ok) {
      return res.status(folderResponse.status).json({ error: 'Failed to search folder' })
    }

    const folderData = await folderResponse.json()
    if (!folderData.files || folderData.files.length === 0) {
      // 폴더가 없으면 빈 목록 반환
      return res.status(200).json({ files: [] })
    }

    const folderId = folderData.files[0].id

    // 2. 폴더 내 JSON 파일 목록 조회 (쿼리 URL 인코딩 필수)
    const filesQuery = `'${folderId}' in parents and mimeType='application/json' and trashed=false`
    const filesResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(filesQuery)}&fields=files(id,name,size,createdTime,modifiedTime)&orderBy=modifiedTime desc&pageSize=20`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!filesResponse.ok) {
      return res.status(filesResponse.status).json({ error: 'Failed to list files' })
    }

    const filesData = await filesResponse.json()

    res.status(200).json({
      files: filesData.files || [],
      folderId,
    })
  } catch (err) {
    console.error('List files error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
