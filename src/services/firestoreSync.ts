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
import type { Trip, Plan, Place, Settings, RouteSegment, SyncProgress } from '@/types'

// ============================================
// Helpers
// ============================================

function toTimestamp(date: Date | string | undefined | null): Timestamp | null {
  if (!date) return null
  if (date instanceof Date) return Timestamp.fromDate(date)
  return Timestamp.fromDate(new Date(date as string))
}

function fromTimestamp(ts: Timestamp | null | undefined): Date {
  if (!ts || typeof ts.toDate !== 'function') return new Date()
  return ts.toDate()
}

function dateToMs(date: Date | string | undefined | null): number {
  if (!date) return 0
  if (date instanceof Date) return date.getTime()
  return new Date(date as string).getTime()
}

// ============================================
// Converters: Local → Firestore
// ============================================

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
    createdAt: toTimestamp(trip.createdAt),
    updatedAt: toTimestamp(trip.updatedAt),
  }
}

function planToFirestore(plan: Plan): DocumentData {
  return {
    tripFirebaseId: plan.tripFirebaseId || '',
    day: plan.day,
    order: plan.order ?? 0,
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
      ? { ...plan.googleInfo, extractedAt: toTimestamp(plan.googleInfo.extractedAt) }
      : null,
    audioScript: plan.audioScript || null,
    createdAt: toTimestamp(plan.createdAt),
    updatedAt: toTimestamp(plan.updatedAt),
  }
}

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
    detectedTimezone: settings.detectedTimezone || null,
    timezoneAutoDetect: settings.timezoneAutoDetect,
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
  private suppressEcho = new Set<string>()

  // ---- Lifecycle ----

  async start(userId: string): Promise<void> {
    this.stop()
    this.userId = userId
    console.log('[Sync] Starting for user:', userId)
    try {
      await this.performInitialSync()
      this.startRealtimeListeners()
      this._isActive = true
      this.notifyActiveChange()
      console.log('[Sync] Ready')
    } catch (error) {
      console.error('[Sync] Start failed:', error)
      this.userId = null
    }
  }

  stop(): void {
    // Flush any pending batch writes before stopping
    this.flushBatch().catch((e) => console.error('[Sync] Flush on stop failed:', e))

    for (const unsub of this.unsubscribers) unsub()
    this.unsubscribers = []
    this.userId = null
    this.suppressEcho.clear()
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

  private async performInitialSync(): Promise<void> {
    if (!this.userId || this.isSyncing) return
    this.isSyncing = true

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

      if (localOnlyCount > 0) {
        this.notifySyncStatus({
          status: 'syncing',
          step: `Firebase 데이터로 동기화 중... (로컬 전용 ${localOnlyCount}건 삭제 예정)`,
          localOnlyCount,
        })
      } else {
        this.notifySyncStatus({ status: 'syncing', step: '여행 동기화 중...' })
      }

      try {
        await this.syncTripsInitial()
      } catch (e) {
        console.error('[Sync] Trips sync failed:', e)
      }

      this.notifySyncStatus({ status: 'syncing', step: '일정 동기화 중...' })
      try {
        await this.syncPlansInitial()
      } catch (e) {
        console.error('[Sync] Plans sync failed:', e)
      }

      this.notifySyncStatus({ status: 'syncing', step: '장소 동기화 중...' })
      try {
        await this.syncPlacesInitial()
      } catch (e) {
        console.error('[Sync] Places sync failed:', e)
      }

      this.notifySyncStatus({ status: 'syncing', step: '설정 동기화 중...' })
      try {
        await this.syncSettingsInitial()
      } catch (e) {
        console.error('[Sync] Settings sync failed:', e)
      }

      this.notifySyncStatus({ status: 'syncing', step: '경로 동기화 중...' })
      try {
        await this.syncRouteSegmentsInitial()
      } catch (e) {
        console.error('[Sync] RouteSegments sync failed:', e)
      }

      this.notifySyncStatus({ status: 'done', step: '동기화 완료' })
      this.notifyUpdate()
    } catch (error) {
      console.error('[Sync] Initial sync error:', error)
      this.notifySyncStatus({
        status: 'error',
        step: '동기화 중 오류 발생',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      this.isSyncing = false
    }
  }

  private async syncTripsInitial(): Promise<void> {
    if (!this.userId) return
    const firestore = getFirebaseDb()
    const tripsRef = collection(firestore, 'users', this.userId, 'trips')

    const [snapshot, localTrips] = await Promise.all([
      getDocs(tripsRef),
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
      if (!localByFbId.has(fbId)) {
        const tripData = firestoreToTripData(data)
        await dexieDb.trips.add({
          ...tripData,
          firebaseId: fbId,
          coverImage: '',
        } as Trip)
      } else {
        // Both exist → Firebase always wins during initial sync
        const local = localByFbId.get(fbId)!
        const tripData = firestoreToTripData(data)
        await dexieDb.trips.update(local.id!, {
          ...tripData,
          firebaseId: fbId,
        })
      }
    }

    // Local-only (no firebaseId) → discard (Firebase is source of truth)
    for (const trip of localTrips) {
      if (!trip.firebaseId && trip.id) {
        // Cascade delete associated plans and routeSegments
        await dexieDb.plans.where('tripId').equals(trip.id).delete()
        await dexieDb.routeSegments.where('tripId').equals(trip.id).delete()
        await dexieDb.trips.delete(trip.id)
        console.log('[Sync] Discarded local-only trip:', trip.id, trip.title)
      }
    }
  }

  private async syncPlansInitial(): Promise<void> {
    if (!this.userId) return
    const firestore = getFirebaseDb()
    const plansRef = collection(firestore, 'users', this.userId, 'plans')

    const [snapshot, localPlans] = await Promise.all([
      getDocs(plansRef),
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
        } as Plan)
      } else {
        // Both exist → Firebase always wins during initial sync
        const local = localByFbId.get(fbId)!
        const planData = firestoreToPlanData(data)
        await dexieDb.plans.update(local.id!, {
          ...planData,
          firebaseId: fbId,
        })
      }
    }

    // Local-only (no firebaseId) → discard (Firebase is source of truth)
    for (const plan of localPlans) {
      if (!plan.firebaseId && plan.id) {
        await dexieDb.plans.delete(plan.id)
        console.log('[Sync] Discarded local-only plan:', plan.id, plan.placeName)
      }
    }
  }

  private async syncPlacesInitial(): Promise<void> {
    if (!this.userId) return
    const firestore = getFirebaseDb()
    const placesRef = collection(firestore, 'users', this.userId, 'places')

    const [snapshot, localPlaces] = await Promise.all([
      getDocs(placesRef),
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
      if (!localByFbId.has(fbId)) {
        const placeData = firestoreToPlaceData(data)
        await dexieDb.places.add({
          ...placeData,
          firebaseId: fbId,
          photos: [],
        } as Place)
      } else {
        // Both exist → Firebase always wins during initial sync
        const local = localByFbId.get(fbId)!
        const placeData = firestoreToPlaceData(data)
        await dexieDb.places.update(local.id!, {
          ...placeData,
          firebaseId: fbId,
        })
      }
    }

    // Local-only (no firebaseId) → discard (Firebase is source of truth)
    for (const place of localPlaces) {
      if (!place.firebaseId && place.id) {
        await dexieDb.places.delete(place.id)
        console.log('[Sync] Discarded local-only place:', place.id, place.name)
      }
    }
  }

  private async syncSettingsInitial(): Promise<void> {
    if (!this.userId) return
    const firestore = getFirebaseDb()
    const settingsDocRef = doc(firestore, 'users', this.userId, 'settings', 'main')

    try {
      const { getDoc } = await import('firebase/firestore')
      const docSnap = await getDoc(settingsDocRef)
      const localSettings = await database.getSettings()

      if (docSnap.exists()) {
        // Firebase always wins during initial sync
        const remoteData = docSnap.data()
        await database.updateSettings({
          theme: remoteData.theme,
          colorPalette: remoteData.colorPalette,
          language: remoteData.language,
          isMusicPlayerEnabled: remoteData.isMusicPlayerEnabled,
          timezoneAutoDetect: remoteData.timezoneAutoDetect ?? true,
          detectedTimezone: remoteData.detectedTimezone || undefined,
        })
        console.log('[Sync] Applied remote settings (Firebase wins)')
      } else {
        // No remote settings → seed Firebase with local defaults
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
      getDocs(segmentsRef),
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
        // Both exist → Firebase always wins during initial sync
        const local = localByFbId.get(fbId)!
        const segData = firestoreToRouteSegmentData(data)
        await dexieDb.routeSegments.update(local.id!, { ...segData, firebaseId: fbId })
      }
    }

    // Local-only (no firebaseId) → discard (Firebase is source of truth)
    for (const seg of localSegments) {
      if (!seg.firebaseId && seg.id) {
        await dexieDb.routeSegments.delete(seg.id)
        console.log('[Sync] Discarded local-only routeSegment:', seg.id)
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
      let changed = false
      for (const change of snapshot.docChanges()) {
        const docId = change.doc.id
        if (this.suppressEcho.has(`trip:${docId}`)) {
          this.suppressEcho.delete(`trip:${docId}`)
          continue
        }

        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data()
          const local = await database.getTripByFirebaseId(docId)
          if (!local) {
            const tripData = firestoreToTripData(data)
            await dexieDb.trips.add({ ...tripData, firebaseId: docId, coverImage: '' } as Trip)
            changed = true
          } else {
            const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
            const localMs = dateToMs(local.updatedAt)
            if (remoteMs > localMs) {
              const tripData = firestoreToTripData(data)
              await dexieDb.trips.update(local.id!, { ...tripData, firebaseId: docId })
              changed = true
            }
          }
        } else if (change.type === 'removed') {
          const local = await database.getTripByFirebaseId(docId)
          if (local?.id) {
            await dexieDb.plans.where('tripId').equals(local.id).delete()
            await dexieDb.routeSegments.where('tripId').equals(local.id).delete()
            await dexieDb.trips.delete(local.id)
            changed = true
          }
        }
      }
      if (changed) this.notifyUpdate()
    }, (error) => console.error('[Sync] Trip listener error:', error))
    this.unsubscribers.push(tripUnsub)

    // Plan listener
    const plansRef = collection(firestore, 'users', this.userId, 'plans')
    const planUnsub = onSnapshot(plansRef, async (snapshot) => {
      let changed = false
      for (const change of snapshot.docChanges()) {
        const docId = change.doc.id
        if (this.suppressEcho.has(`plan:${docId}`)) {
          this.suppressEcho.delete(`plan:${docId}`)
          continue
        }

        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data()
          const local = await database.getPlanByFirebaseId(docId)
          if (!local) {
            const planData = firestoreToPlanData(data)
            const localTripId = await this.resolveLocalTripId(data.tripFirebaseId)
            if (localTripId === null) continue
            await dexieDb.plans.add({ ...planData, firebaseId: docId, tripId: localTripId, photos: [] } as Plan)
            changed = true
          } else {
            const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
            const localMs = dateToMs(local.updatedAt)
            if (remoteMs > localMs) {
              const planData = firestoreToPlanData(data)
              await dexieDb.plans.update(local.id!, { ...planData, firebaseId: docId })
              changed = true
            }
          }
        } else if (change.type === 'removed') {
          const local = await database.getPlanByFirebaseId(docId)
          if (local?.id) {
            await dexieDb.plans.delete(local.id)
            changed = true
          }
        }
      }
      if (changed) this.notifyUpdate()
    }, (error) => console.error('[Sync] Plan listener error:', error))
    this.unsubscribers.push(planUnsub)

    // Place listener
    const placesRef = collection(firestore, 'users', this.userId, 'places')
    const placeUnsub = onSnapshot(placesRef, async (snapshot) => {
      let changed = false
      for (const change of snapshot.docChanges()) {
        const docId = change.doc.id
        if (this.suppressEcho.has(`place:${docId}`)) {
          this.suppressEcho.delete(`place:${docId}`)
          continue
        }

        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data()
          const local = await database.getPlaceByFirebaseId(docId)
          if (!local) {
            const placeData = firestoreToPlaceData(data)
            await dexieDb.places.add({ ...placeData, firebaseId: docId, photos: [] } as Place)
            changed = true
          } else {
            const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
            const localMs = dateToMs(local.updatedAt)
            if (remoteMs > localMs) {
              const placeData = firestoreToPlaceData(data)
              await dexieDb.places.update(local.id!, { ...placeData, firebaseId: docId })
              changed = true
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
      if (changed) this.notifyUpdate()
    }, (error) => console.error('[Sync] Place listener error:', error))
    this.unsubscribers.push(placeUnsub)

    // Settings listener
    const settingsDocRef = doc(firestore, 'users', this.userId, 'settings', 'main')
    const settingsUnsub = onSnapshot(settingsDocRef, async (docSnap) => {
      if (this.suppressEcho.has('settings')) {
        this.suppressEcho.delete('settings')
        return
      }
      if (!docSnap.exists()) return
      const data = docSnap.data()
      const localSettings = await database.getSettings()
      const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
      const localMs = dateToMs(localSettings.lastBackupDate)
      if (remoteMs > localMs) {
        await database.updateSettings({
          theme: data.theme,
          colorPalette: data.colorPalette,
          language: data.language,
          isMusicPlayerEnabled: data.isMusicPlayerEnabled,
          timezoneAutoDetect: data.timezoneAutoDetect ?? true,
          detectedTimezone: data.detectedTimezone || undefined,
        })
        this.notifyUpdate()
      }
    }, (error) => console.error('[Sync] Settings listener error:', error))
    this.unsubscribers.push(settingsUnsub)

    // RouteSegment listener
    const segmentsRef = collection(firestore, 'users', this.userId, 'routeSegments')
    const segmentUnsub = onSnapshot(segmentsRef, async (snapshot) => {
      let changed = false
      for (const change of snapshot.docChanges()) {
        const docId = change.doc.id
        if (this.suppressEcho.has(`routeSegment:${docId}`)) {
          this.suppressEcho.delete(`routeSegment:${docId}`)
          continue
        }

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
      if (changed) this.notifyUpdate()
    }, (error) => console.error('[Sync] RouteSegment listener error:', error))
    this.unsubscribers.push(segmentUnsub)
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
    if (echoKey) this.suppressEcho.add(echoKey)
    this.batchQueue.push({ type: 'set', ref, data, echoKey })
    this.scheduleBatchFlush()
  }

  /**
   * Queue a delete operation for batched execution.
   */
  queueDelete(ref: DocumentReference, echoKey?: string): void {
    if (echoKey) this.suppressEcho.add(echoKey)
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
      this.suppressEcho.add(`trip:${trip.firebaseId}`)
      await setDoc(doc(tripsRef, trip.firebaseId), tripToFirestore(trip))
      return trip.firebaseId
    }

    const newDocRef = doc(tripsRef)
    await setDoc(newDocRef, tripToFirestore(trip))
    this.suppressEcho.add(`trip:${newDocRef.id}`)
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
      this.suppressEcho.add(`plan:${plan.firebaseId}`)
      await setDoc(doc(plansRef, plan.firebaseId), planToFirestore(planWithTripFbId))
      return plan.firebaseId
    }

    const newDocRef = doc(plansRef)
    await setDoc(newDocRef, planToFirestore(planWithTripFbId))
    this.suppressEcho.add(`plan:${newDocRef.id}`)
    return newDocRef.id
  }

  async uploadPlace(place: Place): Promise<string> {
    if (!this.userId) return place.firebaseId || ''
    const firestore = getFirebaseDb()
    const placesRef = collection(firestore, 'users', this.userId, 'places')

    if (place.firebaseId) {
      this.suppressEcho.add(`place:${place.firebaseId}`)
      await setDoc(doc(placesRef, place.firebaseId), placeToFirestore(place))
      return place.firebaseId
    }

    const newDocRef = doc(placesRef)
    await setDoc(newDocRef, placeToFirestore(place))
    this.suppressEcho.add(`place:${newDocRef.id}`)
    return newDocRef.id
  }

  async uploadSettings(settings: Settings): Promise<void> {
    if (!this.userId) return
    const firestore = getFirebaseDb()
    const settingsDocRef = doc(firestore, 'users', this.userId, 'settings', 'main')
    this.suppressEcho.add('settings')
    await setDoc(settingsDocRef, settingsToFirestore(settings))
  }

  async deleteRemoteTrip(firebaseId: string): Promise<void> {
    if (!this.userId || !firebaseId) return
    const firestore = getFirebaseDb()
    this.suppressEcho.add(`trip:${firebaseId}`)

    // Batch-delete associated plans + the trip itself
    const plansRef = collection(firestore, 'users', this.userId, 'plans')
    const plansSnapshot = await getDocs(plansRef)

    // Also delete associated route segments
    const segmentsRef = collection(firestore, 'users', this.userId, 'routeSegments')
    const segmentsSnapshot = await getDocs(segmentsRef)

    const batch = writeBatch(firestore)
    let opCount = 0

    for (const planDoc of plansSnapshot.docs) {
      if (planDoc.data().tripFirebaseId === firebaseId) {
        this.suppressEcho.add(`plan:${planDoc.id}`)
        batch.delete(planDoc.ref)
        opCount++
      }
    }

    for (const segDoc of segmentsSnapshot.docs) {
      if (segDoc.data().tripFirebaseId === firebaseId) {
        this.suppressEcho.add(`routeSegment:${segDoc.id}`)
        batch.delete(segDoc.ref)
        opCount++
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
    this.suppressEcho.add(`plan:${firebaseId}`)
    await deleteDoc(doc(firestore, 'users', this.userId, 'plans', firebaseId))
  }

  async deleteRemotePlace(firebaseId: string): Promise<void> {
    if (!this.userId || !firebaseId) return
    const firestore = getFirebaseDb()
    this.suppressEcho.add(`place:${firebaseId}`)
    await deleteDoc(doc(firestore, 'users', this.userId, 'places', firebaseId))
  }

  async uploadRouteSegment(segment: RouteSegment): Promise<string> {
    if (!this.userId) return segment.firebaseId || ''
    const firestore = getFirebaseDb()
    const segmentsRef = collection(firestore, 'users', this.userId, 'routeSegments')

    if (segment.firebaseId) {
      this.suppressEcho.add(`routeSegment:${segment.firebaseId}`)
      await setDoc(doc(segmentsRef, segment.firebaseId), routeSegmentToFirestore(segment))
      return segment.firebaseId
    }

    const newDocRef = doc(segmentsRef)
    await setDoc(newDocRef, routeSegmentToFirestore(segment))
    this.suppressEcho.add(`routeSegment:${newDocRef.id}`)
    return newDocRef.id
  }

  async deleteRemoteRouteSegment(firebaseId: string): Promise<void> {
    if (!this.userId || !firebaseId) return
    const firestore = getFirebaseDb()
    this.suppressEcho.add(`routeSegment:${firebaseId}`)
    await deleteDoc(doc(firestore, 'users', this.userId, 'routeSegments', firebaseId))
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
