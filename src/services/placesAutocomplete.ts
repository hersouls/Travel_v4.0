// ============================================
// Google Places Autocomplete Service
// ============================================

export interface PlacePrediction {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
}

export interface PlaceDetails {
  name: string
  address: string
  latitude: number
  longitude: number
  website?: string
  phone?: string
  rating?: number
  reviewCount?: number
  category?: string
  openingHours?: string[]
  priceLevel?: number
}

const API_BASE = import.meta.env.PROD ? '' : ''

/**
 * Search for places using Google Places Autocomplete
 */
export async function searchPlaces(
  input: string,
  language?: string
): Promise<PlacePrediction[]> {
  if (!input || input.length < 2) {
    return []
  }

  try {
    const response = await fetch(`${API_BASE}/api/places/autocomplete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input,
        language: language || getBrowserLanguage(),
      }),
    })

    if (!response.ok) {
      console.error('[Places] Autocomplete failed:', response.status)
      return []
    }

    const data = await response.json()
    return data.predictions || []
  } catch (error) {
    console.error('[Places] Autocomplete error:', error)
    return []
  }
}

/**
 * Get place details by place ID
 */
export async function getPlaceDetails(
  placeId: string,
  language?: string
): Promise<PlaceDetails | null> {
  if (!placeId) {
    return null
  }

  try {
    const params = new URLSearchParams({
      placeId,
      language: language || getBrowserLanguage(),
    })

    const response = await fetch(`${API_BASE}/api/places/details?${params}`)

    if (!response.ok) {
      console.error('[Places] Details failed:', response.status)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('[Places] Details error:', error)
    return null
  }
}

/**
 * Get browser language code (ko, en, ja, etc.)
 */
function getBrowserLanguage(): string {
  const lang = navigator.language || 'ko'
  // Extract primary language code (e.g., 'ko-KR' -> 'ko')
  return lang.split('-')[0]
}
