// ============================================
// Image Sync Service
// Firebase Storage upload/download for images
// (coverImage for trips, photos for plans/places)
// ============================================

import {
  ref,
  uploadBytes,
  getBlob,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage'
import { doc, updateDoc } from 'firebase/firestore'
import { getFirebaseStorage, getFirebaseDb } from '@/services/firebase'
import { base64ToBlob, getImageFormat } from '@/services/imageStorage'
import { db as dexieDb } from '@/services/database'
import type { Trip, Plan, Place, TravelLog } from '@/types'

// ============================================
// Constants
// ============================================

const MAX_CONCURRENT = 3

// ============================================
// Download Queue (deduplication + concurrency limit)
// ============================================

type DownloadTask = () => Promise<void>

class DownloadQueue {
  private running = 0
  private queue: Array<{ key: string; task: DownloadTask; resolve: () => void; reject: (e: unknown) => void }> = []
  private inflight = new Map<string, Promise<void>>()

  enqueue(key: string, task: DownloadTask): Promise<void> {
    // Deduplicate: 이미 같은 key가 큐/실행 중이면 그 promise를 그대로 반환한다.
    // 기존엔 Promise.resolve()를 반환해 호출부의 onComplete가 실제 다운로드 완료 전에
    // 즉시 발화되고, 두 번째(더 최신일 수 있는) task가 통째로 누락됐다.
    const existing = this.inflight.get(key)
    if (existing) return existing

    const p = new Promise<void>((resolve, reject) => {
      this.queue.push({ key, task, resolve, reject })
      this.flush()
    })
    this.inflight.set(key, p)
    return p
  }

  private flush(): void {
    while (this.running < MAX_CONCURRENT && this.queue.length > 0) {
      const item = this.queue.shift()!
      this.running++
      item.task()
        .then(item.resolve)
        .catch(item.reject)
        .finally(() => {
          this.running--
          this.inflight.delete(item.key)
          this.flush()
        })
    }
  }
}

const downloadQueue = new DownloadQueue()

/**
 * Schedule an image download through the deduplicated queue.
 * Returns immediately (fire-and-forget with proper error logging).
 */
export function scheduleImageDownload(
  key: string,
  task: DownloadTask,
  onComplete?: () => void,
): void {
  downloadQueue.enqueue(key, task)
    .then(() => { onComplete?.() })
    .catch((e) => { console.error('[ImageSync] Queued download failed:', key, e) })
}

// ============================================
// Core Upload / Download
// ============================================

async function uploadImageToStorage(storagePath: string, base64: string): Promise<void> {
  const storage = getFirebaseStorage()
  const blob = base64ToBlob(base64)
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, blob, { contentType: blob.type })
}

async function downloadImageFromStorage(storagePath: string): Promise<string> {
  const storage = getFirebaseStorage()
  const storageRef = ref(storage, storagePath)

  let blob: Blob
  try {
    blob = await getBlob(storageRef)
  } catch (e) {
    // Fallback: getDownloadURL + fetch (works if CORS is configured or same-origin)
    console.warn('[ImageSync] getBlob failed, falling back to getDownloadURL:', storagePath, e)
    const url = await getDownloadURL(storageRef)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Image fetch failed: ${response.status}`)
    blob = await response.blob()
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ============================================
// Trip Cover Image
// ============================================

export async function uploadTripCoverImage(userId: string, trip: Trip): Promise<void> {
  if (!trip.firebaseId || !trip.coverImage) return

  const ext = getImageFormat(trip.coverImage)
  const storagePath = `users/${userId}/trips/${trip.firebaseId}/cover.${ext}`

  try {
    await uploadImageToStorage(storagePath, trip.coverImage)

    // Update Firestore doc with storage path
    const firestore = getFirebaseDb()
    const tripRef = doc(firestore, 'users', userId, 'trips', trip.firebaseId)
    await updateDoc(tripRef, { coverImagePath: storagePath })

    // Update local record
    if (trip.id) {
      await dexieDb.trips.update(trip.id, { coverImagePath: storagePath })
    }

    console.log('[ImageSync] Uploaded trip cover:', trip.firebaseId)
  } catch (error) {
    console.error('[ImageSync] Failed to upload trip cover:', trip.firebaseId, error)
  }
}

export async function downloadTripCoverImage(trip: Trip): Promise<void> {
  if (!trip.coverImagePath || !trip.id) return
  if (trip.coverImage) return // Already have local Base64

  try {
    const base64 = await downloadImageFromStorage(trip.coverImagePath)
    await dexieDb.trips.update(trip.id, { coverImage: base64 })
    console.log('[ImageSync] Downloaded trip cover:', trip.id)
  } catch (error) {
    console.error('[ImageSync] Failed to download trip cover:', trip.id, error)
  }
}

// ============================================
// Plan Photos
// ============================================

export async function uploadPlanPhotos(userId: string, plan: Plan): Promise<void> {
  if (!plan.firebaseId || !plan.photos?.length) return

  const results = await Promise.allSettled(
    plan.photos.map(async (photo, i) => {
      if (!photo) return ''
      const ext = getImageFormat(photo)
      const storagePath = `users/${userId}/plans/${plan.firebaseId}/photo_${i}.${ext}`
      await uploadImageToStorage(storagePath, photo)
      return storagePath
    })
  )
  const paths = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    console.error(`[ImageSync] Failed to upload plan photo ${i}:`, plan.firebaseId, r.reason)
    return ''
  })

  const validCount = paths.filter((p) => p !== '').length
  if (validCount > 0) {
    try {
      const firestore = getFirebaseDb()
      const planRef = doc(firestore, 'users', userId, 'plans', plan.firebaseId)
      await updateDoc(planRef, { photoPaths: paths })

      if (plan.id) {
        await dexieDb.plans.update(plan.id, { photoPaths: paths })
      }
      console.log('[ImageSync] Uploaded plan photos:', plan.firebaseId, `${validCount}/${plan.photos.length}`)
    } catch (error) {
      console.error('[ImageSync] Failed to update plan photoPaths:', plan.firebaseId, error)
    }
  }
}

export async function downloadPlanPhotos(plan: Plan): Promise<void> {
  if (!plan.photoPaths?.length || !plan.id) return
  if (plan.photos?.length) return // Already have local photos

  const results = await Promise.allSettled(
    plan.photoPaths
      .filter((path): path is string => !!path)
      .map(path => downloadImageFromStorage(path))
  )
  const photos = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .map(r => r.value)
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('[ImageSync] Failed to download plan photo:', plan.photoPaths![i], r.reason)
  })

  if (photos.length > 0) {
    await dexieDb.plans.update(plan.id, { photos })
    console.log('[ImageSync] Downloaded plan photos:', plan.id, photos.length)
  }
}

// ============================================
// Place Photos
// ============================================

export async function uploadPlacePhotos(userId: string, place: Place): Promise<void> {
  if (!place.firebaseId || !place.photos?.length) return

  const results = await Promise.allSettled(
    place.photos.map(async (photo, i) => {
      if (!photo) return ''
      const ext = getImageFormat(photo)
      const storagePath = `users/${userId}/places/${place.firebaseId}/photo_${i}.${ext}`
      await uploadImageToStorage(storagePath, photo)
      return storagePath
    })
  )
  const paths = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    console.error(`[ImageSync] Failed to upload place photo ${i}:`, place.firebaseId, r.reason)
    return ''
  })

  const validCount = paths.filter((p) => p !== '').length
  if (validCount > 0) {
    try {
      const firestore = getFirebaseDb()
      const placeRef = doc(firestore, 'users', userId, 'places', place.firebaseId)
      await updateDoc(placeRef, { photoPaths: paths })

      if (place.id) {
        await dexieDb.places.update(place.id, { photoPaths: paths })
      }
      console.log('[ImageSync] Uploaded place photos:', place.firebaseId, `${validCount}/${place.photos.length}`)
    } catch (error) {
      console.error('[ImageSync] Failed to update place photoPaths:', place.firebaseId, error)
    }
  }
}

export async function downloadPlacePhotos(place: Place): Promise<void> {
  if (!place.photoPaths?.length || !place.id) return
  if (place.photos?.length) return // Already have local photos

  const results = await Promise.allSettled(
    place.photoPaths
      .filter((path): path is string => !!path)
      .map(path => downloadImageFromStorage(path))
  )
  const photos = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
    .map(r => r.value)
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('[ImageSync] Failed to download place photo:', place.photoPaths![i], r.reason)
  })

  if (photos.length > 0) {
    await dexieDb.places.update(place.id, { photos })
    console.log('[ImageSync] Downloaded place photos:', place.id, photos.length)
  }
}

// ============================================
// Travel Log Photos
// ============================================

export async function uploadTravelLogPhoto(userId: string, log: TravelLog): Promise<void> {
  if (!log.firebaseId) return

  try {
    const firestore = getFirebaseDb()
    const logRef = doc(firestore, 'users', userId, 'travelLogs', log.firebaseId)
    const uploads: Promise<void>[] = []

    // Upload main photo + thumbnail in parallel (PERF-04)
    if (log.photo) {
      uploads.push((async () => {
        const ext = getImageFormat(log.photo!)
        const storagePath = `users/${userId}/travelLogs/${log.firebaseId}/photo.${ext}`
        await uploadImageToStorage(storagePath, log.photo!)
        await updateDoc(logRef, { photoPath: storagePath })
        if (log.id) await dexieDb.travelLogs.update(log.id, { photoPath: storagePath })
      })())
    }

    if (log.thumbnailPhoto) {
      uploads.push((async () => {
        const thumbExt = getImageFormat(log.thumbnailPhoto!)
        const thumbPath = `users/${userId}/travelLogs/${log.firebaseId}/thumb.${thumbExt}`
        await uploadImageToStorage(thumbPath, log.thumbnailPhoto!)
        await updateDoc(logRef, { thumbnailPhotoPath: thumbPath })
        if (log.id) await dexieDb.travelLogs.update(log.id, { thumbnailPhotoPath: thumbPath })
      })())
    }

    await Promise.allSettled(uploads)
    console.log('[ImageSync] Uploaded travel log photo:', log.firebaseId)
  } catch (error) {
    console.error('[ImageSync] Failed to upload travel log photo:', error)
  }
}

export async function downloadTravelLogPhoto(log: TravelLog): Promise<void> {
  if (!log.id) return

  try {
    const updates: Partial<TravelLog> = {}
    const downloads: Promise<void>[] = []

    // Download main photo + thumbnail in parallel (PERF-04)
    if (log.photoPath && !log.photo) {
      downloads.push(
        downloadImageFromStorage(log.photoPath).then(b64 => { updates.photo = b64 })
      )
    }

    if (log.thumbnailPhotoPath && !log.thumbnailPhoto) {
      downloads.push(
        downloadImageFromStorage(log.thumbnailPhotoPath).then(b64 => { updates.thumbnailPhoto = b64 })
      )
    }

    await Promise.allSettled(downloads)

    if (Object.keys(updates).length > 0) {
      await dexieDb.travelLogs.update(log.id, updates)
      console.log('[ImageSync] Downloaded travel log photo:', log.id)
    }
  } catch (error) {
    console.error('[ImageSync] Failed to download travel log photo:', error)
  }
}

// ============================================
// Deletion
// ============================================

export async function deleteEntityImages(
  userId: string,
  entityType: 'trips' | 'plans' | 'places' | 'travelLogs',
  entityFirebaseId: string,
): Promise<void> {
  const storage = getFirebaseStorage()
  const folderRef = ref(storage, `users/${userId}/${entityType}/${entityFirebaseId}`)

  try {
    const result = await listAll(folderRef)
    if (result.items.length > 0) {
      await Promise.allSettled(result.items.map((item) => deleteObject(item)))
      console.log('[ImageSync] Deleted images for:', entityType, entityFirebaseId)
    }
  } catch (error) {
    // listAll may throw if folder doesn't exist — that's OK
    console.warn('[ImageSync] Delete folder warning:', entityType, entityFirebaseId, error)
  }
}

// ============================================
// Bulk Sync (called after initial metadata sync)
// ============================================

export async function syncAllImagesBackground(
  userId: string,
  onProgress?: (step: string) => void,
): Promise<void> {
  // ── Phase 1: Upload local images missing from cloud ──
  onProgress?.('이미지 업로드 확인 중...')

  const uploadTasks: (() => Promise<void>)[] = []

  const trips = await dexieDb.trips.toArray()
  for (const trip of trips) {
    if (trip.coverImage && trip.firebaseId && !trip.coverImagePath) {
      uploadTasks.push(() => uploadTripCoverImage(userId, trip))
    }
  }

  const plans = await dexieDb.plans.toArray()
  for (const plan of plans) {
    if (plan.photos?.length && plan.firebaseId && !plan.photoPaths?.length) {
      uploadTasks.push(() => uploadPlanPhotos(userId, plan))
    }
  }

  const places = await dexieDb.places.toArray()
  for (const place of places) {
    if (place.photos?.length && place.firebaseId && !place.photoPaths?.length) {
      uploadTasks.push(() => uploadPlacePhotos(userId, place))
    }
  }

  const travelLogs = await dexieDb.travelLogs.toArray()
  for (const log of travelLogs) {
    if (log.photo && log.firebaseId && !log.photoPath) {
      uploadTasks.push(() => uploadTravelLogPhoto(userId, log))
    }
  }

  if (uploadTasks.length > 0) {
    onProgress?.(`이미지 업로드 중 (0/${uploadTasks.length})...`)
    for (let i = 0; i < uploadTasks.length; i += MAX_CONCURRENT) {
      const batch = uploadTasks.slice(i, i + MAX_CONCURRENT)
      await Promise.allSettled(batch.map((fn) => fn()))
      const done = Math.min(i + MAX_CONCURRENT, uploadTasks.length)
      onProgress?.(`이미지 업로드 중 (${done}/${uploadTasks.length})...`)
    }
  }

  // ── Phase 2: Download cloud images missing locally ──
  onProgress?.('이미지 다운로드 확인 중...')

  const downloadTasks: (() => Promise<void>)[] = []

  // Re-read entities (paths may have been updated during upload phase)
  const freshTrips = await dexieDb.trips.toArray()
  for (const trip of freshTrips) {
    if (!trip.coverImage && trip.coverImagePath) {
      downloadTasks.push(() => downloadTripCoverImage(trip))
    }
  }

  const freshPlans = await dexieDb.plans.toArray()
  for (const plan of freshPlans) {
    if ((!plan.photos || plan.photos.length === 0) && plan.photoPaths?.length) {
      downloadTasks.push(() => downloadPlanPhotos(plan))
    }
  }

  const freshPlaces = await dexieDb.places.toArray()
  for (const place of freshPlaces) {
    if ((!place.photos || place.photos.length === 0) && place.photoPaths?.length) {
      downloadTasks.push(() => downloadPlacePhotos(place))
    }
  }

  const freshLogs = await dexieDb.travelLogs.toArray()
  for (const log of freshLogs) {
    if (!log.photo && log.photoPath) {
      downloadTasks.push(() => downloadTravelLogPhoto(log))
    }
  }

  if (downloadTasks.length > 0) {
    onProgress?.(`이미지 다운로드 중 (0/${downloadTasks.length})...`)
    for (let i = 0; i < downloadTasks.length; i += MAX_CONCURRENT) {
      const batch = downloadTasks.slice(i, i + MAX_CONCURRENT)
      await Promise.allSettled(batch.map((fn) => fn()))
      const done = Math.min(i + MAX_CONCURRENT, downloadTasks.length)
      onProgress?.(`이미지 다운로드 중 (${done}/${downloadTasks.length})...`)
    }
  }

  if (uploadTasks.length > 0 || downloadTasks.length > 0) {
    onProgress?.('이미지 동기화 완료')
  }
}
