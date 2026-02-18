// ============================================
// Firestore Sync Service
// IndexedDB ↔ Firestore 실시간 동기화
// ============================================

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  Timestamp,
  type DocumentData,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore'
import { getFirebaseDb } from '@/services/firebase'
import { db as dexieDb } from '@/services/database'
import * as database from '@/services/database'
import type { Trip, Plan, Place, Settings, RouteSegment, TravelLog, SyncProgress } from '@/types'
import { detectConflicts, extractMergeableFields } from '@/utils/syncConflict'
import { useSyncConflictStore } from '@/stores/syncConflictStore'

// ============================================
// Helpers
// ============================================

/** Recursively replace undefined values with null (Firestore rejects undefined) */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      result[key] = null
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp) && !(value instanceof Date)) {
      result[key] = stripUndefined(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}

function toTimestamp(date: Date | string | undefined | null): Timestamp | null {
  if (!date) return null
  if (date instanceof Date) return Timestamp.fromDate(date)
  return Timestamp.fromDate(new Date(date as string))
}

function fromTimestamp(ts: Timestamp | null | undefined): Date {
  if (!ts || typeof ts.toDate !== 'function') return new Date(0)
  return ts.toDate()
}

function dateToMs(date: Date | string | undefined | null): number {
  if (!date) return 0
  if (date instanceof Date) return date.getTime()
  return new Date(date as string).getTime()
}

// ============================================
// Retry Helper
// ============================================

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  try {
    return await fn()
  } catch (firstError) {
    console.warn(`[Sync] ${label} failed, retrying in 2s...`, firstError)
    await new Promise(resolve => setTimeout(resolve, 2000))
    return await fn()
  }
}

// ============================================
// Converters: Local → Firestore
// ============================================

/** coverImage is intentionally excluded — Firestore 1MB doc limit; use Cloud Storage for binary data */
function tripToFirestore(trip: Trip): DocumentData {
  return {
    title: trip.title,
    country: trip.country,
    timezone: trip.timezone || null,
    startDate: trip.startDate,
    endDate: trip.endDate,
    plansCount: trip.plansCount || 0,
    isFavorite: trip.isFavorite,
    shareId: trip.shareId || null,
    coverImagePath: trip.coverImagePath || null,
    createdAt: toTimestamp(trip.createdAt),
    updatedAt: toTimestamp(trip.updatedAt),
  }
}

/** photos is intentionally excluded — Firestore 1MB doc limit; use Cloud Storage for binary data */
function planToFirestore(plan: Plan): DocumentData {
  return {
    tripFirebaseId: plan.tripFirebaseId || '',
    day: plan.day,
    order: plan.order ?? null,
    placeName: plan.placeName,
    startTime: plan.startTime,
    endTime: plan.endTime || null,
    type: plan.type,
    address: plan.address || null,
    website: plan.website || null,
    openingHours: plan.openingHours || null,
    memo: plan.memo || null,
    youtubeLink: plan.youtubeLink || null,
    mapUrl: plan.mapUrl || null,
    latitude: plan.latitude ?? null,
    longitude: plan.longitude ?? null,
    googlePlaceId: plan.googlePlaceId || null,
    googleInfo: plan.googleInfo
      ? stripUndefined({ ...plan.googleInfo, extractedAt: toTimestamp(plan.googleInfo.extractedAt) })
      : null,
    audioScript: plan.audioScript || null,
    photoPaths: plan.photoPaths || null,
    createdAt: toTimestamp(plan.createdAt),
    updatedAt: toTimestamp(plan.updatedAt),
  }
}

/** photos is intentionally excluded — Firestore 1MB doc limit; use Cloud Storage for binary data */
function placeToFirestore(place: Place): DocumentData {
  return {
    name: place.name,
    type: place.type,
    address: place.address || null,
    memo: place.memo || null,
    audioScript: place.audioScript || null,
    rating: place.rating ?? null,
    mapUrl: place.mapUrl || null,
    website: place.website || null,
    googlePlaceId: place.googlePlaceId || null,
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
    isFavorite: place.isFavorite,
    usageCount: place.usageCount,
    photoPaths: place.photoPaths || null,
    createdAt: toTimestamp(place.createdAt),
    updatedAt: toTimestamp(place.updatedAt),
  }
}

function settingsToFirestore(settings: Settings): DocumentData {
  return {
    theme: settings.theme,
    colorPalette: settings.colorPalette,
    language: settings.language,
    isMusicPlayerEnabled: settings.isMusicPlayerEnabled,
    lastBackupDate: toTimestamp(settings.lastBackupDate),
    settingsUpdatedAt: toTimestamp(settings.settingsUpdatedAt),
    detectedTimezone: settings.detectedTimezone || null,
    timezoneAutoDetect: settings.timezoneAutoDetect,
    mapProvider: settings.mapProvider || 'google',
    defaultTravelMode: settings.defaultTravelMode || 'DRIVE',
    claudeModel: settings.claudeModel || 'sonnet',
    claudeEnabled: settings.claudeEnabled ?? false,
    // NOTE: claudeApiKey is intentionally excluded — stored in localStorage only
    updatedAt: Timestamp.now(),
  }
}

function routeSegmentToFirestore(segment: RouteSegment): DocumentData {
  return {
    tripFirebaseId: segment.tripFirebaseId || '',
    fromPlanId: segment.fromPlanId,
    toPlanId: segment.toPlanId,
    fromCoords: segment.fromCoords,
    toCoords: segment.toCoords,
    travelMode: segment.travelMode,
    distanceMeters: segment.distanceMeters,
    duration: segment.duration,
    durationText: segment.durationText,
    distanceText: segment.distanceText,
    encodedPolyline: segment.encodedPolyline,
    cachedAt: toTimestamp(segment.cachedAt),
    updatedAt: toTimestamp(segment.updatedAt),
  }
}

function firestoreToRouteSegmentData(data: DocumentData): Omit<RouteSegment, 'id' | 'tripId'> {
  return {
    tripFirebaseId: data.tripFirebaseId || '',
    fromPlanId: data.fromPlanId,
    toPlanId: data.toPlanId,
    fromCoords: data.fromCoords,
    toCoords: data.toCoords,
    travelMode: data.travelMode,
    distanceMeters: data.distanceMeters,
    duration: data.duration,
    durationText: data.durationText,
    distanceText: data.distanceText,
    encodedPolyline: data.encodedPolyline,
    cachedAt: fromTimestamp(data.cachedAt),
    updatedAt: fromTimestamp(data.updatedAt),
  }
}

function travelLogToFirestore(log: TravelLog): DocumentData {
  return stripUndefined({
    tripFirebaseId: log.tripFirebaseId || '',
    day: log.day,
    timestamp: log.timestamp,
    type: log.type,
    photoPath: log.photoPath || null,
    thumbnailPhotoPath: log.thumbnailPhotoPath || null,
    exif: log.exif || null,
    latitude: log.latitude ?? null,
    longitude: log.longitude ?? null,
    address: log.address || null,
    placeName: log.placeName || null,
    memo: log.memo || null,
    expense: log.expense || null,
    createdAt: toTimestamp(log.createdAt),
    updatedAt: toTimestamp(log.updatedAt),
  } as Record<string, unknown>)
}

function firestoreToTravelLogData(data: DocumentData): Omit<TravelLog, 'id' | 'tripId' | 'photo' | 'thumbnailPhoto'> {
  return {
    tripFirebaseId: data.tripFirebaseId || '',
    day: data.day || 1,
    timestamp: data.timestamp || new Date().toISOString(),
    type: data.type || 'photo',
    photoPath: data.photoPath || undefined,
    thumbnailPhotoPath: data.thumbnailPhotoPath || undefined,
    exif: data.exif || undefined,
    latitude: data.latitude ?? undefined,
    longitude: data.longitude ?? undefined,
    address: data.address || undefined,
    placeName: data.placeName || undefined,
    memo: data.memo || undefined,
    expense: data.expense || undefined,
    createdAt: fromTimestamp(data.createdAt),
    updatedAt: fromTimestamp(data.updatedAt),
  }
}

// ============================================
// Converters: Firestore → Local (partial)
// ============================================

function firestoreToTripData(data: DocumentData): Omit<Trip, 'id' | 'coverImage'> & { firebaseId?: string } {
  return {
    title: data.title,
    country: data.country,
    timezone: data.timezone || undefined,
    startDate: data.startDate,
    endDate: data.endDate,
    plansCount: data.plansCount || 0,
    isFavorite: data.isFavorite ?? false,
    shareId: data.shareId || undefined,
    coverImagePath: data.coverImagePath || undefined,
    createdAt: fromTimestamp(data.createdAt),
    updatedAt: fromTimestamp(data.updatedAt),
  }
}

function firestoreToPlanData(data: DocumentData): Omit<Plan, 'id' | 'tripId' | 'photos'> {
  return {
    tripFirebaseId: data.tripFirebaseId || '',
    day: data.day,
    order: data.order ?? 0,
    placeName: data.placeName,
    startTime: data.startTime,
    endTime: data.endTime || undefined,
    type: data.type,
    address: data.address || undefined,
    website: data.website || undefined,
    openingHours: data.openingHours || undefined,
    memo: data.memo || undefined,
    youtubeLink: data.youtubeLink || undefined,
    mapUrl: data.mapUrl || undefined,
    latitude: data.latitude ?? undefined,
    longitude: data.longitude ?? undefined,
    googlePlaceId: data.googlePlaceId || undefined,
    googleInfo: data.googleInfo
      ? { ...data.googleInfo, extractedAt: fromTimestamp(data.googleInfo.extractedAt) }
      : undefined,
    audioScript: data.audioScript || undefined,
    photoPaths: data.photoPaths || undefined,
    createdAt: fromTimestamp(data.createdAt),
    updatedAt: fromTimestamp(data.updatedAt),
  }
}

function firestoreToPlaceData(data: DocumentData): Omit<Place, 'id' | 'photos'> {
  return {
    name: data.name,
    type: data.type,
    address: data.address || undefined,
    memo: data.memo || undefined,
    audioScript: data.audioScript || undefined,
    rating: data.rating ?? undefined,
    mapUrl: data.mapUrl || undefined,
    website: data.website || undefined,
    googlePlaceId: data.googlePlaceId || undefined,
    latitude: data.latitude ?? undefined,
    longitude: data.longitude ?? undefined,
    isFavorite: data.isFavorite ?? false,
    usageCount: data.usageCount ?? 0,
    photoPaths: data.photoPaths || undefined,
    createdAt: fromTimestamp(data.createdAt),
    updatedAt: fromTimestamp(data.updatedAt),
  }
}

// ============================================
// SyncManager
// ============================================

type SyncCallback = () => void
type SyncStatusCallback = (progress: SyncProgress) => void

class SyncManager {
  private userId: string | null = null
  private unsubscribers: Unsubscribe[] = []
  private syncCallbacks: SyncCallback[] = []
  private activeCallbacks: SyncCallback[] = []
  private statusCallbacks: SyncStatusCallback[] = []
  private isSyncing = false
  private _isActive = false
  private recentlyPushed = new Set<string>()
  private pendingDeletes = new Set<string>()
  private mergeInProgress = false
  private syncGeneration = 0
  private notifyTimer: ReturnType<typeof setTimeout> | null = null
  private static readonly NOTIFY_DEBOUNCE_MS = 300
  private static readonly CONCURRENT_EDIT_THRESHOLD_MS = 60_000

  // Cooldown: skip initial sync if recently synced (per-tab via sessionStorage)
  private static readonly SYNC_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes
  private static readonly SESSION_KEY_PREFIX = 'travel_v4_last_sync_'

  private isSyncFresh(userId: string): boolean {
    try {
      const key = `${SyncManager.SESSION_KEY_PREFIX}${userId}`
      const stored = sessionStorage.getItem(key)
      if (!stored) return false
      return Date.now() - parseInt(stored, 10) < SyncManager.SYNC_COOLDOWN_MS
    } catch {
      return false
    }
  }

  private markSyncComplete(userId: string): void {
    try {
      sessionStorage.setItem(
        `${SyncManager.SESSION_KEY_PREFIX}${userId}`,
        String(Date.now()),
      )
    } catch { /* ignore */ }
  }

  // ---- Echo Suppression (time-based 10s auto-cleanup) ----

  private markPushed(key: string): void {
    this.recentlyPushed.add(key)
    setTimeout(() => this.recentlyPushed.delete(key), 10_000)
  }

  private isEcho(key: string): boolean {
    return this.recentlyPushed.has(key)
  }

  // ---- Recently Resolved (skip conflict re-detection for 15s) ----
  private recentlyResolved = new Set<string>()

  markResolved(entityType: string, firebaseId: string): void {
    const key = `${entityType}:${firebaseId}`
    this.recentlyResolved.add(key)
    setTimeout(() => this.recentlyResolved.delete(key), 15_000)
  }

  private isRecentlyResolved(entityType: string, firebaseId: string): boolean {
    return this.recentlyResolved.has(`${entityType}:${firebaseId}`)
  }

  // ---- Pending Deletes (undo window protection) ----

  addPendingDelete(firebaseId: string): void {
    this.pendingDeletes.add(firebaseId)
  }

  removePendingDelete(firebaseId: string): void {
    this.pendingDeletes.delete(firebaseId)
  }

  private isPendingDelete(firebaseId: string): boolean {
    return this.pendingDeletes.has(firebaseId)
  }

  // ---- Lifecycle ----

  async start(userId: string): Promise<void> {
    const generation = ++this.syncGeneration
    await this.stop()
    this.userId = userId
    console.log('[Sync] Starting for user:', userId)

    try {
      const needsInitialSync = !this.isSyncFresh(userId)

      if (needsInitialSync) {
        await this.performInitialSync(generation)
      } else {
        console.log('[Sync] Skipping initial sync (synced recently)')
        this.notifySyncStatus({ status: 'done', step: '동기화 완료', skipped: true })
        this.notifyUpdate()
      }

      // Verify this start() hasn't been superseded
      if (this.syncGeneration !== generation) {
        console.log('[Sync] Start cancelled (superseded by newer start)')
        return
      }

      this.recentlyPushed.clear()
      this.startRealtimeListeners()
      this._isActive = true
      this.notifyActiveChange()

      if (needsInitialSync) {
        this.markSyncComplete(userId)
      }

      console.log('[Sync] Ready')
    } catch (error) {
      if (this.syncGeneration !== generation) return
      console.error('[Sync] Start failed:', error)
      this.userId = null
    }
  }

  async stop(): Promise<void> {
    // Flush any pending batch writes before stopping
    try {
      await this.flushBatch()
    } catch (e) {
      console.error('[Sync] Flush on stop failed:', e)
    }

    for (const unsub of this.unsubscribers) unsub()
    this.unsubscribers = []
    this.userId = null
    this.isSyncing = false
    this.mergeInProgress = false
    this.recentlyPushed.clear()
    this.pendingDeletes.clear()
    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer)
      this.notifyTimer = null
    }
    if (this._isActive) {
      this._isActive = false
      this.notifyActiveChange()
    }
    console.log('[Sync] Stopped')
  }

  onSyncUpdate(callback: SyncCallback): () => void {
    this.syncCallbacks.push(callback)
    return () => {
      this.syncCallbacks = this.syncCallbacks.filter((cb) => cb !== callback)
    }
  }

  private notifyUpdate(): void {
    for (const cb of this.syncCallbacks) {
      try { cb() } catch (e) { console.error('[Sync] Callback error:', e) }
    }
  }

  private notifyUpdateDebounced(): void {
    if (this.notifyTimer) clearTimeout(this.notifyTimer)
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null
      this.notifyUpdate()
    }, SyncManager.NOTIFY_DEBOUNCE_MS)
  }

  isActive(): boolean {
    return this._isActive
  }

  onActiveChange(callback: SyncCallback): () => void {
    this.activeCallbacks.push(callback)
    return () => {
      this.activeCallbacks = this.activeCallbacks.filter((cb) => cb !== callback)
    }
  }

  private notifyActiveChange(): void {
    for (const cb of this.activeCallbacks) {
      try { cb() } catch (e) { console.error('[Sync] Active change callback error:', e) }
    }
  }

  onSyncStatus(callback: SyncStatusCallback): () => void {
    this.statusCallbacks.push(callback)
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter((cb) => cb !== callback)
    }
  }

  private notifySyncStatus(progress: SyncProgress): void {
    for (const cb of this.statusCallbacks) {
      try { cb(progress) } catch (e) { console.error('[Sync] Status callback error:', e) }
    }
  }

  // ============================================
  // Initial Sync
  // ============================================

  private async performInitialSync(generation: number): Promise<void> {
    if (!this.userId || this.isSyncing) return
    this.isSyncing = true
    this.mergeInProgress = true

    try {
      // Count local-only items before sync
      this.notifySyncStatus({ status: 'checking', step: '로컬 데이터 확인 중...' })
      const localTrips = await dexieDb.trips.toArray()
      const localPlans = await dexieDb.plans.toArray()
      const localPlaces = await dexieDb.places.toArray()
      const localOnlyCount =
        localTrips.filter((t) => !t.firebaseId).length +
        localPlans.filter((p) => !p.firebaseId).length +
        localPlaces.filter((p) => !p.firebaseId).length

      if (this.syncGeneration !== generation) return

      if (localOnlyCount > 0) {
        this.notifySyncStatus({
          status: 'syncing',
          step: `양방향 동기화 중... (로컬 전용 ${localOnlyCount}건 업로드 예정)`,
          localOnlyCount,
        })
      } else {
        this.notifySyncStatus({ status: 'syncing', step: '여행 동기화 중...' })
      }

      try { await this.syncTripsInitial() } catch (e) { console.error('[Sync] Trips sync failed:', e) }
      if (this.syncGeneration !== generation) return

      this.notifySyncStatus({ status: 'syncing', step: '일정 동기화 중...' })
      try { await this.syncPlansInitial() } catch (e) { console.error('[Sync] Plans sync failed:', e) }
      if (this.syncGeneration !== generation) return

      this.notifySyncStatus({ status: 'syncing', step: '장소 동기화 중...' })
      try { await this.syncPlacesInitial() } catch (e) { console.error('[Sync] Places sync failed:', e) }
      if (this.syncGeneration !== generation) return

      this.notifySyncStatus({ status: 'syncing', step: '설정 동기화 중...' })
      try { await this.syncSettingsInitial() } catch (e) { console.error('[Sync] Settings sync failed:', e) }
      if (this.syncGeneration !== generation) return

      this.notifySyncStatus({ status: 'syncing', step: '경로 동기화 중...' })
      try { await this.syncRouteSegmentsInitial() } catch (e) { console.error('[Sync] RouteSegments sync failed:', e) }
      if (this.syncGeneration !== generation) return

      this.notifySyncStatus({ status: 'syncing', step: '여행 기록 동기화 중...' })
      try { await this.syncTravelLogsInitial() } catch (e) { console.error('[Sync] TravelLogs sync failed:', e) }
      if (this.syncGeneration !== generation) return

      // Image sync (background, non-blocking for metadata)
      this.notifySyncStatus({ status: 'syncing', step: '이미지 동기화 중...' })
      try {
        const { syncAllImagesBackground } = await import('@/services/imageSync')
        await syncAllImagesBackground(this.userId!, (step) => {
          if (this.syncGeneration !== generation) return
          this.notifySyncStatus({ status: 'syncing', step })
        })
      } catch (e) {
        console.error('[Sync] Image sync failed:', e)
      }
      if (this.syncGeneration !== generation) return

      this.notifySyncStatus({ status: 'done', step: '동기화 완료' })
      this.notifyUpdate()
    } catch (error) {
      if (this.syncGeneration !== generation) return
      console.error('[Sync] Initial sync error:', error)
      this.notifySyncStatus({
        status: 'error',
        step: '동기화 중 오류 발생',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      this.notifyUpdate()
    } finally {
      this.isSyncing = false
      this.mergeInProgress = false
    }
  }

  private async syncTripsInitial(): Promise<void> {
    if (!this.userId) return
    const firestore = getFirebaseDb()
    const tripsRef = collection(firestore, 'users', this.userId, 'trips')

    const [snapshot, localTrips] = await Promise.all([
      withRetry(() => getDocs(tripsRef), 'Trips fetch'),
      dexieDb.trips.toArray(),
    ])

    // Build remote map
    const remoteMap = new Map<string, { docId: string; data: DocumentData }>()
    for (const docSnap of snapshot.docs) {
      remoteMap.set(docSnap.id, { docId: docSnap.id, data: docSnap.data() })
    }

    // Build local map by firebaseId
    const localByFbId = new Map<string, Trip>()
    for (const trip of localTrips) {
      if (trip.firebaseId) localByFbId.set(trip.firebaseId, trip)
    }

    // Remote-only → create locally
    for (const [fbId, { data }] of remoteMap) {
      try {
        if (!localByFbId.has(fbId)) {
          const tripData = firestoreToTripData(data)
          await dexieDb.trips.add({
            ...tripData,
            firebaseId: fbId,
            coverImage: '',
            coverImagePath: data.coverImagePath || undefined,
          } as Trip)
        } else {
          // Both exist → newer wins
          const local = localByFbId.get(fbId)!
          const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
          const localMs = dateToMs(local.updatedAt)
          if (remoteMs > localMs) {
            // Cloud is newer → update local (preserve existing local coverImage)
            const tripData = firestoreToTripData(data)
            await dexieDb.trips.update(local.id!, { ...tripData, firebaseId: fbId, coverImage: local.coverImage || '' })
          } else if (localMs > remoteMs) {
            // Local is newer → push to cloud
            this.markPushed(`trip:${fbId}`)
            await setDoc(doc(tripsRef, fbId), tripToFirestore(local))
          }
        }
      } catch (e) {
        console.error('[Sync] Failed to sync trip:', fbId, e)
      }
    }

    // Local-only (no firebaseId) → push to cloud
    for (const trip of localTrips) {
      if (!trip.firebaseId && trip.id) {
        try {
          const newDocRef = doc(tripsRef)
          this.markPushed(`trip:${newDocRef.id}`)
          await setDoc(newDocRef, tripToFirestore(trip))
          await dexieDb.trips.update(trip.id, { firebaseId: newDocRef.id })
          console.log('[Sync] Pushed local-only trip to cloud:', trip.id, trip.title, '→', newDocRef.id)
        } catch (e) {
          console.error('[Sync] Failed to push local-only trip:', trip.id, e)
        }
      }
    }

    // Local has firebaseId but remote doesn't → re-upload to preserve data
    // (Real-time listeners handle active remote deletions during session)
    for (const trip of localTrips) {
      if (trip.firebaseId && !remoteMap.has(trip.firebaseId) && trip.id) {
        try {
          this.markPushed(`trip:${trip.firebaseId}`)
          await setDoc(doc(tripsRef, trip.firebaseId), tripToFirestore(trip))
          console.log('[Sync] Re-uploaded trip missing from cloud:', trip.firebaseId, trip.title)
        } catch (e) {
          console.error('[Sync] Failed to re-upload trip:', trip.firebaseId, e)
        }
      }
    }
  }

  private async syncPlansInitial(): Promise<void> {
    if (!this.userId) return
    const firestore = getFirebaseDb()
    const plansRef = collection(firestore, 'users', this.userId, 'plans')

    const [snapshot, localPlans] = await Promise.all([
      withRetry(() => getDocs(plansRef), 'Plans fetch'),
      dexieDb.plans.toArray(),
    ])

    const remoteMap = new Map<string, { docId: string; data: DocumentData }>()
    for (const docSnap of snapshot.docs) {
      remoteMap.set(docSnap.id, { docId: docSnap.id, data: docSnap.data() })
    }

    const localByFbId = new Map<string, Plan>()
    for (const plan of localPlans) {
      if (plan.firebaseId) localByFbId.set(plan.firebaseId, plan)
    }

    // Remote-only → create locally
    for (const [fbId, { data }] of remoteMap) {
      try {
        if (!localByFbId.has(fbId)) {
          const planData = firestoreToPlanData(data)
          const localTripId = await this.resolveLocalTripId(data.tripFirebaseId)
          if (localTripId === null) {
            console.warn('[Sync] Skipping plan - trip not found:', data.tripFirebaseId)
            continue
          }
          await dexieDb.plans.add({
            ...planData,
            firebaseId: fbId,
            tripId: localTripId,
            photos: [],
            photoPaths: data.photoPaths || undefined,
          } as Plan)
        } else {
          // Both exist → newer wins
          const local = localByFbId.get(fbId)!
          const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
          const localMs = dateToMs(local.updatedAt)
          if (remoteMs > localMs) {
            // Cloud is newer → update local (preserve existing local photos)
            const planData = firestoreToPlanData(data)
            await dexieDb.plans.update(local.id!, { ...planData, firebaseId: fbId, photos: local.photos || [] })
          } else if (localMs > remoteMs) {
            // Local is newer → push to cloud
            let tripFbId = local.tripFirebaseId
            if (!tripFbId) tripFbId = (await this.resolveTripFirebaseId(local.tripId)) || ''
            const planWithTripFbId = { ...local, tripFirebaseId: tripFbId }
            this.markPushed(`plan:${fbId}`)
            await setDoc(doc(plansRef, fbId), planToFirestore(planWithTripFbId))
          }
        }
      } catch (e) {
        console.error('[Sync] Failed to sync plan:', fbId, e)
      }
    }

    // Local-only (no firebaseId) → push to cloud
    for (const plan of localPlans) {
      if (!plan.firebaseId && plan.id) {
        try {
          let tripFbId = plan.tripFirebaseId
          if (!tripFbId) tripFbId = (await this.resolveTripFirebaseId(plan.tripId)) || ''
          if (!tripFbId) {
            console.warn('[Sync] Skipping local-only plan push — no tripFirebaseId:', plan.id)
            continue
          }
          const planWithTripFbId = { ...plan, tripFirebaseId: tripFbId }
          const newDocRef = doc(plansRef)
          this.markPushed(`plan:${newDocRef.id}`)
          await setDoc(newDocRef, planToFirestore(planWithTripFbId))
          await dexieDb.plans.update(plan.id, { firebaseId: newDocRef.id })
          console.log('[Sync] Pushed local-only plan to cloud:', plan.id, plan.placeName, '→', newDocRef.id)
        } catch (e) {
          console.error('[Sync] Failed to push local-only plan:', plan.id, e)
        }
      }
    }

    // Local has firebaseId but remote doesn't → re-upload to preserve data
    for (const plan of localPlans) {
      if (plan.firebaseId && !remoteMap.has(plan.firebaseId) && plan.id) {
        try {
          this.markPushed(`plan:${plan.firebaseId}`)
          await setDoc(doc(plansRef, plan.firebaseId), planToFirestore(plan))
          console.log('[Sync] Re-uploaded plan missing from cloud:', plan.firebaseId, plan.placeName)
        } catch (e) {
          console.error('[Sync] Failed to re-upload plan:', plan.firebaseId, e)
        }
      }
    }
  }

  private async syncPlacesInitial(): Promise<void> {
    if (!this.userId) return
    const firestore = getFirebaseDb()
    const placesRef = collection(firestore, 'users', this.userId, 'places')

    const [snapshot, localPlaces] = await Promise.all([
      withRetry(() => getDocs(placesRef), 'Places fetch'),
      dexieDb.places.toArray(),
    ])

    const remoteMap = new Map<string, { docId: string; data: DocumentData }>()
    for (const docSnap of snapshot.docs) {
      remoteMap.set(docSnap.id, { docId: docSnap.id, data: docSnap.data() })
    }

    const localByFbId = new Map<string, Place>()
    for (const place of localPlaces) {
      if (place.firebaseId) localByFbId.set(place.firebaseId, place)
    }

    for (const [fbId, { data }] of remoteMap) {
      try {
        if (!localByFbId.has(fbId)) {
          const placeData = firestoreToPlaceData(data)
          await dexieDb.places.add({
            ...placeData,
            firebaseId: fbId,
            photos: [],
            photoPaths: data.photoPaths || undefined,
          } as Place)
        } else {
          // Both exist → newer wins
          const local = localByFbId.get(fbId)!
          const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
          const localMs = dateToMs(local.updatedAt)
          if (remoteMs > localMs) {
            // Cloud is newer → update local (preserve existing local photos)
            const placeData = firestoreToPlaceData(data)
            await dexieDb.places.update(local.id!, { ...placeData, firebaseId: fbId, photos: local.photos || [] })
          } else if (localMs > remoteMs) {
            this.markPushed(`place:${fbId}`)
            await setDoc(doc(placesRef, fbId), placeToFirestore(local))
          }
        }
      } catch (e) {
        console.error('[Sync] Failed to sync place:', fbId, e)
      }
    }

    // Local-only (no firebaseId) → push to cloud
    for (const place of localPlaces) {
      if (!place.firebaseId && place.id) {
        try {
          const newDocRef = doc(placesRef)
          this.markPushed(`place:${newDocRef.id}`)
          await setDoc(newDocRef, placeToFirestore(place))
          await dexieDb.places.update(place.id, { firebaseId: newDocRef.id })
          console.log('[Sync] Pushed local-only place to cloud:', place.id, place.name, '→', newDocRef.id)
        } catch (e) {
          console.error('[Sync] Failed to push local-only place:', place.id, e)
        }
      }
    }

    // Local has firebaseId but remote doesn't → re-upload to preserve data
    for (const place of localPlaces) {
      if (place.firebaseId && !remoteMap.has(place.firebaseId) && place.id) {
        try {
          this.markPushed(`place:${place.firebaseId}`)
          await setDoc(doc(placesRef, place.firebaseId), placeToFirestore(place))
          console.log('[Sync] Re-uploaded place missing from cloud:', place.firebaseId, place.name)
        } catch (e) {
          console.error('[Sync] Failed to re-upload place:', place.firebaseId, e)
        }
      }
    }
  }

  private async syncSettingsInitial(): Promise<void> {
    if (!this.userId) return
    const firestore = getFirebaseDb()
    const settingsDocRef = doc(firestore, 'users', this.userId, 'settings', 'main')

    try {
      const { getDoc } = await import('firebase/firestore')
      const docSnap = await withRetry(() => getDoc(settingsDocRef), 'Settings fetch')
      const localSettings = await database.getSettings()

      if (docSnap.exists()) {
        const remoteData = docSnap.data()
        const remoteMs = dateToMs(fromTimestamp(remoteData.updatedAt))
        const localMs = dateToMs(localSettings.settingsUpdatedAt)

        if (remoteMs >= localMs) {
          // Remote is same or newer → apply remote
          await database.updateSettings({
            theme: remoteData.theme,
            colorPalette: remoteData.colorPalette,
            language: remoteData.language,
            isMusicPlayerEnabled: remoteData.isMusicPlayerEnabled,
            timezoneAutoDetect: remoteData.timezoneAutoDetect ?? true,
            detectedTimezone: remoteData.detectedTimezone || undefined,
            mapProvider: remoteData.mapProvider || 'google',
            defaultTravelMode: remoteData.defaultTravelMode || 'DRIVE',
            claudeModel: remoteData.claudeModel || 'sonnet',
            claudeEnabled: remoteData.claudeEnabled ?? false,
            settingsUpdatedAt: fromTimestamp(remoteData.settingsUpdatedAt),
          })
          console.log('[Sync] Applied remote settings (cloud wins)')
        } else {
          // Local is newer → push to cloud
          this.markPushed('settings')
          await setDoc(settingsDocRef, settingsToFirestore(localSettings))
          console.log('[Sync] Pushed local settings to cloud (local wins)')
        }
      } else {
        // No remote settings → seed Firebase with local defaults
        this.markPushed('settings')
        await setDoc(settingsDocRef, settingsToFirestore(localSettings))
        console.log('[Sync] Seeded Firebase with local settings (no remote)')
      }
    } catch (error) {
      console.error('[Sync] Settings sync error:', error)
    }
  }

  private async syncRouteSegmentsInitial(): Promise<void> {
    if (!this.userId) return
    const firestore = getFirebaseDb()
    const segmentsRef = collection(firestore, 'users', this.userId, 'routeSegments')

    const [snapshot, localSegments] = await Promise.all([
      withRetry(() => getDocs(segmentsRef), 'RouteSegments fetch'),
      dexieDb.routeSegments.toArray(),
    ])

    const remoteMap = new Map<string, { docId: string; data: DocumentData }>()
    for (const docSnap of snapshot.docs) {
      remoteMap.set(docSnap.id, { docId: docSnap.id, data: docSnap.data() })
    }

    const localByFbId = new Map<string, RouteSegment>()
    for (const seg of localSegments) {
      if (seg.firebaseId) localByFbId.set(seg.firebaseId, seg)
    }

    // Remote-only → create locally
    for (const [fbId, { data }] of remoteMap) {
      try {
        if (!localByFbId.has(fbId)) {
          const segData = firestoreToRouteSegmentData(data)
          const localTripId = await this.resolveLocalTripId(data.tripFirebaseId)
          if (localTripId === null) continue
          await dexieDb.routeSegments.add({
            ...segData,
            firebaseId: fbId,
            tripId: localTripId,
          } as RouteSegment)
        } else {
          // Both exist → newer wins
          const local = localByFbId.get(fbId)!
          const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
          const localMs = dateToMs(local.updatedAt)
          if (remoteMs > localMs) {
            const segData = firestoreToRouteSegmentData(data)
            await dexieDb.routeSegments.update(local.id!, { ...segData, firebaseId: fbId })
          } else if (localMs > remoteMs) {
            this.markPushed(`routeSegment:${fbId}`)
            await setDoc(doc(segmentsRef, fbId), routeSegmentToFirestore(local))
          }
        }
      } catch (e) {
        console.error('[Sync] Failed to sync routeSegment:', fbId, e)
      }
    }

    // Local-only (no firebaseId) → push to cloud
    for (const seg of localSegments) {
      if (!seg.firebaseId && seg.id) {
        try {
          let tripFbId = seg.tripFirebaseId
          if (!tripFbId) tripFbId = (await this.resolveTripFirebaseId(seg.tripId)) || ''
          if (!tripFbId) continue
          const segWithTripFbId = { ...seg, tripFirebaseId: tripFbId }
          const newDocRef = doc(segmentsRef)
          this.markPushed(`routeSegment:${newDocRef.id}`)
          await setDoc(newDocRef, routeSegmentToFirestore(segWithTripFbId))
          await dexieDb.routeSegments.update(seg.id, { firebaseId: newDocRef.id })
          console.log('[Sync] Pushed local-only routeSegment to cloud:', seg.id, '→', newDocRef.id)
        } catch (e) {
          console.error('[Sync] Failed to push local-only routeSegment:', seg.id, e)
        }
      }
    }

    // Local has firebaseId but remote doesn't → re-upload to preserve data
    for (const seg of localSegments) {
      if (seg.firebaseId && !remoteMap.has(seg.firebaseId) && seg.id) {
        try {
          this.markPushed(`routeSegment:${seg.firebaseId}`)
          await setDoc(doc(segmentsRef, seg.firebaseId), routeSegmentToFirestore(seg))
          console.log('[Sync] Re-uploaded routeSegment missing from cloud:', seg.firebaseId)
        } catch (e) {
          console.error('[Sync] Failed to re-upload routeSegment:', seg.firebaseId, e)
        }
      }
    }
  }

  private async syncTravelLogsInitial(): Promise<void> {
    if (!this.userId) return
    const firestore = getFirebaseDb()
    const logsRef = collection(firestore, 'users', this.userId, 'travelLogs')

    const [snapshot, localLogs] = await Promise.all([
      withRetry(() => getDocs(logsRef), 'TravelLogs fetch'),
      dexieDb.travelLogs.toArray(),
    ])

    const remoteMap = new Map<string, { docId: string; data: DocumentData }>()
    for (const docSnap of snapshot.docs) {
      remoteMap.set(docSnap.id, { docId: docSnap.id, data: docSnap.data() })
    }

    const localByFbId = new Map<string, TravelLog>()
    for (const log of localLogs) {
      if (log.firebaseId) localByFbId.set(log.firebaseId, log)
    }

    // Remote-only → create locally
    for (const [fbId, { data }] of remoteMap) {
      try {
        if (!localByFbId.has(fbId)) {
          const logData = firestoreToTravelLogData(data)
          const localTripId = await this.resolveLocalTripId(data.tripFirebaseId)
          if (localTripId === null) {
            console.warn('[Sync] Skipping travelLog - trip not found:', data.tripFirebaseId)
            continue
          }
          await dexieDb.travelLogs.add({
            ...logData,
            firebaseId: fbId,
            tripId: localTripId,
            photo: undefined,
            thumbnailPhoto: undefined,
            photoPath: data.photoPath || undefined,
            thumbnailPhotoPath: data.thumbnailPhotoPath || undefined,
          } as TravelLog)
        } else {
          // Both exist → newer wins
          const local = localByFbId.get(fbId)!
          const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
          const localMs = dateToMs(local.updatedAt)
          if (remoteMs > localMs) {
            // Cloud is newer → update local (preserve existing local photos)
            const logData = firestoreToTravelLogData(data)
            await dexieDb.travelLogs.update(local.id!, { ...logData, firebaseId: fbId, photo: local.photo || undefined, thumbnailPhoto: local.thumbnailPhoto || undefined })
          } else if (localMs > remoteMs) {
            // Local is newer → push to cloud
            let tripFbId = local.tripFirebaseId
            if (!tripFbId) tripFbId = (await this.resolveTripFirebaseId(local.tripId)) || ''
            const logWithTripFbId = { ...local, tripFirebaseId: tripFbId }
            this.markPushed(`travelLog:${fbId}`)
            await setDoc(doc(logsRef, fbId), travelLogToFirestore(logWithTripFbId))
          }
        }
      } catch (e) {
        console.error('[Sync] Failed to sync travelLog:', fbId, e)
      }
    }

    // Local-only (no firebaseId) → push to cloud
    for (const log of localLogs) {
      if (!log.firebaseId && log.id) {
        try {
          let tripFbId = log.tripFirebaseId
          if (!tripFbId) tripFbId = (await this.resolveTripFirebaseId(log.tripId)) || ''
          if (!tripFbId) {
            console.warn('[Sync] Skipping local-only travelLog push — no tripFirebaseId:', log.id)
            continue
          }
          const logWithTripFbId = { ...log, tripFirebaseId: tripFbId }
          const newDocRef = doc(logsRef)
          this.markPushed(`travelLog:${newDocRef.id}`)
          await setDoc(newDocRef, travelLogToFirestore(logWithTripFbId))
          await dexieDb.travelLogs.update(log.id, { firebaseId: newDocRef.id })
          console.log('[Sync] Pushed local-only travelLog to cloud:', log.id, '→', newDocRef.id)
        } catch (e) {
          console.error('[Sync] Failed to push local-only travelLog:', log.id, e)
        }
      }
    }

    // Local has firebaseId but remote doesn't → re-upload to preserve data
    for (const log of localLogs) {
      if (log.firebaseId && !remoteMap.has(log.firebaseId) && log.id) {
        try {
          this.markPushed(`travelLog:${log.firebaseId}`)
          await setDoc(doc(logsRef, log.firebaseId), travelLogToFirestore(log))
          console.log('[Sync] Re-uploaded travelLog missing from cloud:', log.firebaseId)
        } catch (e) {
          console.error('[Sync] Failed to re-upload travelLog:', log.firebaseId, e)
        }
      }
    }
  }

  // ============================================
  // Real-time Listeners
  // ============================================

  private startRealtimeListeners(): void {
    if (!this.userId) return
    const firestore = getFirebaseDb()

    // Trip listener
    const tripsRef = collection(firestore, 'users', this.userId, 'trips')
    const tripUnsub = onSnapshot(tripsRef, async (snapshot) => {
      if (this.mergeInProgress) return
      let changed = false
      for (const change of snapshot.docChanges()) {
        const docId = change.doc.id
        if (this.isEcho(`trip:${docId}`)) continue
        if (this.isPendingDelete(docId)) continue

        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data()
          const local = await database.getTripByFirebaseId(docId)
          if (!local) {
            const tripData = firestoreToTripData(data)
            await dexieDb.trips.add({ ...tripData, firebaseId: docId, coverImage: '', coverImagePath: data.coverImagePath || undefined } as Trip)
            changed = true
            // Trigger background image download if cloud has image
            if (data.coverImagePath) {
              import('@/services/imageSync').then(({ downloadTripCoverImage }) => {
                dexieDb.trips.where('firebaseId').equals(docId).first().then((t) => {
                  if (t) downloadTripCoverImage(t).then(() => this.notifyUpdateDebounced())
                })
              }).catch(console.error)
            }
          } else {
            const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
            const localMs = dateToMs(local.updatedAt)
            if (remoteMs > localMs) {
              // Check for concurrent edits before auto-overwriting
              const localRecentlyModified = localMs > 0 && (remoteMs - localMs) < SyncManager.CONCURRENT_EDIT_THRESHOLD_MS
              if (localRecentlyModified && !this.isRecentlyResolved('trip', docId)) {
                const cloudFields = extractMergeableFields('trip', firestoreToTripData(data) as unknown as Record<string, unknown>)
                const localFields = extractMergeableFields('trip', local as unknown as Record<string, unknown>)
                const conflicts = detectConflicts('trip', localFields, cloudFields)
                if (conflicts.length > 0) {
                  useSyncConflictStore.getState().addConflict({
                    id: `trip:${docId}:${Date.now()}`,
                    entityType: 'trip',
                    entityId: local.id!,
                    firebaseId: docId,
                    entityLabel: local.title,
                    conflictFields: conflicts,
                    localVersion: localFields,
                    cloudVersion: cloudFields,
                    localUpdatedAt: local.updatedAt,
                    cloudUpdatedAt: fromTimestamp(data.updatedAt),
                    detectedAt: new Date(),
                  })
                  continue
                }
              }
              const tripData = firestoreToTripData(data)
              await dexieDb.trips.update(local.id!, { ...tripData, firebaseId: docId, coverImage: local.coverImage || '' })
              changed = true
              // Trigger background image download if cloud has updated image path
              if (data.coverImagePath && data.coverImagePath !== local.coverImagePath) {
                import('@/services/imageSync').then(({ downloadTripCoverImage }) => {
                  dexieDb.trips.get(local.id!).then((t) => {
                    if (t) downloadTripCoverImage({ ...t, coverImage: '' }).then(() => this.notifyUpdateDebounced())
                  })
                }).catch(console.error)
              }
            } else if (!this.isRecentlyResolved('trip', docId)) {
              // Local is same or newer → check for field conflicts
              const cloudFields = extractMergeableFields('trip', firestoreToTripData(data) as unknown as Record<string, unknown>)
              const localFields = extractMergeableFields('trip', local as unknown as Record<string, unknown>)
              const conflicts = detectConflicts('trip', localFields, cloudFields)
              if (conflicts.length > 0) {
                useSyncConflictStore.getState().addConflict({
                  id: `trip:${docId}:${Date.now()}`,
                  entityType: 'trip',
                  entityId: local.id!,
                  firebaseId: docId,
                  entityLabel: local.title,
                  conflictFields: conflicts,
                  localVersion: localFields,
                  cloudVersion: cloudFields,
                  localUpdatedAt: local.updatedAt,
                  cloudUpdatedAt: fromTimestamp(data.updatedAt),
                  detectedAt: new Date(),
                })
              }
            }
            // Image path sync — independent of timestamp (paths arrive later via fire-and-forget upload)
            if (data.coverImagePath && data.coverImagePath !== local.coverImagePath) {
              await dexieDb.trips.update(local.id!, { coverImagePath: data.coverImagePath })
              if (!local.coverImage) {
                import('@/services/imageSync').then(({ downloadTripCoverImage }) => {
                  dexieDb.trips.get(local.id!).then((t) => {
                    if (t) downloadTripCoverImage(t).then(() => this.notifyUpdateDebounced())
                  })
                }).catch(console.error)
              }
            }
          }
        } else if (change.type === 'removed') {
          const local = await database.getTripByFirebaseId(docId)
          if (local?.id) {
            await dexieDb.plans.where('tripId').equals(local.id).delete()
            await dexieDb.routeSegments.where('tripId').equals(local.id).delete()
            await dexieDb.travelLogs.where('tripId').equals(local.id).delete()
            await dexieDb.trips.delete(local.id)
            changed = true
          }
        }
      }
      if (changed) this.notifyUpdateDebounced()
    }, (error) => console.error('[Sync] Trip listener error:', error))
    this.unsubscribers.push(tripUnsub)

    // Plan listener
    const plansRef = collection(firestore, 'users', this.userId, 'plans')
    const planUnsub = onSnapshot(plansRef, async (snapshot) => {
      if (this.mergeInProgress) return
      let changed = false
      const affectedTripIds = new Set<number>()
      for (const change of snapshot.docChanges()) {
        const docId = change.doc.id
        if (this.isEcho(`plan:${docId}`)) continue
        if (this.isPendingDelete(docId)) continue

        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data()
          const local = await database.getPlanByFirebaseId(docId)
          if (!local) {
            const planData = firestoreToPlanData(data)
            const localTripId = await this.resolveLocalTripId(data.tripFirebaseId)
            if (localTripId === null) continue
            await dexieDb.plans.add({ ...planData, firebaseId: docId, tripId: localTripId, photos: [], photoPaths: data.photoPaths || undefined } as Plan)
            affectedTripIds.add(localTripId)
            changed = true
            // Trigger background image download if cloud has photos
            if (data.photoPaths?.length) {
              import('@/services/imageSync').then(({ downloadPlanPhotos }) => {
                dexieDb.plans.where('firebaseId').equals(docId).first().then((p) => {
                  if (p) downloadPlanPhotos(p).then(() => this.notifyUpdateDebounced())
                })
              }).catch(console.error)
            }
          } else {
            const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
            const localMs = dateToMs(local.updatedAt)
            if (remoteMs > localMs) {
              // Check for concurrent edits before auto-overwriting
              const localRecentlyModified = localMs > 0 && (remoteMs - localMs) < SyncManager.CONCURRENT_EDIT_THRESHOLD_MS
              if (localRecentlyModified && !this.isRecentlyResolved('plan', docId)) {
                const cloudFields = extractMergeableFields('plan', firestoreToPlanData(data) as unknown as Record<string, unknown>)
                const localFields = extractMergeableFields('plan', local as unknown as Record<string, unknown>)
                const conflicts = detectConflicts('plan', localFields, cloudFields)
                if (conflicts.length > 0) {
                  useSyncConflictStore.getState().addConflict({
                    id: `plan:${docId}:${Date.now()}`,
                    entityType: 'plan',
                    entityId: local.id!,
                    firebaseId: docId,
                    entityLabel: local.placeName,
                    conflictFields: conflicts,
                    localVersion: localFields,
                    cloudVersion: cloudFields,
                    localUpdatedAt: local.updatedAt,
                    cloudUpdatedAt: fromTimestamp(data.updatedAt),
                    detectedAt: new Date(),
                  })
                  continue
                }
              }
              const planData = firestoreToPlanData(data)
              await dexieDb.plans.update(local.id!, { ...planData, firebaseId: docId, photos: local.photos || [] })
              changed = true
              // Trigger background image download if cloud has updated photo paths
              if (data.photoPaths?.length && JSON.stringify(data.photoPaths) !== JSON.stringify(local.photoPaths)) {
                import('@/services/imageSync').then(({ downloadPlanPhotos }) => {
                  dexieDb.plans.get(local.id!).then((p) => {
                    if (p) downloadPlanPhotos({ ...p, photos: [] }).then(() => this.notifyUpdateDebounced())
                  })
                }).catch(console.error)
              }
            } else if (!this.isRecentlyResolved('plan', docId)) {
              const cloudFields = extractMergeableFields('plan', firestoreToPlanData(data) as unknown as Record<string, unknown>)
              const localFields = extractMergeableFields('plan', local as unknown as Record<string, unknown>)
              const conflicts = detectConflicts('plan', localFields, cloudFields)
              if (conflicts.length > 0) {
                useSyncConflictStore.getState().addConflict({
                  id: `plan:${docId}:${Date.now()}`,
                  entityType: 'plan',
                  entityId: local.id!,
                  firebaseId: docId,
                  entityLabel: local.placeName,
                  conflictFields: conflicts,
                  localVersion: localFields,
                  cloudVersion: cloudFields,
                  localUpdatedAt: local.updatedAt,
                  cloudUpdatedAt: fromTimestamp(data.updatedAt),
                  detectedAt: new Date(),
                })
              }
            }
            // Image path sync — independent of timestamp (paths arrive later via fire-and-forget upload)
            if (data.photoPaths?.length && !local.photoPaths?.length) {
              await dexieDb.plans.update(local.id!, { photoPaths: data.photoPaths })
              if (!local.photos?.length) {
                import('@/services/imageSync').then(({ downloadPlanPhotos }) => {
                  dexieDb.plans.get(local.id!).then((p) => {
                    if (p) downloadPlanPhotos({ ...p, photos: [] }).then(() => this.notifyUpdateDebounced())
                  })
                }).catch(console.error)
              }
            }
          }
        } else if (change.type === 'removed') {
          const local = await database.getPlanByFirebaseId(docId)
          if (local?.id) {
            affectedTripIds.add(local.tripId)
            await dexieDb.plans.delete(local.id)
            changed = true
          }
        }
      }
      // Recalculate plansCount for affected trips
      if (changed) {
        for (const tripId of affectedTripIds) {
          const count = await dexieDb.plans.where('tripId').equals(tripId).count()
          await dexieDb.trips.update(tripId, { plansCount: count })
        }
        this.notifyUpdateDebounced()
      }
    }, (error) => console.error('[Sync] Plan listener error:', error))
    this.unsubscribers.push(planUnsub)

    // Place listener
    const placesRef = collection(firestore, 'users', this.userId, 'places')
    const placeUnsub = onSnapshot(placesRef, async (snapshot) => {
      if (this.mergeInProgress) return
      let changed = false
      for (const change of snapshot.docChanges()) {
        const docId = change.doc.id
        if (this.isEcho(`place:${docId}`)) continue
        if (this.isPendingDelete(docId)) continue

        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data()
          const local = await database.getPlaceByFirebaseId(docId)
          if (!local) {
            const placeData = firestoreToPlaceData(data)
            await dexieDb.places.add({ ...placeData, firebaseId: docId, photos: [], photoPaths: data.photoPaths || undefined } as Place)
            changed = true
            // Trigger background image download if cloud has photos
            if (data.photoPaths?.length) {
              import('@/services/imageSync').then(({ downloadPlacePhotos }) => {
                dexieDb.places.where('firebaseId').equals(docId).first().then((p) => {
                  if (p) downloadPlacePhotos(p).then(() => this.notifyUpdateDebounced())
                })
              }).catch(console.error)
            }
          } else {
            const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
            const localMs = dateToMs(local.updatedAt)
            if (remoteMs > localMs) {
              // Check for concurrent edits before auto-overwriting
              const localRecentlyModified = localMs > 0 && (remoteMs - localMs) < SyncManager.CONCURRENT_EDIT_THRESHOLD_MS
              if (localRecentlyModified && !this.isRecentlyResolved('place', docId)) {
                const cloudFields = extractMergeableFields('place', firestoreToPlaceData(data) as unknown as Record<string, unknown>)
                const localFields = extractMergeableFields('place', local as unknown as Record<string, unknown>)
                const conflicts = detectConflicts('place', localFields, cloudFields)
                if (conflicts.length > 0) {
                  useSyncConflictStore.getState().addConflict({
                    id: `place:${docId}:${Date.now()}`,
                    entityType: 'place',
                    entityId: local.id!,
                    firebaseId: docId,
                    entityLabel: local.name,
                    conflictFields: conflicts,
                    localVersion: localFields,
                    cloudVersion: cloudFields,
                    localUpdatedAt: local.updatedAt,
                    cloudUpdatedAt: fromTimestamp(data.updatedAt),
                    detectedAt: new Date(),
                  })
                  continue
                }
              }
              const placeData = firestoreToPlaceData(data)
              await dexieDb.places.update(local.id!, { ...placeData, firebaseId: docId, photos: local.photos || [] })
              changed = true
              // Trigger background image download if cloud has updated photo paths
              if (data.photoPaths?.length && JSON.stringify(data.photoPaths) !== JSON.stringify(local.photoPaths)) {
                import('@/services/imageSync').then(({ downloadPlacePhotos }) => {
                  dexieDb.places.get(local.id!).then((p) => {
                    if (p) downloadPlacePhotos({ ...p, photos: [] }).then(() => this.notifyUpdateDebounced())
                  })
                }).catch(console.error)
              }
            } else if (!this.isRecentlyResolved('place', docId)) {
              const cloudFields = extractMergeableFields('place', firestoreToPlaceData(data) as unknown as Record<string, unknown>)
              const localFields = extractMergeableFields('place', local as unknown as Record<string, unknown>)
              const conflicts = detectConflicts('place', localFields, cloudFields)
              if (conflicts.length > 0) {
                useSyncConflictStore.getState().addConflict({
                  id: `place:${docId}:${Date.now()}`,
                  entityType: 'place',
                  entityId: local.id!,
                  firebaseId: docId,
                  entityLabel: local.name,
                  conflictFields: conflicts,
                  localVersion: localFields,
                  cloudVersion: cloudFields,
                  localUpdatedAt: local.updatedAt,
                  cloudUpdatedAt: fromTimestamp(data.updatedAt),
                  detectedAt: new Date(),
                })
              }
            }
            // Image path sync — independent of timestamp (paths arrive later via fire-and-forget upload)
            if (data.photoPaths?.length && !local.photoPaths?.length) {
              await dexieDb.places.update(local.id!, { photoPaths: data.photoPaths })
              if (!local.photos?.length) {
                import('@/services/imageSync').then(({ downloadPlacePhotos }) => {
                  dexieDb.places.get(local.id!).then((p) => {
                    if (p) downloadPlacePhotos({ ...p, photos: [] }).then(() => this.notifyUpdateDebounced())
                  })
                }).catch(console.error)
              }
            }
          }
        } else if (change.type === 'removed') {
          const local = await database.getPlaceByFirebaseId(docId)
          if (local?.id) {
            await dexieDb.places.delete(local.id)
            changed = true
          }
        }
      }
      if (changed) this.notifyUpdateDebounced()
    }, (error) => console.error('[Sync] Place listener error:', error))
    this.unsubscribers.push(placeUnsub)

    // Settings listener
    const settingsDocRef = doc(firestore, 'users', this.userId, 'settings', 'main')
    const settingsUnsub = onSnapshot(settingsDocRef, async (docSnap) => {
      if (this.mergeInProgress) return
      if (this.isEcho('settings')) return
      if (!docSnap.exists()) return
      const data = docSnap.data()
      const localSettings = await database.getSettings()
      const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
      const localMs = dateToMs(localSettings.settingsUpdatedAt)
      if (remoteMs > localMs) {
        await database.updateSettings({
          theme: data.theme,
          colorPalette: data.colorPalette,
          language: data.language,
          isMusicPlayerEnabled: data.isMusicPlayerEnabled,
          timezoneAutoDetect: data.timezoneAutoDetect ?? true,
          detectedTimezone: data.detectedTimezone || undefined,
          mapProvider: data.mapProvider || 'google',
          defaultTravelMode: data.defaultTravelMode || 'DRIVE',
          claudeModel: data.claudeModel || 'sonnet',
          claudeEnabled: data.claudeEnabled ?? false,
          settingsUpdatedAt: fromTimestamp(data.settingsUpdatedAt),
        })
        this.notifyUpdateDebounced()
      }
    }, (error) => console.error('[Sync] Settings listener error:', error))
    this.unsubscribers.push(settingsUnsub)

    // RouteSegment listener
    const segmentsRef = collection(firestore, 'users', this.userId, 'routeSegments')
    const segmentUnsub = onSnapshot(segmentsRef, async (snapshot) => {
      if (this.mergeInProgress) return
      let changed = false
      for (const change of snapshot.docChanges()) {
        const docId = change.doc.id
        if (this.isEcho(`routeSegment:${docId}`)) continue
        if (this.isPendingDelete(docId)) continue

        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data()
          const local = await database.getRouteSegmentByFirebaseId(docId)
          if (!local) {
            const segData = firestoreToRouteSegmentData(data)
            const localTripId = await this.resolveLocalTripId(data.tripFirebaseId)
            if (localTripId === null) continue
            await dexieDb.routeSegments.add({
              ...segData,
              firebaseId: docId,
              tripId: localTripId,
            } as RouteSegment)
            changed = true
          } else {
            const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
            const localMs = dateToMs(local.updatedAt)
            if (remoteMs > localMs) {
              const segData = firestoreToRouteSegmentData(data)
              await dexieDb.routeSegments.update(local.id!, { ...segData, firebaseId: docId })
              changed = true
            }
          }
        } else if (change.type === 'removed') {
          const local = await database.getRouteSegmentByFirebaseId(docId)
          if (local?.id) {
            await dexieDb.routeSegments.delete(local.id)
            changed = true
          }
        }
      }
      if (changed) this.notifyUpdateDebounced()
    }, (error) => console.error('[Sync] RouteSegment listener error:', error))
    this.unsubscribers.push(segmentUnsub)

    // TravelLog listener
    const logsRef = collection(firestore, 'users', this.userId, 'travelLogs')
    const logUnsub = onSnapshot(logsRef, async (snapshot) => {
      if (this.mergeInProgress) return
      let changed = false
      for (const change of snapshot.docChanges()) {
        const docId = change.doc.id
        if (this.isEcho(`travelLog:${docId}`)) continue
        if (this.isPendingDelete(docId)) continue

        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data()
          const local = await database.getTravelLogByFirebaseId(docId)
          if (!local) {
            const logData = firestoreToTravelLogData(data)
            const localTripId = await this.resolveLocalTripId(data.tripFirebaseId)
            if (localTripId === null) continue
            await dexieDb.travelLogs.add({
              ...logData,
              firebaseId: docId,
              tripId: localTripId,
              photo: undefined,
              thumbnailPhoto: undefined,
              photoPath: data.photoPath || undefined,
              thumbnailPhotoPath: data.thumbnailPhotoPath || undefined,
            } as TravelLog)
            changed = true
            // Trigger background image download if cloud has photo
            if (data.photoPath) {
              import('@/services/imageSync').then(({ downloadTravelLogPhoto }) => {
                dexieDb.travelLogs.where('firebaseId').equals(docId).first().then((l) => {
                  if (l) downloadTravelLogPhoto(l).then(() => this.notifyUpdateDebounced())
                })
              }).catch(console.error)
            }
          } else {
            const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
            const localMs = dateToMs(local.updatedAt)
            if (remoteMs > localMs) {
              const logData = firestoreToTravelLogData(data)
              await dexieDb.travelLogs.update(local.id!, { ...logData, firebaseId: docId, photo: local.photo || undefined, thumbnailPhoto: local.thumbnailPhoto || undefined })
              changed = true
              // Trigger background image download if cloud has updated photo path
              if (data.photoPath && data.photoPath !== local.photoPath) {
                import('@/services/imageSync').then(({ downloadTravelLogPhoto }) => {
                  dexieDb.travelLogs.get(local.id!).then((l) => {
                    if (l) downloadTravelLogPhoto(l).then(() => this.notifyUpdateDebounced())
                  })
                }).catch(console.error)
              }
            }
            // Image path sync — independent of timestamp (paths arrive later via fire-and-forget upload)
            if (data.photoPath && data.photoPath !== local.photoPath) {
              await dexieDb.travelLogs.update(local.id!, { photoPath: data.photoPath, thumbnailPhotoPath: data.thumbnailPhotoPath })
              if (!local.photo) {
                import('@/services/imageSync').then(({ downloadTravelLogPhoto }) => {
                  dexieDb.travelLogs.get(local.id!).then((l) => {
                    if (l) downloadTravelLogPhoto(l).then(() => this.notifyUpdateDebounced())
                  })
                }).catch(console.error)
              }
            }
          }
        } else if (change.type === 'removed') {
          const local = await database.getTravelLogByFirebaseId(docId)
          if (local?.id) {
            await dexieDb.travelLogs.delete(local.id)
            changed = true
          }
        }
      }
      if (changed) this.notifyUpdateDebounced()
    }, (error) => console.error('[Sync] TravelLog listener error:', error))
    this.unsubscribers.push(logUnsub)
  }

  // ============================================
  // Batch Write Queue (debounced 500ms)
  // ============================================

  private batchQueue: Array<{
    type: 'set' | 'delete'
    ref: DocumentReference
    data?: DocumentData
    echoKey?: string
  }> = []
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private static readonly BATCH_DEBOUNCE_MS = 500
  private static readonly MAX_BATCH_SIZE = 450 // Firestore limit is 500

  /**
   * Queue a write operation for batched execution.
   * Flushes automatically after 500ms or when queue reaches 450 items.
   */
  queueWrite(ref: DocumentReference, data: DocumentData, echoKey?: string): void {
    if (echoKey) this.markPushed(echoKey)
    this.batchQueue.push({ type: 'set', ref, data, echoKey })
    this.scheduleBatchFlush()
  }

  /**
   * Queue a delete operation for batched execution.
   */
  queueDelete(ref: DocumentReference, echoKey?: string): void {
    if (echoKey) this.markPushed(echoKey)
    this.batchQueue.push({ type: 'delete', ref, echoKey })
    this.scheduleBatchFlush()
  }

  private scheduleBatchFlush(): void {
    if (this.batchQueue.length >= SyncManager.MAX_BATCH_SIZE) {
      this.flushBatch()
      return
    }
    if (this.batchTimer) clearTimeout(this.batchTimer)
    this.batchTimer = setTimeout(() => this.flushBatch(), SyncManager.BATCH_DEBOUNCE_MS)
  }

  /**
   * Immediately flush all queued writes as Firestore batch(es).
   */
  async flushBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    if (this.batchQueue.length === 0) return

    const queue = [...this.batchQueue]
    this.batchQueue = []

    const firestore = getFirebaseDb()

    // Split into chunks of 450 (Firestore max 500 per batch)
    for (let i = 0; i < queue.length; i += SyncManager.MAX_BATCH_SIZE) {
      const chunk = queue.slice(i, i + SyncManager.MAX_BATCH_SIZE)
      const batch = writeBatch(firestore)

      for (const op of chunk) {
        if (op.type === 'set' && op.data) {
          batch.set(op.ref, op.data)
        } else if (op.type === 'delete') {
          batch.delete(op.ref)
        }
      }

      try {
        await batch.commit()
      } catch (error) {
        console.error('[Sync] Batch commit failed, falling back to individual writes:', error)
        // Fallback: try individual writes
        for (const op of chunk) {
          try {
            if (op.type === 'set' && op.data) {
              await setDoc(op.ref, op.data)
            } else if (op.type === 'delete') {
              await deleteDoc(op.ref)
            }
          } catch (e) {
            console.error('[Sync] Individual write fallback also failed:', e)
          }
        }
      }
    }
  }

  // ============================================
  // Upload Methods (called by stores)
  // ============================================

  async uploadTrip(trip: Trip): Promise<string> {
    if (!this.userId) return trip.firebaseId || ''
    const firestore = getFirebaseDb()
    const tripsRef = collection(firestore, 'users', this.userId, 'trips')

    if (trip.firebaseId) {
      this.markPushed(`trip:${trip.firebaseId}`)
      await setDoc(doc(tripsRef, trip.firebaseId), tripToFirestore(trip))
      return trip.firebaseId
    }

    const newDocRef = doc(tripsRef)
    this.markPushed(`trip:${newDocRef.id}`)
    await setDoc(newDocRef, tripToFirestore(trip))
    return newDocRef.id
  }

  async uploadPlan(plan: Plan): Promise<string> {
    if (!this.userId) return plan.firebaseId || ''
    const firestore = getFirebaseDb()
    const plansRef = collection(firestore, 'users', this.userId, 'plans')

    // Ensure tripFirebaseId is set
    let tripFbId = plan.tripFirebaseId
    if (!tripFbId) {
      tripFbId = await this.resolveTripFirebaseId(plan.tripId) || ''
    }
    const planWithTripFbId = { ...plan, tripFirebaseId: tripFbId }

    if (plan.firebaseId) {
      this.markPushed(`plan:${plan.firebaseId}`)
      await setDoc(doc(plansRef, plan.firebaseId), planToFirestore(planWithTripFbId))
      return plan.firebaseId
    }

    const newDocRef = doc(plansRef)
    this.markPushed(`plan:${newDocRef.id}`)
    await setDoc(newDocRef, planToFirestore(planWithTripFbId))
    return newDocRef.id
  }

  async uploadPlace(place: Place): Promise<string> {
    if (!this.userId) return place.firebaseId || ''
    const firestore = getFirebaseDb()
    const placesRef = collection(firestore, 'users', this.userId, 'places')

    if (place.firebaseId) {
      this.markPushed(`place:${place.firebaseId}`)
      await setDoc(doc(placesRef, place.firebaseId), placeToFirestore(place))
      return place.firebaseId
    }

    const newDocRef = doc(placesRef)
    this.markPushed(`place:${newDocRef.id}`)
    await setDoc(newDocRef, placeToFirestore(place))
    return newDocRef.id
  }

  async uploadSettings(settings: Settings): Promise<void> {
    if (!this.userId) return
    const firestore = getFirebaseDb()
    const settingsDocRef = doc(firestore, 'users', this.userId, 'settings', 'main')
    this.markPushed('settings')
    await setDoc(settingsDocRef, settingsToFirestore(settings))
  }

  async deleteRemoteTrip(firebaseId: string): Promise<void> {
    if (!this.userId || !firebaseId) return
    const firestore = getFirebaseDb()
    this.markPushed(`trip:${firebaseId}`)

    // Delete images from Storage (best-effort, non-blocking for Firestore deletion)
    try {
      const { deleteEntityImages } = await import('@/services/imageSync')
      await deleteEntityImages(this.userId, 'trips', firebaseId)
    } catch (e) {
      console.error('[Sync] Failed to delete trip images from Storage:', e)
    }

    // Batch-delete associated plans + the trip itself
    const plansRef = collection(firestore, 'users', this.userId, 'plans')
    const plansSnapshot = await getDocs(plansRef)

    // Also delete associated route segments
    const segmentsRef = collection(firestore, 'users', this.userId, 'routeSegments')
    const segmentsSnapshot = await getDocs(segmentsRef)

    // Also delete associated travel logs
    const logsRef = collection(firestore, 'users', this.userId, 'travelLogs')
    const logsSnapshot = await getDocs(logsRef)

    const batch = writeBatch(firestore)
    let opCount = 0

    for (const planDoc of plansSnapshot.docs) {
      if (planDoc.data().tripFirebaseId === firebaseId) {
        this.markPushed(`plan:${planDoc.id}`)
        batch.delete(planDoc.ref)
        opCount++
        // Delete plan images from Storage (best-effort)
        import('@/services/imageSync').then(({ deleteEntityImages }) => {
          deleteEntityImages(this.userId!, 'plans', planDoc.id)
        }).catch(console.error)
      }
    }

    for (const segDoc of segmentsSnapshot.docs) {
      if (segDoc.data().tripFirebaseId === firebaseId) {
        this.markPushed(`routeSegment:${segDoc.id}`)
        batch.delete(segDoc.ref)
        opCount++
      }
    }

    for (const logDoc of logsSnapshot.docs) {
      if (logDoc.data().tripFirebaseId === firebaseId) {
        this.markPushed(`travelLog:${logDoc.id}`)
        batch.delete(logDoc.ref)
        opCount++
        // Delete travelLog images from Storage (best-effort)
        import('@/services/imageSync').then(({ deleteEntityImages }) => {
          deleteEntityImages(this.userId!, 'travelLogs', logDoc.id)
        }).catch(console.error)
      }
    }

    batch.delete(doc(firestore, 'users', this.userId, 'trips', firebaseId))
    opCount++

    // Firestore batch limit is 500
    if (opCount <= 500) {
      await batch.commit()
    } else {
      // Fallback to chunked deletion for very large trips
      const allRefs: DocumentReference[] = []
      for (const planDoc of plansSnapshot.docs) {
        if (planDoc.data().tripFirebaseId === firebaseId) allRefs.push(planDoc.ref)
      }
      for (const segDoc of segmentsSnapshot.docs) {
        if (segDoc.data().tripFirebaseId === firebaseId) allRefs.push(segDoc.ref)
      }
      for (const logDoc of logsSnapshot.docs) {
        if (logDoc.data().tripFirebaseId === firebaseId) allRefs.push(logDoc.ref)
      }
      allRefs.push(doc(firestore, 'users', this.userId, 'trips', firebaseId))

      for (let i = 0; i < allRefs.length; i += 450) {
        const chunk = allRefs.slice(i, i + 450)
        const b = writeBatch(firestore)
        for (const ref of chunk) b.delete(ref)
        await b.commit()
      }
    }
  }

  async deleteRemotePlan(firebaseId: string): Promise<void> {
    if (!this.userId || !firebaseId) return
    const firestore = getFirebaseDb()
    this.markPushed(`plan:${firebaseId}`)
    // Delete plan images from Storage
    try {
      const { deleteEntityImages } = await import('@/services/imageSync')
      await deleteEntityImages(this.userId, 'plans', firebaseId)
    } catch (e) {
      console.error('[Sync] Failed to delete plan images from Storage:', e)
    }
    await deleteDoc(doc(firestore, 'users', this.userId, 'plans', firebaseId))
  }

  async deleteRemotePlace(firebaseId: string): Promise<void> {
    if (!this.userId || !firebaseId) return
    const firestore = getFirebaseDb()
    this.markPushed(`place:${firebaseId}`)
    // Delete place images from Storage
    try {
      const { deleteEntityImages } = await import('@/services/imageSync')
      await deleteEntityImages(this.userId, 'places', firebaseId)
    } catch (e) {
      console.error('[Sync] Failed to delete place images from Storage:', e)
    }
    await deleteDoc(doc(firestore, 'users', this.userId, 'places', firebaseId))
  }

  async uploadRouteSegment(segment: RouteSegment): Promise<string> {
    if (!this.userId) return segment.firebaseId || ''
    const firestore = getFirebaseDb()
    const segmentsRef = collection(firestore, 'users', this.userId, 'routeSegments')

    if (segment.firebaseId) {
      this.markPushed(`routeSegment:${segment.firebaseId}`)
      await setDoc(doc(segmentsRef, segment.firebaseId), routeSegmentToFirestore(segment))
      return segment.firebaseId
    }

    const newDocRef = doc(segmentsRef)
    this.markPushed(`routeSegment:${newDocRef.id}`)
    await setDoc(newDocRef, routeSegmentToFirestore(segment))
    return newDocRef.id
  }

  async deleteRemoteRouteSegment(firebaseId: string): Promise<void> {
    if (!this.userId || !firebaseId) return
    const firestore = getFirebaseDb()
    this.markPushed(`routeSegment:${firebaseId}`)
    await deleteDoc(doc(firestore, 'users', this.userId, 'routeSegments', firebaseId))
  }

  async uploadTravelLog(log: TravelLog): Promise<string> {
    if (!this.userId) return log.firebaseId || ''
    const firestore = getFirebaseDb()
    const logsRef = collection(firestore, 'users', this.userId, 'travelLogs')

    // Ensure tripFirebaseId is set
    let tripFbId = log.tripFirebaseId
    if (!tripFbId) {
      tripFbId = await this.resolveTripFirebaseId(log.tripId) || ''
    }
    const logWithTripFbId = { ...log, tripFirebaseId: tripFbId }

    if (log.firebaseId) {
      this.markPushed(`travelLog:${log.firebaseId}`)
      await setDoc(doc(logsRef, log.firebaseId), travelLogToFirestore(logWithTripFbId))
      return log.firebaseId
    }

    const newDocRef = doc(logsRef)
    this.markPushed(`travelLog:${newDocRef.id}`)
    await setDoc(newDocRef, travelLogToFirestore(logWithTripFbId))
    return newDocRef.id
  }

  async deleteRemoteTravelLog(firebaseId: string): Promise<void> {
    if (!this.userId || !firebaseId) return
    const firestore = getFirebaseDb()
    this.markPushed(`travelLog:${firebaseId}`)
    // Delete travelLog images from Storage
    try {
      const { deleteEntityImages } = await import('@/services/imageSync')
      await deleteEntityImages(this.userId, 'travelLogs', firebaseId)
    } catch (e) {
      console.error('[Sync] Failed to delete travelLog images from Storage:', e)
    }
    await deleteDoc(doc(firestore, 'users', this.userId, 'travelLogs', firebaseId))
  }

  async deleteRemoteTravelLogsForTrip(tripFirebaseId: string): Promise<void> {
    if (!this.userId || !tripFirebaseId) return
    const firestore = getFirebaseDb()
    const logsRef = collection(firestore, 'users', this.userId, 'travelLogs')
    const logsSnapshot = await getDocs(logsRef)

    const batch = writeBatch(firestore)
    let opCount = 0

    for (const logDoc of logsSnapshot.docs) {
      if (logDoc.data().tripFirebaseId === tripFirebaseId) {
        this.markPushed(`travelLog:${logDoc.id}`)
        batch.delete(logDoc.ref)
        opCount++
        // Delete travelLog images from Storage (best-effort)
        import('@/services/imageSync').then(({ deleteEntityImages }) => {
          deleteEntityImages(this.userId!, 'travelLogs', logDoc.id)
        }).catch(console.error)
      }
    }

    if (opCount > 0) {
      if (opCount <= 450) {
        await batch.commit()
      } else {
        // Fallback to chunked deletion for many logs
        const allRefs: DocumentReference[] = []
        for (const logDoc of logsSnapshot.docs) {
          if (logDoc.data().tripFirebaseId === tripFirebaseId) allRefs.push(logDoc.ref)
        }
        for (let i = 0; i < allRefs.length; i += 450) {
          const chunk = allRefs.slice(i, i + 450)
          const b = writeBatch(firestore)
          for (const ref of chunk) b.delete(ref)
          await b.commit()
        }
      }
    }
  }

  // ============================================
  // ID Resolution Helpers
  // ============================================

  private async resolveLocalTripId(tripFirebaseId: string): Promise<number | null> {
    if (!tripFirebaseId) return null
    const trip = await database.getTripByFirebaseId(tripFirebaseId)
    return trip?.id ?? null
  }

  private async resolveTripFirebaseId(localTripId: number): Promise<string | null> {
    const trip = await dexieDb.trips.get(localTripId)
    return trip?.firebaseId ?? null
  }
}

// Singleton
export const syncManager = new SyncManager()
