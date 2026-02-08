// ============================================
// Google Street View Service
// ============================================

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY

/**
 * Street View Static API image URL 생성
 * https://developers.google.com/maps/documentation/streetview
 */
export function getStreetViewStaticUrl(
  latitude: number,
  longitude: number,
  options: {
    width?: number
    height?: number
    heading?: number
    pitch?: number
    fov?: number
  } = {}
): string {
  const {
    width = 600,
    height = 300,
    heading = 0,
    pitch = 0,
    fov = 90,
  } = options

  const params = new URLSearchParams({
    size: `${width}x${height}`,
    location: `${latitude},${longitude}`,
    heading: String(heading),
    pitch: String(pitch),
    fov: String(fov),
    key: GOOGLE_API_KEY || '',
  })

  return `https://maps.googleapis.com/maps/api/streetview?${params.toString()}`
}

// Keep legacy export name for backward compatibility
export const getStreetViewUrl = getStreetViewStaticUrl

/**
 * Street View 새 탭에서 열기 URL 생성
 */
export function getStreetViewPageUrl(
  latitude: number,
  longitude: number
): string {
  return `https://www.google.com/maps/@${latitude},${longitude},3a,75y,0h,90t/data=!3m6!1e1!3m4!1s!2e0!7i16384!8i8192`
}

// ============================================
// Server-side proxy with in-memory cache
// ============================================

const availabilityCache = new Map<string, { url: string | null; available: boolean }>()

/**
 * Street View 가용성 확인 (서버 프록시 사용)
 * API 키 노출 없이 가용성을 체크하고 이미지 URL을 반환
 */
export async function getStreetViewWithAvailability(
  lat: number,
  lng: number,
): Promise<{ url: string | null; available: boolean }> {
  const key = `${lat.toFixed(6)},${lng.toFixed(6)}`
  if (availabilityCache.has(key)) return availabilityCache.get(key)!

  try {
    const res = await fetch(`/api/maps/streetview?lat=${lat}&lng=${lng}`)
    if (!res.ok) throw new Error('Street View API error')
    const data = await res.json()
    availabilityCache.set(key, data)
    return data
  } catch (err) {
    console.warn('[StreetView] Error:', err)
    const fallback = { url: null, available: false }
    availabilityCache.set(key, fallback)
    return fallback
  }
}
