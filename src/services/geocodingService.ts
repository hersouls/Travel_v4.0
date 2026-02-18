// ============================================
// Reverse Geocoding Service
// GPS coordinates → human-readable address
// Uses Google Maps Geocoding API (already loaded)
// ============================================

/**
 * Reverse geocode coordinates to address.
 * Returns formatted address string, or null if unavailable.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  if (!window.google?.maps?.Geocoder) {
    console.warn('[Geocoding] Google Maps Geocoder not available')
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
  } catch (error) {
    console.error('[Geocoding] Reverse geocode failed:', error)
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
