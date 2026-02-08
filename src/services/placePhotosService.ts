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
    if (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value
      if (firstKey !== undefined) cache.delete(firstKey)
    }
    cache.set(key, [])
    return []
  }
}
