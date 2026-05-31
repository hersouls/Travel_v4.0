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
    // 좌표 변경 시 직전 좌표의 시간대를 먼저 비워, 실패 시 잘못된 시간대로
    // 시각을 렌더링하는 것을 방지
    setTimezone(null)
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
        if (!cancelled) setTimezone(null)
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
