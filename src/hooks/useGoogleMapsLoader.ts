// ============================================
// Google Maps Loader Hook
// ============================================

import { useState, useEffect } from 'react'
import { loadGoogleMaps, isGoogleMapsLoaded } from '@/services/googleMapsLoader'

export function useGoogleMapsLoader() {
  const [isLoaded, setIsLoaded] = useState(isGoogleMapsLoaded())
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    if (isLoaded) return
    loadGoogleMaps()
      .then(() => setIsLoaded(true))
      .catch(() => setIsError(true))
  }, [isLoaded])

  return { isLoaded, isError }
}
