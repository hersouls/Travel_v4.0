// ============================================
// Nearby Places Hook
// ============================================

import { useState, useEffect, useCallback } from 'react'
import type { NearbyPlace } from '@/types'
import { searchNearby } from '@/services/nearbySearchService'

interface UseNearbyPlacesOptions {
  latitude: number
  longitude: number
  radiusMeters?: number
  types?: string[]
  maxResults?: number
  enabled?: boolean
}

interface UseNearbyPlacesReturn {
  places: NearbyPlace[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useNearbyPlaces({
  latitude,
  longitude,
  radiusMeters = 1000,
  types,
  maxResults = 10,
  enabled = true,
}: UseNearbyPlacesOptions): UseNearbyPlacesReturn {
  const [places, setPlaces] = useState<NearbyPlace[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPlaces = useCallback(async () => {
    if (!enabled || !latitude || !longitude) return

    setIsLoading(true)
    setError(null)
    try {
      const results = await searchNearby(
        latitude,
        longitude,
        radiusMeters,
        types,
        maxResults,
      )
      setPlaces(results)
    } catch (err) {
      setError((err as Error).message || '주변 장소 검색에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }, [latitude, longitude, radiusMeters, JSON.stringify(types), maxResults, enabled])

  useEffect(() => {
    fetchPlaces()
  }, [fetchPlaces])

  return { places, isLoading, error, refresh: fetchPlaces }
}
