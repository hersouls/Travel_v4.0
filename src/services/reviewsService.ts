// ============================================
// Google Place Reviews Service
// ============================================

export interface PlaceReview {
  authorName: string
  rating: number
  text: string
  relativeTime: string
  language: string
}

export interface PlaceReviewsResult {
  rating: number
  totalReviews: number
  reviews: PlaceReview[]
}

const cache = new Map<string, PlaceReviewsResult>()

export async function getPlaceReviews(
  placeId: string,
  language = 'ko',
): Promise<PlaceReviewsResult | null> {
  const key = `${placeId}:${language}`
  if (cache.has(key)) return cache.get(key)!

  try {
    const res = await fetch(
      `/api/places/reviews?placeId=${encodeURIComponent(placeId)}&language=${language}`,
    )
    if (!res.ok) throw new Error('Reviews API error')
    const data = await res.json()
    const result: PlaceReviewsResult = {
      rating: data.rating || 0,
      totalReviews: data.totalReviews || 0,
      reviews: data.reviews || [],
    }
    cache.set(key, result)
    return result
  } catch (err) {
    console.warn('[Reviews] Error:', err)
    return null
  }
}
