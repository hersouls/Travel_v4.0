// ============================================
// Google Drive - Resumable Upload URL 생성
// 큰 파일 업로드를 위해 클라이언트에 업로드 URL 제공
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

// Travel 백업 전용 폴더 이름
const BACKUP_FOLDER_NAME = 'Moonwave Travel Backups'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization required' })
  }

  const accessToken = authHeader.slice(7)
  const { fileName, mimeType = 'application/json', fileSize } = req.body

  if (!fileName) {
    return res.status(400).json({ error: 'fileName is required' })
  }

  try {
    // 1. 백업 폴더 찾기 또는 생성
    const folderId = await getOrCreateBackupFolder(accessToken)

    // 2. Resumable Upload 세션 시작
    const metadata = {
      name: fileName,
      mimeType,
      parents: [folderId],
    }

    const initiateResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType,
          ...(fileSize && { 'X-Upload-Content-Length': String(fileSize) }),
        },
        body: JSON.stringify(metadata),
      }
    )

    if (!initiateResponse.ok) {
      const errorData = await initiateResponse.text()
      console.error('Upload initiate failed:', errorData)
      return res.status(initiateResponse.status).json({
        error: 'Failed to initiate upload',
        details: errorData
      })
    }

    // Google이 반환한 업로드 URL
    const uploadUrl = initiateResponse.headers.get('location')

    if (!uploadUrl) {
      return res.status(500).json({ error: 'No upload URL returned' })
    }

    res.status(200).json({
      uploadUrl,
      folderId,
      message: 'Upload URL created. Client can now upload directly.',
    })
  } catch (err) {
    console.error('Upload URL creation error:', err)
    res.status(500).json({ error: 'Server error' })
  }
}

async function getOrCreateBackupFolder(accessToken: string): Promise<string> {
  // 기존 폴더 검색 (쿼리 URL 인코딩 필수)
  const query = `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (searchResponse.ok) {
    const data = await searchResponse.json()
    if (data.files && data.files.length > 0) {
      return data.files[0].id
    }
  }

  // 폴더가 없으면 생성
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })

  if (!createResponse.ok) {
    throw new Error('Failed to create backup folder')
  }

  const folder = await createResponse.json()
  return folder.id
}
