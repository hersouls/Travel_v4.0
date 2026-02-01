/**
 * Firebase → IndexedDB Migration Service
 *
 * This service helps migrate data from Firebase (Travel_v2.1)
 * to the local IndexedDB storage used in Travel_v4.0
 */

import * as db from './database'
import type { Trip, Plan, Place } from '@/types'

// Firebase export data structure (from Firestore export)
export interface FirebaseExportData {
  version?: string
  exportDate?: string
  trips?: FirebaseTripData[]
  plans?: FirebasePlanData[]
  places?: FirebasePlaceData[]
}

interface FirebaseTripData {
  id?: string
  title: string
  country?: string
  startDate: string | { seconds: number; nanoseconds: number }
  endDate: string | { seconds: number; nanoseconds: number }
  coverImage?: string
  coverImageUrl?: string
  isFavorite?: boolean
  createdAt?: string | { seconds: number; nanoseconds: number }
  updatedAt?: string | { seconds: number; nanoseconds: number }
}

interface FirebasePlanData {
  id?: string
  tripId: string | number
  day: number
  placeName: string
  startTime: string
  endTime?: string
  type: string
  address?: string
  memo?: string
  photos?: string[]
  photoUrls?: string[]
  youtubeLink?: string
  mapUrl?: string
  latitude?: number
  longitude?: number
  createdAt?: string | { seconds: number; nanoseconds: number }
  updatedAt?: string | { seconds: number; nanoseconds: number }
}

interface FirebasePlaceData {
  id?: string
  name: string
  type: string
  address?: string
  memo?: string
  latitude?: number
  longitude?: number
  isFavorite?: boolean
  usageCount?: number
  createdAt?: string | { seconds: number; nanoseconds: number }
  updatedAt?: string | { seconds: number; nanoseconds: number }
}

export interface MigrationResult {
  success: boolean
  tripsImported: number
  plansImported: number
  placesImported: number
  errors: string[]
  warnings: string[]
}

export interface MigrationProgress {
  phase: 'parsing' | 'images' | 'trips' | 'plans' | 'places' | 'complete'
  current: number
  total: number
  message: string
}

type ProgressCallback = (progress: MigrationProgress) => void

/**
 * Convert Firebase timestamp to Date
 */
function convertTimestamp(value: string | { seconds: number; nanoseconds: number } | undefined): Date {
  if (!value) return new Date()

  if (typeof value === 'string') {
    return new Date(value)
  }

  if (typeof value === 'object' && 'seconds' in value) {
    return new Date(value.seconds * 1000)
  }

  return new Date()
}

/**
 * Convert Firebase storage URL to Base64
 * Note: This only works if the Firebase Storage rules allow public access
 * or if the URL is a signed URL that's still valid
 */
async function urlToBase64(url: string): Promise<string | null> {
  if (!url) return null

  // If already Base64, return as is
  if (url.startsWith('data:')) return url

  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Failed to fetch image: ${url}`)
      return null
    }

    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.warn(`Error converting image URL: ${url}`, error)
    return null
  }
}

/**
 * Validate imported data structure
 */
function validateImportData(data: unknown): data is FirebaseExportData {
  if (!data || typeof data !== 'object') return false

  const obj = data as Record<string, unknown>

  // Must have at least one of trips, plans, or places
  if (!obj.trips && !obj.plans && !obj.places) return false

  // Validate trips array if present
  if (obj.trips && !Array.isArray(obj.trips)) return false

  // Validate plans array if present
  if (obj.plans && !Array.isArray(obj.plans)) return false

  // Validate places array if present
  if (obj.places && !Array.isArray(obj.places)) return false

  return true
}

/**
 * Import data from Firebase export JSON
 */
export async function importFromFirebase(
  jsonData: string,
  options: {
    convertImages?: boolean
    clearExisting?: boolean
    onProgress?: ProgressCallback
  } = {}
): Promise<MigrationResult> {
  const { convertImages = false, clearExisting = false, onProgress } = options

  const result: MigrationResult = {
    success: false,
    tripsImported: 0,
    plansImported: 0,
    placesImported: 0,
    errors: [],
    warnings: [],
  }

  try {
    // Parse JSON
    onProgress?.({ phase: 'parsing', current: 0, total: 1, message: 'JSON 파싱 중...' })

    let data: FirebaseExportData
    try {
      data = JSON.parse(jsonData)
    } catch {
      result.errors.push('유효하지 않은 JSON 형식입니다')
      return result
    }

    // Validate data structure
    if (!validateImportData(data)) {
      result.errors.push('유효하지 않은 데이터 형식입니다. trips, plans, 또는 places 배열이 필요합니다.')
      return result
    }

    onProgress?.({ phase: 'parsing', current: 1, total: 1, message: 'JSON 파싱 완료' })

    // Clear existing data if requested
    if (clearExisting) {
      await db.clearAllData()
    }

    // Map old trip IDs to new IDs
    const tripIdMap = new Map<string, number>()

    // Import trips
    const trips = data.trips || []
    for (let i = 0; i < trips.length; i++) {
      const firebaseTrip = trips[i]
      onProgress?.({
        phase: 'trips',
        current: i + 1,
        total: trips.length,
        message: `여행 가져오기: ${firebaseTrip.title}`,
      })

      try {
        let coverImage: string | undefined

        // Convert cover image URL to Base64
        if (convertImages && (firebaseTrip.coverImageUrl || firebaseTrip.coverImage)) {
          const imageUrl = firebaseTrip.coverImageUrl || firebaseTrip.coverImage
          if (imageUrl && !imageUrl.startsWith('data:')) {
            onProgress?.({
              phase: 'images',
              current: i + 1,
              total: trips.length,
              message: `이미지 변환 중: ${firebaseTrip.title}`,
            })
            const base64 = await urlToBase64(imageUrl)
            if (base64) {
              coverImage = base64
            } else {
              result.warnings.push(`여행 "${firebaseTrip.title}"의 커버 이미지를 가져올 수 없습니다`)
            }
          }
        } else if (firebaseTrip.coverImage?.startsWith('data:')) {
          coverImage = firebaseTrip.coverImage
        }

        const tripData: Omit<Trip, 'id'> = {
          title: firebaseTrip.title,
          country: firebaseTrip.country || '',
          startDate:
            typeof firebaseTrip.startDate === 'string'
              ? firebaseTrip.startDate
              : convertTimestamp(firebaseTrip.startDate).toISOString().split('T')[0],
          endDate:
            typeof firebaseTrip.endDate === 'string'
              ? firebaseTrip.endDate
              : convertTimestamp(firebaseTrip.endDate).toISOString().split('T')[0],
          coverImage,
          isFavorite: firebaseTrip.isFavorite || false,
          createdAt: convertTimestamp(firebaseTrip.createdAt),
          updatedAt: convertTimestamp(firebaseTrip.updatedAt),
        }

        const newTripId = await db.addTrip(tripData)
        if (firebaseTrip.id) {
          tripIdMap.set(firebaseTrip.id, newTripId)
        }
        result.tripsImported++
      } catch (error) {
        result.errors.push(`여행 "${firebaseTrip.title}" 가져오기 실패: ${error}`)
      }
    }

    // Import plans
    const plans = data.plans || []
    for (let i = 0; i < plans.length; i++) {
      const firebasePlan = plans[i]
      onProgress?.({
        phase: 'plans',
        current: i + 1,
        total: plans.length,
        message: `일정 가져오기: ${firebasePlan.placeName}`,
      })

      try {
        // Map old trip ID to new ID
        let tripId: number
        if (typeof firebasePlan.tripId === 'number') {
          tripId = firebasePlan.tripId
        } else {
          const mappedId = tripIdMap.get(firebasePlan.tripId)
          if (!mappedId) {
            result.warnings.push(`일정 "${firebasePlan.placeName}"의 여행을 찾을 수 없습니다`)
            continue
          }
          tripId = mappedId
        }

        // Convert photo URLs to Base64
        let photos: string[] = []
        if (convertImages && firebasePlan.photoUrls && firebasePlan.photoUrls.length > 0) {
          onProgress?.({
            phase: 'images',
            current: i + 1,
            total: plans.length,
            message: `일정 사진 변환 중: ${firebasePlan.placeName}`,
          })
          const converted = await Promise.all(firebasePlan.photoUrls.map((url) => urlToBase64(url)))
          photos = converted.filter((p): p is string => p !== null)
          if (photos.length < firebasePlan.photoUrls.length) {
            result.warnings.push(
              `일정 "${firebasePlan.placeName}"의 일부 사진을 가져올 수 없습니다`
            )
          }
        } else if (firebasePlan.photos) {
          photos = firebasePlan.photos.filter((p) => p.startsWith('data:'))
        }

        const planData: Omit<Plan, 'id'> = {
          tripId,
          day: firebasePlan.day,
          placeName: firebasePlan.placeName,
          startTime: firebasePlan.startTime,
          endTime: firebasePlan.endTime,
          type: firebasePlan.type as Plan['type'],
          address: firebasePlan.address,
          memo: firebasePlan.memo,
          photos,
          youtubeLink: firebasePlan.youtubeLink,
          mapUrl: firebasePlan.mapUrl,
          latitude: firebasePlan.latitude,
          longitude: firebasePlan.longitude,
          createdAt: convertTimestamp(firebasePlan.createdAt),
          updatedAt: convertTimestamp(firebasePlan.updatedAt),
        }

        await db.addPlan(planData)
        result.plansImported++
      } catch (error) {
        result.errors.push(`일정 "${firebasePlan.placeName}" 가져오기 실패: ${error}`)
      }
    }

    // Import places
    const places = data.places || []
    for (let i = 0; i < places.length; i++) {
      const firebasePlace = places[i]
      onProgress?.({
        phase: 'places',
        current: i + 1,
        total: places.length,
        message: `장소 가져오기: ${firebasePlace.name}`,
      })

      try {
        const placeData: Omit<Place, 'id'> = {
          name: firebasePlace.name,
          type: firebasePlace.type as Place['type'],
          address: firebasePlace.address,
          memo: firebasePlace.memo,
          latitude: firebasePlace.latitude,
          longitude: firebasePlace.longitude,
          isFavorite: firebasePlace.isFavorite || false,
          usageCount: firebasePlace.usageCount || 0,
          createdAt: convertTimestamp(firebasePlace.createdAt),
          updatedAt: convertTimestamp(firebasePlace.updatedAt),
        }

        await db.addPlace(placeData)
        result.placesImported++
      } catch (error) {
        result.errors.push(`장소 "${firebasePlace.name}" 가져오기 실패: ${error}`)
      }
    }

    onProgress?.({
      phase: 'complete',
      current: 1,
      total: 1,
      message: '가져오기 완료',
    })

    result.success = result.errors.length === 0
  } catch (error) {
    result.errors.push(`마이그레이션 실패: ${error}`)
  }

  return result
}

/**
 * Export current data in Firebase-compatible format
 * Useful for data interchange between systems
 */
export async function exportToFirebaseFormat(): Promise<string> {
  const data = await db.exportAllData()

  const firebaseFormat: FirebaseExportData = {
    version: data.version,
    exportDate: new Date().toISOString(),
    trips: data.trips.map((trip) => ({
      ...trip,
      id: String(trip.id),
      createdAt: trip.createdAt.toISOString(),
      updatedAt: trip.updatedAt.toISOString(),
    })),
    plans: data.plans.map((plan) => ({
      ...plan,
      id: String(plan.id),
      tripId: String(plan.tripId),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    })),
    places: data.places.map((place) => ({
      ...place,
      id: String(place.id),
      createdAt: place.createdAt.toISOString(),
      updatedAt: place.updatedAt.toISOString(),
    })),
  }

  return JSON.stringify(firebaseFormat, null, 2)
}

/**
 * Validate a backup file before import
 */
export function validateBackupFile(jsonData: string): {
  valid: boolean
  error?: string
  stats?: {
    trips: number
    plans: number
    places: number
  }
} {
  try {
    const data = JSON.parse(jsonData)

    if (!validateImportData(data)) {
      return {
        valid: false,
        error: '유효하지 않은 백업 파일 형식입니다',
      }
    }

    return {
      valid: true,
      stats: {
        trips: data.trips?.length || 0,
        plans: data.plans?.length || 0,
        places: data.places?.length || 0,
      },
    }
  } catch {
    return {
      valid: false,
      error: 'JSON 파싱 오류: 파일이 손상되었거나 유효하지 않습니다',
    }
  }
}
