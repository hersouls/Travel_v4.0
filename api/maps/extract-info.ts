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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { mapUrl } = req.body as { mapUrl?: string }

  if (!mapUrl) {
    return res.status(400).json({ success: false, error: 'mapUrl is required' })
  }

  // Google Maps URL 검증
  const isGoogleMapsUrl =
    mapUrl.includes('google.com/maps') ||
    mapUrl.includes('maps.google.com') ||
    mapUrl.includes('maps.app.goo.gl') ||
    mapUrl.includes('goo.gl/maps')

  if (!isGoogleMapsUrl) {
    return res.status(400).json({
      success: false,
      error: 'Invalid URL. Please provide a Google Maps URL.',
    })
  }

  try {
    // 리다이렉트 추적하여 최종 URL 획득
    const response = await fetch(mapUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    })

    const finalUrl = response.url
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
        address: htmlData.address,
        coordinates,
        placeId,
        cid,
        rating: htmlData.rating,
        reviewCount: htmlData.reviewCount,
        phone: htmlData.phone,
        website: htmlData.website,
        openingHours: htmlData.openingHours,
        category: htmlData.category,
        extractedAt: new Date().toISOString(),
      },
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('Error extracting map info:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extract map information',
    })
  }
}
