// ============================================
// Google Drive OAuth - Callback Handler
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://travel1.moonwave.kr/api/drive/callback'

interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  token_type: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { code, error, state } = req.query

  if (error) {
    return res.redirect(`/settings?drive_error=${encodeURIComponent(error as string)}`)
  }

  if (!code) {
    return res.redirect('/settings?drive_error=no_code')
  }

  try {
    // Authorization code를 Access Token으로 교환
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token exchange failed:', errorData)
      return res.redirect('/settings?drive_error=token_exchange_failed')
    }

    const tokens: TokenResponse = await tokenResponse.json()

    // 토큰을 클라이언트로 전달 (localStorage에 저장하도록)
    // 보안을 위해 postMessage를 사용하는 HTML 페이지 반환
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Google Drive 연동 완료</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #030303;
      color: #edece8;
    }
    .container { text-align: center; padding: 2rem; }
    h1 { color: #2effb4; margin-bottom: 1rem; }
    p { color: #a1a1aa; }
  </style>
</head>
<body>
  <div class="container">
    <h1>연동 완료!</h1>
    <p>잠시 후 설정 페이지로 이동합니다...</p>
  </div>
  <script>
    const tokens = ${JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + tokens.expires_in * 1000,
    })};

    // 토큰을 localStorage에 저장
    localStorage.setItem('google-drive-tokens', JSON.stringify(tokens));

    // 설정 페이지로 리다이렉트
    window.location.href = '/settings?drive_connected=true';
  </script>
</body>
</html>
`
    res.setHeader('Content-Type', 'text/html')
    res.status(200).send(html)
  } catch (err) {
    console.error('OAuth callback error:', err)
    return res.redirect('/settings?drive_error=server_error')
  }
}
