// ============================================
// Google Place Photos Service
// ============================================

export interface PlacePhoto {
  url: string
  widthPx: number
  heightPx: number
  attribution: string
}

const MAX_CACHE_SIZE = 100
const cache = new Map<string, PlacePhoto[]>()

export async function getPlacePhotos(
  placeId: string,
  maxCount = 5,
): Promise<PlacePhoto[]> {
  const key = `${placeId}:${maxCount}`
  if (cache.has(key)) return cache.get(key)!

  try {
    const res = await fetch(
      `/api/places/photos?placeId=${encodeURIComponent(placeId)}&maxCount=${maxCount}`,
    )
    if (!res.ok) throw new Error('Place Photos API error')
    const data = await res.json()
    const photos: PlacePhoto[] = data.photos || []
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value
      if (firstKey !== undefined) cache.delete(firstKey)
    }
    cache.set(key, photos)
    return photos
  } catch (err) {
    console.warn('[PlacePhotos] Error:', err)
    // 일시적 실패를 빈 배열로 영구 캐시하면 재연결 후에도 사진이 안 보이므로
    // 실패는 캐시하지 않고 다음 호출에서 재시도하도록 한다 (성공/정상-빈 결과만 캐시)
    return []
  }
}
