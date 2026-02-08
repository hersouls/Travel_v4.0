// ============================================
// Google Time Zone API Detection Hook
// ============================================

import { useState, useEffect } from 'react'

interface TimezoneResult {
  timeZoneId: string
  timeZoneName: string
}

export function useGoogleTimezone(
  latitude?: number,
  longitude?: number,
): {
  timezone: TimezoneResult | null
  isLoading: boolean
} {
  const [timezone, setTimezone] = useState<TimezoneResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (latitude == null || longitude == null) return

    let cancelled = false
    setIsLoading(true)

    const timestamp = Math.floor(Date.now() / 1000)

    fetch(
      `/api/timezone/detect?lat=${latitude}&lng=${longitude}&timestamp=${timestamp}`,
    )
      .then((res) => {
        if (!res.ok) throw new Error('Timezone API error')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setTimezone({
            timeZoneId: data.timeZoneId,
            timeZoneName: data.timeZoneName,
          })
        }
      })
      .catch((err) => {
        console.warn('[GoogleTimezone] Error:', err)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [latitude, longitude])

  return { timezone, isLoading }
}
