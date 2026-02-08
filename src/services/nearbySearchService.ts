// ============================================
// Nearby Place Search Service
// ============================================

import type { NearbyPlace } from '@/types'

export async function searchNearby(
  latitude: number,
  longitude: number,
  radiusMeters = 1000,
  types?: string[],
  maxResults = 10,
): Promise<NearbyPlace[]> {
  try {
    const res = await fetch('/api/places/nearby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude,
        longitude,
        radiusMeters,
        types,
        language: 'ko',
        maxResults,
      }),
    })
    if (!res.ok) throw new Error('Nearby Search API error')
    const data = await res.json()
    return data.places || []
  } catch (err) {
    console.warn('[NearbySearch] Error:', err)
    return []
  }
}
