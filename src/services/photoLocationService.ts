// ============================================
// Photo Location Detection Service
// AI analysis → Google Places/Geocoding pipeline
// ============================================

import { generateStructured, buildPhotoLocationContext } from '@/services/claudeService'
import { searchPlaces, getPlaceDetails } from '@/services/placesAutocomplete'
import { forwardGeocode } from '@/services/geocodingService'
import { getImageFormat } from '@/services/imageStorage'
import type { ClaudeModel } from '@/types'

interface AILocationResult {
  placeName: string
  estimatedLocation: string
  locationType: string
  confidence: 'high' | 'medium' | 'low'
  clues: string
}

export interface DetectedLocation {
  placeName: string
  address: string
  latitude: number
  longitude: number
  confidence: 'high' | 'medium' | 'low'
  clues: string
}

/**
 * Detect photo location using AI analysis + geocoding pipeline.
 * 1. Claude AI analyzes photo → placeName + estimatedLocation
 * 2. Google Places search → precise coordinates
 * 3. Forward geocoding fallback
 */
export async function detectPhotoLocation(
  base64Image: string,
  tripCountry: string,
  apiKey: string,
  model: ClaudeModel,
  signal?: AbortSignal,
): Promise<DetectedLocation | null> {
  // Step 1: AI analysis
  const imageFormat = getImageFormat(base64Image)
  // Strip data URL prefix for API
  const imageData = base64Image.includes(',')
    ? base64Image.split(',')[1]
    : base64Image

  const request = buildPhotoLocationContext(imageData, `image/${imageFormat}`, tripCountry)

  let aiResult: AILocationResult
  try {
    aiResult = await generateStructured<AILocationResult>(request, apiKey, model, signal)
  } catch {
    return null
  }

  if (!aiResult || (!aiResult.placeName && !aiResult.estimatedLocation)) {
    return null
  }

  // Step 2: Try Google Places search for precise coordinates
  if (aiResult.placeName) {
    const searchQuery = aiResult.estimatedLocation
      ? `${aiResult.placeName} ${aiResult.estimatedLocation}`
      : aiResult.placeName

    try {
      const predictions = await searchPlaces(searchQuery)
      if (predictions.length > 0) {
        const details = await getPlaceDetails(predictions[0].placeId)
        if (details) {
          return {
            placeName: aiResult.placeName,
            address: details.address,
            latitude: details.latitude,
            longitude: details.longitude,
            confidence: aiResult.confidence,
            clues: aiResult.clues,
          }
        }
      }
    } catch {
      // Continue to fallback
    }
  }

  // Step 3: Forward geocode with place name + location
  const geoQuery = [aiResult.placeName, aiResult.estimatedLocation].filter(Boolean).join(', ')
  if (geoQuery) {
    try {
      const geo = await forwardGeocode(geoQuery)
      if (geo) {
        return {
          placeName: aiResult.placeName || aiResult.estimatedLocation,
          address: geo.address,
          latitude: geo.lat,
          longitude: geo.lng,
          confidence: aiResult.confidence,
          clues: aiResult.clues,
        }
      }
    } catch {
      // Continue to final fallback
    }
  }

  // Step 4: Forward geocode with estimated location only (city-level)
  if (aiResult.estimatedLocation) {
    try {
      const geo = await forwardGeocode(aiResult.estimatedLocation)
      if (geo) {
        return {
          placeName: aiResult.placeName || aiResult.estimatedLocation,
          address: geo.address,
          latitude: geo.lat,
          longitude: geo.lng,
          confidence: 'low',
          clues: aiResult.clues,
        }
      }
    } catch {
      // All geocoding failed
    }
  }

  return null
}

/**
 * Batch detect photo locations with progress callback.
 * Processes photos sequentially to respect API rate limits.
 */
export async function detectPhotoLocationBatch(
  photos: Array<{ index: number; base64Image: string }>,
  tripCountry: string,
  apiKey: string,
  model: ClaudeModel,
  onProgress?: (current: number, total: number, result: DetectedLocation | null) => void,
  signal?: AbortSignal,
): Promise<Map<number, DetectedLocation>> {
  const results = new Map<number, DetectedLocation>()

  for (let i = 0; i < photos.length; i++) {
    if (signal?.aborted) break

    const { index, base64Image } = photos[i]
    try {
      const location = await detectPhotoLocation(base64Image, tripCountry, apiKey, model, signal)
      if (location) {
        results.set(index, location)
      }
      onProgress?.(i + 1, photos.length, location)
    } catch {
      onProgress?.(i + 1, photos.length, null)
    }
  }

  return results
}
