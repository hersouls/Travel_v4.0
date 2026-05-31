// ============================================
// Google Maps URL Info Extraction API
// ============================================

import type { VercelRequest, VercelResponse } from '@vercel/node'

interface ExtractedInfo {
  success: boolean
  data?: {
    sourceUrl: string
    redirectUrl?: string
    placeName?: string
    address?: string
    coordinates: {
      latitude?: number
      longitude?: number
    }
    placeId?: string
    cid?: string
    rating?: number
    reviewCount?: number
    phone?: string
    website?: string
    openingHours?: string[]
    category?: string
    extractedAt: string
  }
  error?: string
}

// URL에서 좌표 추출
function extractCoordinates(url: string): { latitude?: number; longitude?: number } {
  // 패턴 1: @lat,lng,zoom
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (atMatch) {
    return {
      latitude: Number.parseFloat(atMatch[1]),
      longitude: Number.parseFloat(atMatch[2]),
    }
  }

  // 패턴 2: !3d{lat}!4d{lng}
  const dataMatch = url.match(/!3d(-?\d+\.?\d*).*!4d(-?\d+\.?\d*)/)
  if (dataMatch) {
    return {
      latitude: Number.parseFloat(dataMatch[1]),
      longitude: Number.parseFloat(dataMatch[2]),
    }
  }

  return {}
}

// URL에서 Place ID 추출
function extractPlaceId(url: string): string | undefined {
  // 패턴 1: /place/{name}/{placeId}
  const pathMatch = url.match(/place\/[^/]+\/([A-Za-z0-9_-]+)/)
  if (pathMatch) {
    const potentialId = pathMatch[1]
    // ChIJ로 시작하는 Place ID 확인
    if (potentialId.startsWith('ChIJ')) {
      return potentialId
    }
  }

  // 패턴 2: !1s로 시작하는 Place ID
  const dataMatch = url.match(/!1s(ChIJ[A-Za-z0-9_-]+)/)
  if (dataMatch) {
    return dataMatch[1]
  }

  // 패턴 3: place_id= 쿼리 파라미터
  const queryMatch = url.match(/place_id=([A-Za-z0-9_-]+)/)
  if (queryMatch) {
    return queryMatch[1]
  }

  return undefined
}

// URL에서 CID 추출
function extractCid(url: string): string | undefined {
  const cidMatch = url.match(/cid=(\d+)/)
  return cidMatch ? cidMatch[1] : undefined
}

// URL에서 장소명 추출
function extractPlaceName(url: string): string | undefined {
  const placeMatch = url.match(/\/place\/([^/@]+)/)
  if (placeMatch) {
    let name = decodeURIComponent(placeMatch[1])
    name = name.replace(/\+/g, ' ')
    return name
  }
  return undefined
}

// HTML에서 JSON 데이터 추출
function extractFromHtml(html: string): Partial<ExtractedInfo['data']> {
  const result: Partial<ExtractedInfo['data']> = {}

  // 주소 추출
  const addressMatch = html.match(/"address"\s*:\s*"([^"]+)"/)
  if (addressMatch) {
    result.address = addressMatch[1]
  }

  // 평점 추출
  const ratingMatch = html.match(/"rating"\s*:\s*(\d+\.?\d*)/)
  if (ratingMatch) {
    result.rating = Number.parseFloat(ratingMatch[1])
  }

  // 리뷰 수 추출
  const reviewMatch = html.match(/"userRatingCount"\s*:\s*(\d+)/)
  if (reviewMatch) {
    result.reviewCount = Number.parseInt(reviewMatch[1], 10)
  }

  // 전화번호 추출
  const phoneMatch = html.match(/"phoneNumber"\s*:\s*"([^"]+)"/)
  if (phoneMatch) {
    result.phone = phoneMatch[1]
  }

  // 웹사이트 추출
  const websiteMatch = html.match(/"website"\s*:\s*"([^"]+)"/)
  if (websiteMatch) {
    result.website = websiteMatch[1]
  }

  // 카테고리 추출
  const categoryMatch = html.match(/"primaryTypeDisplayName"\s*:\s*\{\s*"text"\s*:\s*"([^"]+)"/)
  if (categoryMatch) {
    result.category = categoryMatch[1]
  }

  // 영업시간 추출 시도
  const hoursMatch = html.match(/"openingHours"\s*:\s*\[([^\]]+)\]/)
  if (hoursMatch) {
    try {
      const hoursText = hoursMatch[1]
      const hours = hoursText.match(/"([^"]+)"/g)?.map((h) => h.replace(/"/g, ''))
      if (hours) {
        result.openingHours = hours
      }
    } catch {
      // 파싱 실패 시 무시
    }
  }

  return result
}

// ============================================
// SSRF 방어 유틸리티
// ============================================

const ALLOWED_HOSTS = new Set([
  'www.google.com',
  'google.com',
  'maps.google.com',
  'maps.app.goo.gl',
  'goo.gl',
])

// 사설/루프백/링크로컬 IP 리터럴 차단 (심층 방어)
function isPrivateIp(host: string): boolean {
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const a = Number(v4[1])
    const b = Number(v4[2])
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    return false
  }
  const h = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (h === '::1' || h === '::') return true
  if (h.startsWith('fc') || h.startsWith('fd')) return true // fc00::/7 unique-local
  if (h.startsWith('fe80')) return true // link-local
  return false
}

function isHostAllowed(host: string): boolean {
  const h = host.toLowerCase()
  if (isPrivateIp(h)) return false
  return ALLOWED_HOSTS.has(h)
}

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
}

// 리다이렉트를 수동으로 따라가며 각 홉의 호스트를 화이트리스트로 재검증한다.
// goo.gl / maps.app.goo.gl 단축 링크가 google.com/maps로 리다이렉트되는 정상 경로는 허용하되,
// 내부/사설 호스트로의 리다이렉트는 차단한다.
async function fetchGoogleMapsWithRedirects(
  initialUrl: string,
): Promise<{ response: Awaited<ReturnType<typeof fetch>>; finalUrl: string }> {
  let currentUrl = initialUrl
  const maxHops = 5

  for (let hop = 0; hop <= maxHops; hop++) {
    const parsed = new URL(currentUrl)
    if (parsed.protocol !== 'https:') {
      throw new Error('Blocked: only https URLs are allowed')
    }
    if (!isHostAllowed(parsed.hostname)) {
      throw new Error('Blocked: URL host is not an allowed Google Maps host')
    }

    const response = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: FETCH_HEADERS,
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) {
        return { response, finalUrl: currentUrl }
      }
      // 상대 경로 리다이렉트도 절대 URL로 해석
      currentUrl = new URL(location, currentUrl).toString()
      continue
    }

    return { response, finalUrl: currentUrl }
  }

  throw new Error('Blocked: too many redirects')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더
  const ALLOWED_ORIGINS = ['https://travel1.moonwave.kr','https://moonwave-travel.vercel.app','http://localhost:5173','http://localhost:4173']
  const origin = req.headers.origin || ''
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0])
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { mapUrl } = (req.body ?? {}) as { mapUrl?: string }

  if (!mapUrl || typeof mapUrl !== 'string') {
    return res.status(400).json({ error: 'mapUrl is required' })
  }

  if (mapUrl.length > 2000) {
    return res.status(400).json({ error: 'mapUrl must be under 2000 characters' })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(mapUrl)
  } catch {
    return res.status(400).json({ error: 'mapUrl must be a valid URL' })
  }

  // SSRF 방어: 스킴은 https로 고정하고, substring이 아닌 "파싱된 호스트"를 정확히 화이트리스트로 검증
  if (parsedUrl.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only https URLs are allowed' })
  }
  const initialHost = parsedUrl.hostname.toLowerCase()
  const isGoogleMapsUrl =
    isHostAllowed(initialHost) &&
    (initialHost === 'google.com' || initialHost === 'www.google.com'
      ? parsedUrl.pathname.startsWith('/maps')
      : true)

  if (!isGoogleMapsUrl) {
    return res.status(400).json({
      error: 'Invalid URL. Please provide a Google Maps URL.',
    })
  }

  try {
    // 리다이렉트를 수동으로 추적하되 각 홉의 호스트를 다시 검증하여 최종 URL 획득 (SSRF 방지)
    const { response, finalUrl } = await fetchGoogleMapsWithRedirects(mapUrl)
    const html = await response.text()

    // URL에서 기본 정보 추출
    const coordinates = extractCoordinates(finalUrl)
    const placeId = extractPlaceId(finalUrl)
    const cid = extractCid(finalUrl)
    const placeName = extractPlaceName(finalUrl)

    // HTML에서 추가 정보 추출
    const htmlData = extractFromHtml(html)

    const result: ExtractedInfo = {
      success: true,
      data: {
        sourceUrl: mapUrl,
        redirectUrl: finalUrl !== mapUrl ? finalUrl : undefined,
        placeName: placeName || undefined,
        coordinates,
        placeId,
        cid,
        ...htmlData,
        extractedAt: new Date().toISOString(),
      },
    }

    return res.status(200).json(result)
  } catch (error) {
    // 원시 fetch 에러 메시지(내부 호스트/IP/리다이렉트 체인 등)를 클라이언트에 노출하지 않는다.
    // 상세 내용은 서버 로그에만 남긴다.
    console.error('Error extracting map info:', error)
    return res.status(500).json({
      error: 'Failed to extract map information',
    })
  }
}
