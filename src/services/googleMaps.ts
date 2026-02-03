// ============================================
// Google Maps Service (Client-Side)
// ============================================

import type { GooglePlaceInfo } from '../types'

// API 응답 타입
interface ExtractInfoResponse {
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

// 추출 결과 타입
export interface ExtractedPlaceData {
  placeName?: string
  address?: string
  latitude?: number
  longitude?: number
  website?: string
  googleInfo: GooglePlaceInfo
}

/**
 * Google Maps URL인지 확인
 */
export function isGoogleMapsUrl(url: string): boolean {
  if (!url) return false
  return (
    url.includes('google.com/maps') ||
    url.includes('maps.google.com') ||
    url.includes('maps.app.goo.gl') ||
    url.includes('goo.gl/maps')
  )
}

/**
 * Google Maps URL에서 장소 정보 추출
 */
export async function extractPlaceInfo(mapUrl: string): Promise<ExtractedPlaceData> {
  if (!isGoogleMapsUrl(mapUrl)) {
    throw new Error('유효한 Google Maps URL이 아닙니다.')
  }

  const response = await fetch('/api/maps/extract-info', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mapUrl }),
  })

  const result: ExtractInfoResponse = await response.json()

  if (!result.success || !result.data) {
    throw new Error(result.error || '장소 정보를 추출할 수 없습니다.')
  }

  const { data } = result

  return {
    placeName: data.placeName,
    address: data.address,
    latitude: data.coordinates.latitude,
    longitude: data.coordinates.longitude,
    website: data.website,
    googleInfo: {
      placeId: data.placeId,
      cid: data.cid,
      rating: data.rating,
      reviewCount: data.reviewCount,
      phone: data.phone,
      website: data.website,
      openingHours: data.openingHours,
      category: data.category,
      extractedAt: new Date(data.extractedAt),
    },
  }
}

/**
 * 평점을 별점 문자열로 변환
 */
export function formatRating(rating?: number): string {
  if (rating === undefined || rating === null) return ''
  const fullStars = Math.floor(rating)
  const hasHalf = rating - fullStars >= 0.5
  return '★'.repeat(fullStars) + (hasHalf ? '☆' : '') + ` ${rating.toFixed(1)}`
}

/**
 * 리뷰 수 포맷팅
 */
export function formatReviewCount(count?: number): string {
  if (count === undefined || count === null) return ''
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1)}만`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}천`
  }
  return count.toLocaleString()
}
