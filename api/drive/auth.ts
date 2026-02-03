// ============================================
// Google Drive OAuth - Authorization URL
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://travel1.moonwave.kr/api/drive/callback'

// Google Drive 파일 접근 스코프
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',    // 앱이 생성한 파일만 접근
  'https://www.googleapis.com/auth/drive.appdata', // 앱 전용 숨김 폴더 접근
]

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'Google Client ID not configured' })
  }

  // state 파라미터로 원래 페이지 URL 전달 (CSRF 방지 + 리다이렉트용)
  const state = (req.query.state as string) || '/'

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPES.join(' '))
  authUrl.searchParams.set('access_type', 'offline') // refresh_token 받기
  authUrl.searchParams.set('prompt', 'consent') // 항상 동의 화면 표시
  authUrl.searchParams.set('state', state)

  res.redirect(302, authUrl.toString())
}
