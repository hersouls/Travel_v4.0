// ============================================
// Elevation Query Hook
// Fetches elevation for a single coordinate
// ============================================

import { useState, useEffect } from 'react'

// Module-level cache to avoid redundant API calls
const elevationCache = new Map<string, number>()

export function useElevation(
  latitude?: number,
  longitude?: number,
): {
  elevation: number | null
  isLoading: boolean
} {
  const [elevation, setElevation] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (latitude == null || longitude == null) return

    const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`

    // Check cache
    const cached = elevationCache.get(key)
    if (cached !== undefined) {
      setElevation(cached)
      return
    }

    let cancelled = false
    setIsLoading(true)

    fetch('/api/routes/elevation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: [{ lat: latitude, lng: longitude }],
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Elevation API error')
        return res.json()
      })
      .then((data) => {
        if (!cancelled && data.elevations?.[0]?.elevation != null) {
          const elev = Math.round(data.elevations[0].elevation)
          elevationCache.set(key, elev)
          setElevation(elev)
        }
      })
      .catch(() => {
        // elevation lookup failure is non-critical
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [latitude, longitude])

  return { elevation, isLoading }
}
