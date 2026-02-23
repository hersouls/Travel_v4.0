// ============================================
// Geocoding Service
// GPS coordinates ↔ human-readable address
// + Browser Geolocation API
// ============================================

/**
 * Tracks whether the Geocoding API has been denied (REQUEST_DENIED).
 * Once denied, all subsequent calls return null immediately to avoid console spam.
 */
let geocodingDenied = false

export function isGeocodingDenied(): boolean {
  return geocodingDenied
}

/**
 * Get current device position using browser Geolocation API.
 * Requires user permission. High accuracy mode, 10s timeout.
 */
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('이 기기에서 위치 서비스를 사용할 수 없습니다'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해주세요.'))
            break
          case error.POSITION_UNAVAILABLE:
            reject(new Error('현재 위치를 확인할 수 없습니다'))
            break
          case error.TIMEOUT:
            reject(new Error('위치 확인 시간이 초과되었습니다'))
            break
          default:
            reject(new Error('위치를 가져오는 중 오류가 발생했습니다'))
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000, // 1분 캐시 허용
      },
    )
  })
}

/**
 * Reverse geocode coordinates to address.
 * Returns formatted address string, or null if unavailable.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  if (geocodingDenied || !window.google?.maps?.Geocoder) {
    return null
  }

  try {
    const geocoder = new google.maps.Geocoder()
    const result = await geocoder.geocode({
      location: { lat: latitude, lng: longitude },
    })

    if (result.results.length > 0) {
      const preferred = result.results.find(
        (r) =>
          r.types.includes('street_address') ||
          r.types.includes('premise') ||
          r.types.includes('point_of_interest'),
      )
      return (preferred || result.results[0]).formatted_address
    }

    return null
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('REQUEST_DENIED') || msg.includes('not activated')) {
      geocodingDenied = true
      console.warn('[Geocoding] API denied – Geocoding API가 Google Cloud Console에서 활성화되지 않았습니다. 이후 호출을 건너뜁니다.')
    } else {
      console.warn('[Geocoding] Reverse geocode failed:', error)
    }
    return null
  }
}

/**
 * Forward geocode a query string to coordinates.
 * Returns lat/lng/address, or null if unavailable.
 */
export async function forwardGeocode(
  query: string,
): Promise<{ lat: number; lng: number; address: string } | null> {
  if (geocodingDenied || !window.google?.maps?.Geocoder || !query.trim()) {
    return null
  }

  try {
    const geocoder = new google.maps.Geocoder()
    const result = await geocoder.geocode({ address: query })

    if (result.results.length > 0) {
      const first = result.results[0]
      return {
        lat: first.geometry.location.lat(),
        lng: first.geometry.location.lng(),
        address: first.formatted_address,
      }
    }

    return null
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes('REQUEST_DENIED') || msg.includes('not activated')) {
      geocodingDenied = true
      console.warn('[Geocoding] API denied – Geocoding API가 Google Cloud Console에서 활성화되지 않았습니다. 이후 호출을 건너뜁니다.')
    } else {
      console.warn('[Geocoding] Forward geocode failed:', error)
    }
    return null
  }
}

/**
 * Batch reverse geocode with rate limiting.
 * Processes 5 at a time with 200ms delay between batches.
 */
export async function reverseGeocodeBatch(
  coords: Array<{ id: number; latitude: number; longitude: number }>,
): Promise<Map<number, string>> {
  const results = new Map<number, string>()
  const BATCH_SIZE = 5
  const DELAY_MS = 200

  for (let i = 0; i < coords.length; i += BATCH_SIZE) {
    const batch = coords.slice(i, i + BATCH_SIZE)
    await Promise.allSettled(
      batch.map(async ({ id, latitude, longitude }) => {
        const address = await reverseGeocode(latitude, longitude)
        if (address) results.set(id, address)
      }),
    )

    if (i + BATCH_SIZE < coords.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
    }
  }

  return results
}
