// ============================================
// Nearby Places Hook
// ============================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
  const abortRef = useRef<AbortController | null>(null)
  const typesKey = useMemo(() => JSON.stringify(types), [types])

  const fetchPlaces = useCallback(async () => {
    if (!enabled || !latitude || !longitude) return

    // 이전 요청 취소
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

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
      // 취소된 요청의 결과 무시
      if (!controller.signal.aborted) {
        setPlaces(results)
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError((err as Error).message || '주변 장소 검색에 실패했습니다')
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }, [latitude, longitude, radiusMeters, typesKey, maxResults, enabled])

  useEffect(() => {
    fetchPlaces()
    return () => {
      abortRef.current?.abort()
    }
  }, [fetchPlaces])

  return { places, isLoading, error, refresh: fetchPlaces }
}
