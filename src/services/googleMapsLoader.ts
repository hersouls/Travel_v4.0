// ============================================
// Google Maps JavaScript API Singleton Loader
// ============================================

import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

let googleMapsPromise: Promise<typeof google> | null = null
let optionsSet = false

export function loadGoogleMaps(): Promise<typeof google> {
  if (googleMapsPromise) return googleMapsPromise

  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY
  if (!apiKey) {
    return Promise.reject(new Error('VITE_GOOGLE_API_KEY not configured'))
  }

  if (!optionsSet) {
    setOptions({ key: apiKey, v: 'weekly', libraries: ['geometry', 'marker'] })
    optionsSet = true
  }

  googleMapsPromise = importLibrary('maps').then(() => google)
  return googleMapsPromise
}

export function isGoogleMapsLoaded(): boolean {
  return typeof google !== 'undefined' && !!google.maps
}
