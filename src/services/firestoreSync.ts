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
  Timestamp,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { getFirebaseDb } from '@/services/firebase'
import { db as dexieDb } from '@/services/database'
import * as database from '@/services/database'
import type { Trip, Plan, Place, Settings } from '@/types'

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

class SyncManager {
  private userId: string | null = null
  private unsubscribers: Unsubscribe[] = []
  private syncCallbacks: SyncCallback[] = []
  private isSyncing = false
  private suppressEcho = new Set<string>()

  // ---- Lifecycle ----

  async start(userId: string): Promise<void> {
    this.stop()
    this.userId = userId
    console.log('[Sync] Starting for user:', userId)
    try {
      await this.performInitialSync()
      this.startRealtimeListeners()
      console.log('[Sync] Ready')
    } catch (error) {
      console.error('[Sync] Start failed:', error)
    }
  }

  stop(): void {
    for (const unsub of this.unsubscribers) unsub()
    this.unsubscribers = []
    this.userId = null
    this.suppressEcho.clear()
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
    return this.userId !== null
  }

  // ============================================
  // Initial Sync
  // ============================================

  private async performInitialSync(): Promise<void> {
    if (!this.userId || this.isSyncing) return
    this.isSyncing = true

    try {
      await this.syncTripsInitial()
      await this.syncPlansInitial()
      await this.syncPlacesInitial()
      await this.syncSettingsInitial()
      this.notifyUpdate()
    } catch (error) {
      console.error('[Sync] Initial sync error:', error)
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
        // Both exist → last-write-wins
        const local = localByFbId.get(fbId)!
        const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
        const localMs = dateToMs(local.updatedAt)
        if (remoteMs > localMs) {
          const tripData = firestoreToTripData(data)
          await dexieDb.trips.update(local.id!, {
            ...tripData,
            firebaseId: fbId,
          })
        } else if (localMs > remoteMs) {
          await setDoc(doc(tripsRef, fbId), tripToFirestore(local))
        }
      }
    }

    // Local-only (no firebaseId) → upload
    for (const trip of localTrips) {
      if (!trip.firebaseId) {
        const newDocRef = doc(tripsRef)
        await setDoc(newDocRef, tripToFirestore(trip))
        await dexieDb.trips.update(trip.id!, { firebaseId: newDocRef.id })
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
        const local = localByFbId.get(fbId)!
        const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
        const localMs = dateToMs(local.updatedAt)
        if (remoteMs > localMs) {
          const planData = firestoreToPlanData(data)
          await dexieDb.plans.update(local.id!, {
            ...planData,
            firebaseId: fbId,
          })
        } else if (localMs > remoteMs) {
          await setDoc(doc(plansRef, fbId), planToFirestore(local))
        }
      }
    }

    // Local-only → upload
    for (const plan of localPlans) {
      if (!plan.firebaseId) {
        const tripFirebaseId = await this.resolveTripFirebaseId(plan.tripId)
        if (!tripFirebaseId) continue
        const newDocRef = doc(plansRef)
        const planWithFbTripId = { ...plan, tripFirebaseId }
        await setDoc(newDocRef, planToFirestore(planWithFbTripId))
        await dexieDb.plans.update(plan.id!, {
          firebaseId: newDocRef.id,
          tripFirebaseId,
        })
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
        const local = localByFbId.get(fbId)!
        const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
        const localMs = dateToMs(local.updatedAt)
        if (remoteMs > localMs) {
          const placeData = firestoreToPlaceData(data)
          await dexieDb.places.update(local.id!, {
            ...placeData,
            firebaseId: fbId,
          })
        } else if (localMs > remoteMs) {
          await setDoc(doc(placesRef, fbId), placeToFirestore(local))
        }
      }
    }

    for (const place of localPlaces) {
      if (!place.firebaseId) {
        const newDocRef = doc(placesRef)
        await setDoc(newDocRef, placeToFirestore(place))
        await dexieDb.places.update(place.id!, { firebaseId: newDocRef.id })
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
        const remoteData = docSnap.data()
        const remoteMs = dateToMs(fromTimestamp(remoteData.updatedAt))
        const localMs = dateToMs(localSettings.lastBackupDate)

        if (remoteMs > localMs) {
          await database.updateSettings({
            theme: remoteData.theme,
            colorPalette: remoteData.colorPalette,
            language: remoteData.language,
            isMusicPlayerEnabled: remoteData.isMusicPlayerEnabled,
            timezoneAutoDetect: remoteData.timezoneAutoDetect ?? true,
            detectedTimezone: remoteData.detectedTimezone || undefined,
          })
        } else {
          await setDoc(settingsDocRef, settingsToFirestore(localSettings))
        }
      } else {
        await setDoc(settingsDocRef, settingsToFirestore(localSettings))
      }
    } catch (error) {
      console.error('[Sync] Settings sync error:', error)
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

    // Delete associated plans in Firestore
    const plansRef = collection(firestore, 'users', this.userId, 'plans')
    const plansSnapshot = await getDocs(plansRef)
    for (const planDoc of plansSnapshot.docs) {
      if (planDoc.data().tripFirebaseId === firebaseId) {
        this.suppressEcho.add(`plan:${planDoc.id}`)
        await deleteDoc(planDoc.ref)
      }
    }

    await deleteDoc(doc(firestore, 'users', this.userId, 'trips', firebaseId))
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
