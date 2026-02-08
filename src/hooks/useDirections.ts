// ============================================
// Directions Hook - Route Directions for a Trip
// ============================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchDirectionsForTrip, invalidateRouteCache } from '@/services/directionsService'
import type { RouteSegment, TravelMode, Plan } from '@/types'

interface UseDirectionsResult {
  segments: RouteSegment[]
  isLoading: boolean
  error: string | null
  refresh: () => void
}

export function useDirections(
  plans: Plan[],
  tripId: number,
  travelMode: TravelMode,
): UseDirectionsResult {
  const [segments, setSegments] = useState<RouteSegment[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  // Memoize plan identity check to avoid unnecessary refetches
  // Only re-fetch when plan ids or coordinates change
  const plansKey = useMemo(() => {
    const relevantData = plans
      .filter((p) => typeof p.latitude === 'number' && typeof p.longitude === 'number')
      .map((p) => ({
        id: p.id,
        lat: p.latitude,
        lng: p.longitude,
      }))
    return JSON.stringify(relevantData)
  }, [plans])

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1)
  }, [])

  useEffect(() => {
    if (!tripId || plans.length < 2) {
      setSegments([])
      return
    }

    // Only consider plans with valid coordinates
    const plansWithCoords = plans.filter(
      (p): p is Plan & { id: number; latitude: number; longitude: number } =>
        typeof p.id === 'number' &&
        typeof p.latitude === 'number' &&
        typeof p.longitude === 'number' &&
        !isNaN(p.latitude) &&
        !isNaN(p.longitude),
    )

    if (plansWithCoords.length < 2) {
      setSegments([])
      return
    }

    let cancelled = false

    async function loadDirections() {
      setIsLoading(true)
      setError(null)

      try {
        // On manual refresh, invalidate cache first
        if (refreshKey > 0) {
          await invalidateRouteCache(tripId)
        }

        const result = await fetchDirectionsForTrip(
          tripId,
          plansWithCoords.map((p) => ({
            id: p.id,
            latitude: p.latitude,
            longitude: p.longitude,
          })),
          travelMode,
        )

        if (!cancelled) {
          setSegments(result)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to fetch directions'
          setError(message)
          console.error('[useDirections] Error:', err)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadDirections()

    return () => {
      cancelled = true
    }
  }, [tripId, plansKey, travelMode, refreshKey])

  return { segments, isLoading, error, refresh }
}
