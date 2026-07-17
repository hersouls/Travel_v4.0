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
import type { Trip, Plan, Place, Settings, RouteSegment, TravelLog, Expense, SyncProgress } from '@/types'
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
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object' && !(item instanceof Timestamp) && !(item instanceof Date)
          ? stripUndefined(item as Record<string, unknown>)
          : item === undefined ? null : item,
      )
    } else if (value !== null && typeof value === 'object' && !(value instanceof Timestamp) && !(value instanceof Date)) {
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

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === maxRetries) break
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500
      console.warn(`[Sync] ${label} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms...`, error)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw lastError
}

// ============================================
// Converters: Local → Firestore
// ============================================

/** coverImage is intentionally excluded — Firestore 1MB doc limit; use Cloud Storage for binary data */
function tripToFirestore(trip: Trip): DocumentData {
  // 다른 컨버터와 동일하게 stripUndefined로 감싸 중첩 undefined(특히 budget.categoryBudgets.*)를
  // null로 변환 — Firestore는 undefined 값을 거부하므로 setDoc 실패를 방지
  return stripUndefined({
    title: trip.title,
    country: trip.country,
    timezone: trip.timezone || null,
    startDate: trip.startDate,
    endDate: trip.endDate,
    plansCount: trip.plansCount || 0,
    isFavorite: trip.isFavorite,
    shareId: trip.shareId || null,
    coverImagePath: trip.coverImagePath || null,
    budget: trip.budget ? {
      totalBudget: trip.budget.totalBudget,
      budgetCurrency: trip.budget.budgetCurrency,
      ...(trip.budget.categoryBudgets ? { categoryBudgets: trip.budget.categoryBudgets } : {}),
    } : null,
    createdAt: toTimestamp(trip.createdAt),
    updatedAt: toTimestamp(trip.updatedAt),
  }) as DocumentData
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
    latitude: toFiniteNumber(log.latitude) ?? null,
    longitude: toFiniteNumber(log.longitude) ?? null,
    address: log.address || null,
    placeName: log.placeName || null,
    memo: log.memo || null,
    expense: log.expense || null,
    createdAt: toTimestamp(log.createdAt),
    updatedAt: toTimestamp(log.updatedAt),
  } as Record<string, unknown>)
}

/** Parse a value that may be a number or numeric string into a finite number, or undefined. */
function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return isFinite(value) ? value : undefined
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return isFinite(parsed) ? parsed : undefined
  }
  return undefined
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
    latitude: toFiniteNumber(data.latitude),
    longitude: toFiniteNumber(data.longitude),
    address: data.address || undefined,
    placeName: data.placeName || undefined,
    memo: data.memo || undefined,
    expense: data.expense || undefined,
    createdAt: fromTimestamp(data.createdAt),
    updatedAt: fromTimestamp(data.updatedAt),
  }
}

function expenseToFirestore(expense: Expense): DocumentData {
  return stripUndefined({
    tripFirebaseId: expense.tripFirebaseId || '',
    day: expense.day,
    timestamp: expense.timestamp,
    category: expense.category,
    subCategory: expense.subCategory || null,
    storeName: expense.storeName,
    memo: expense.memo || null,
    items: expense.items || [],
    totalAmount: expense.totalAmount,
    currency: expense.currency,
    receiptDate: expense.receiptDate || null,
    sourceLogFirebaseId: expense.sourceLogFirebaseId || null,
    latitude: toFiniteNumber(expense.latitude) ?? null,
    longitude: toFiniteNumber(expense.longitude) ?? null,
    address: expense.address || null,
    paymentMethod: expense.paymentMethod || null,
    createdAt: toTimestamp(expense.createdAt),
    updatedAt: toTimestamp(expense.updatedAt),
  } as Record<string, unknown>)
}

function firestoreToExpenseData(data: DocumentData): Omit<Expense, 'id' | 'tripId' | 'sourceLogId'> {
  return {
    tripFirebaseId: data.tripFirebaseId || '',
    day: data.day || 1,
    timestamp: data.timestamp || new Date().toISOString(),
    category: data.category || 'other',
    subCategory: data.subCategory || undefined,
    storeName: data.storeName || '',
    memo: data.memo || undefined,
    items: data.items || [],
    totalAmount: data.totalAmount || 0,
    currency: data.currency || 'KRW',
    receiptDate: data.receiptDate || undefined,
    sourceLogFirebaseId: data.sourceLogFirebaseId || undefined,
    latitude: toFiniteNumber(data.latitude),
    longitude: toFiniteNumber(data.longitude),
    address: data.address || undefined,
    paymentMethod: data.paymentMethod || undefined,
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
    budget: data.budget ? {
      totalBudget: data.budget.totalBudget || 0,
      budgetCurrency: data.budget.budgetCurrency || 'KRW',
      categoryBudgets: data.budget.categoryBudgets || undefined,
    } : undefined,
    createdAt: fromTimestamp(data.createdAt),
    updatedAt: fromTimestamp(data.updatedAt),
  }
}

function firestoreToPlanData(data: DocumentData): Omit<Plan, 'id' | 'tripId' | 'photos'> {
  return {
    tripFirebaseId: data.tripFirebaseId || '',
    day: data.day,
    // ?? undefined (not ?? 0): 로컬 저장값과 대칭을 맞춰 order의 null↔0 표류를 제거.
    // (order 미설정 일정이 기기 간 undefined/0으로 갈리던 문제) 정렬은 order ?? MAX_SAFE_INTEGER로 undefined 안전 처리됨.
    order: data.order ?? undefined,
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
  private mergeQueue: Array<() => Promise<void>> = []
  private syncGeneration = 0
  private notifyTimer: ReturnType<typeof setTimeout> | null = null
  private tripIdCache: Map<string, number> | null = null
  private echoTimers: ReturnType<typeof setTimeout>[] = []
  private resolvedTimers: ReturnType<typeof setTimeout>[] = []
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
    const timer = setTimeout(() => {
      this.recentlyPushed.delete(key)
      this.echoTimers = this.echoTimers.filter(t => t !== timer)
    }, 10_000)
    this.echoTimers.push(timer)
  }

  private isEcho(key: string): boolean {
    return this.recentlyPushed.has(key)
  }

  // ---- Recently Resolved (skip conflict re-detection for 15s) ----
  private recentlyResolved = new Set<string>()

  markResolved(entityType: string, firebaseId: string): void {
    const key = `${entityType}:${firebaseId}`
    this.recentlyResolved.add(key)
    const timer = setTimeout(() => {
      this.recentlyResolved.delete(key)
      this.resolvedTimers = this.resolvedTimers.filter(t => t !== timer)
    }, 15_000)
    this.resolvedTimers.push(timer)
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

  // ---- Merge Queue (queue snapshots arriving during initial sync) ----

  private async drainMergeQueue(): Promise<void> {
    const queued = [...this.mergeQueue]
    this.mergeQueue = []
    if (queued.length === 0) return
    console.log(`[Sync] Draining ${queued.length} queued snapshot(s) received during merge`)
    for (const handler of queued) {
      try {
        await handler()
      } catch (e) {
        console.error('[Sync] Error processing queued snapshot:', e)
      }
    }
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
        // Build tripIdCache for real-time listeners even on cooldown skip (PERF-02)
        await this.buildTripIdCache()
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

  async stop(options?: { clearData?: boolean }): Promise<void> {
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
    this.mergeQueue = []

    // 타이머 정리
    this.echoTimers.forEach(t => clearTimeout(t))
    this.echoTimers = []
    this.resolvedTimers.forEach(t => clearTimeout(t))
    this.resolvedTimers = []
    if (this.notifyTimer) {
      clearTimeout(this.notifyTimer)
      this.notifyTimer = null
    }
    this.recentlyPushed.clear()
    this.recentlyResolved.clear()
    this.pendingDeletes.clear()
    this.tripIdCache = null
    this.failedOps = []
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    if (this._isActive) {
      this._isActive = false
      this.notifyActiveChange()
    }

    // Clear user data if requested (e.g., on logout or user switch)
    if (options?.clearData) {
      await this.clearUserData()
    }

    console.log('[Sync] Stopped')
  }

  /**
   * Clear all user-specific data from IndexedDB.
   * Preserves settings (theme, language, etc.) in both IndexedDB and localStorage.
   * Called on logout to prevent stale data resurrection on next login.
   */
  async clearUserData(): Promise<void> {
    console.log('[Sync] Clearing user data from IndexedDB...')
    try {
      await dexieDb.transaction('rw', [
        dexieDb.trips,
        dexieDb.plans,
        dexieDb.places,
        dexieDb.routeSegments,
        dexieDb.travelLogs,
        dexieDb.expenses,
      ], async () => {
        await dexieDb.trips.clear()
        await dexieDb.plans.clear()
        await dexieDb.places.clear()
        await dexieDb.routeSegments.clear()
        await dexieDb.travelLogs.clear()
        await dexieDb.expenses.clear()
      })
      // Clear sync cooldown timestamps from sessionStorage
      try {
        const keysToRemove: string[] = []
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (key?.startsWith(SyncManager.SESSION_KEY_PREFIX)) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key))
      } catch { /* ignore sessionStorage errors */ }
      console.log('[Sync] User data cleared from IndexedDB')
    } catch (error) {
      console.error('[Sync] Failed to clear user data:', error)
    }
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
    // stop() 이후 background 이미지 다운로드 콜백이 타이머를 되살려 teardown 후 콜백이 발화하는 것을 방지
    if (!this._isActive) return
    if (this.notifyTimer) clearTimeout(this.notifyTimer)
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null
      if (this._isActive) this.notifyUpdate()
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

      // Phase 1: Independent entities in parallel (Trips + Places + Settings)
      this.notifySyncStatus({ status: 'syncing', step: '기본 데이터 동기화 중...' })
      const phase1 = await Promise.allSettled([
        this.syncTripsInitial(),
        this.syncPlacesInitial(),
        this.syncSettingsInitial(),
      ])
      for (const r of phase1) {
        if (r.status === 'rejected') console.error('[Sync] Phase 1 partial failure:', r.reason)
      }
      if (this.syncGeneration !== generation) return

      // Build trip ID cache for Phase 2 (avoids N+1 resolveLocalTripId queries)
      await this.buildTripIdCache()

      // Phase 2: Dependent entities in parallel (Plans + RouteSegments + TravelLogs + Expenses need tripFirebaseId)
      this.notifySyncStatus({ status: 'syncing', step: '일정 및 기록 동기화 중...' })
      const phase2 = await Promise.allSettled([
        this.syncPlansInitial(),
        this.syncRouteSegmentsInitial(),
        this.syncTravelLogsInitial(),
        this.syncExpensesInitial(),
      ])
      for (const r of phase2) {
        if (r.status === 'rejected') console.error('[Sync] Phase 2 partial failure:', r.reason)
      }
      // tripIdCache is kept alive for real-time listeners (PERF-02)
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
      // Process any snapshots that arrived during the merge
      await this.drainMergeQueue()
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

    // Local has firebaseId but remote doesn't → deleted remotely, clean up locally
    // (firebaseId proves it was previously synced; absence from cloud = intentional deletion)
    for (const trip of localTrips) {
      if (trip.firebaseId && !remoteMap.has(trip.firebaseId) && trip.id) {
        try {
          await dexieDb.plans.where('tripId').equals(trip.id).delete()
          await dexieDb.routeSegments.where('tripId').equals(trip.id).delete()
          await dexieDb.travelLogs.where('tripId').equals(trip.id).delete()
          // 경비도 함께 삭제 (database.deleteTrip / 실시간 'removed' 핸들러와 일관성).
          // 누락 시 고아 경비가 집계에 남고 다음 동기화에서 재업로드되어 삭제분이 부활함
          await dexieDb.expenses.where('tripId').equals(trip.id).delete()
          await dexieDb.trips.delete(trip.id)
          console.log('[Sync] Deleted locally (remotely deleted trip):', trip.firebaseId, trip.title)
        } catch (e) {
          console.error('[Sync] Failed to clean up orphaned trip:', trip.firebaseId, e)
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

    // Local has firebaseId but remote doesn't → deleted remotely, clean up locally
    for (const plan of localPlans) {
      if (plan.firebaseId && !remoteMap.has(plan.firebaseId) && plan.id) {
        try {
          await dexieDb.plans.delete(plan.id)
          console.log('[Sync] Deleted locally (remotely deleted plan):', plan.firebaseId, plan.placeName)
        } catch (e) {
          console.error('[Sync] Failed to clean up orphaned plan:', plan.firebaseId, e)
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

    // Local has firebaseId but remote doesn't → deleted remotely, clean up locally
    for (const place of localPlaces) {
      if (place.firebaseId && !remoteMap.has(place.firebaseId) && place.id) {
        try {
          await dexieDb.places.delete(place.id)
          console.log('[Sync] Deleted locally (remotely deleted place):', place.firebaseId, place.name)
        } catch (e) {
          console.error('[Sync] Failed to clean up orphaned place:', place.firebaseId, e)
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

    // Local has firebaseId but remote doesn't → deleted remotely, clean up locally
    for (const seg of localSegments) {
      if (seg.firebaseId && !remoteMap.has(seg.firebaseId) && seg.id) {
        try {
          await dexieDb.routeSegments.delete(seg.id)
          console.log('[Sync] Deleted locally (remotely deleted routeSegment):', seg.firebaseId)
        } catch (e) {
          console.error('[Sync] Failed to clean up orphaned routeSegment:', seg.firebaseId, e)
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
    // Also fix Firestore data if coordinates are stored as strings
    const remoteFixQueue: Array<{ fbId: string; lat: number; lng: number }> = []

    for (const [fbId, { data }] of remoteMap) {
      try {
        // Detect and queue Firestore coordinate fix (string → number)
        const remoteNeedsFix = (typeof data.latitude === 'string' || typeof data.longitude === 'string') &&
          toFiniteNumber(data.latitude) !== undefined && toFiniteNumber(data.longitude) !== undefined
        if (remoteNeedsFix) {
          remoteFixQueue.push({ fbId, lat: toFiniteNumber(data.latitude)!, lng: toFiniteNumber(data.longitude)! })
        }

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
          } else {
            // Same timestamp → repair missing coordinates from remote
            const localHasCoords = typeof local.latitude === 'number' && isFinite(local.latitude) &&
              typeof local.longitude === 'number' && isFinite(local.longitude)
            if (!localHasCoords) {
              const logData = firestoreToTravelLogData(data)
              if (logData.latitude !== undefined && logData.longitude !== undefined) {
                await dexieDb.travelLogs.update(local.id!, { latitude: logData.latitude, longitude: logData.longitude })
              }
            }
          }
        }
      } catch (e) {
        console.error('[Sync] Failed to sync travelLog:', fbId, e)
      }
    }

    // Batch-fix Firestore documents with string coordinates → proper numbers
    if (remoteFixQueue.length > 0) {
      try {
        const batch = writeBatch(firestore)
        for (const { fbId, lat, lng } of remoteFixQueue) {
          this.markPushed(`travelLog:${fbId}`)
          const ref = doc(logsRef, fbId)
          batch.update(ref, { latitude: lat, longitude: lng })
        }
        await batch.commit()
        console.log(`[Sync] Fixed ${remoteFixQueue.length} travelLog coordinate types in Firestore (string → number)`)
      } catch (e) {
        console.error('[Sync] Failed to fix Firestore travelLog coordinates:', e)
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

    // Local has firebaseId but remote doesn't → deleted remotely, clean up locally
    for (const log of localLogs) {
      if (log.firebaseId && !remoteMap.has(log.firebaseId) && log.id) {
        try {
          await dexieDb.travelLogs.delete(log.id)
          console.log('[Sync] Deleted locally (remotely deleted travelLog):', log.firebaseId)
        } catch (e) {
          console.error('[Sync] Failed to clean up orphaned travelLog:', log.firebaseId, e)
        }
      }
    }
  }

  private async syncExpensesInitial(): Promise<void> {
    if (!this.userId) return
    const firestore = getFirebaseDb()
    const expensesRef = collection(firestore, 'users', this.userId, 'expenses')

    const [snapshot, localExpenses] = await Promise.all([
      withRetry(() => getDocs(expensesRef), 'Expenses fetch'),
      dexieDb.expenses.toArray(),
    ])

    const remoteMap = new Map<string, { docId: string; data: DocumentData }>()
    for (const docSnap of snapshot.docs) {
      remoteMap.set(docSnap.id, { docId: docSnap.id, data: docSnap.data() })
    }

    const localByFbId = new Map<string, Expense>()
    for (const expense of localExpenses) {
      if (expense.firebaseId) localByFbId.set(expense.firebaseId, expense)
    }

    // Remote-only → create locally
    for (const [fbId, { data }] of remoteMap) {
      try {
        if (!localByFbId.has(fbId)) {
          const expenseData = firestoreToExpenseData(data)
          const localTripId = await this.resolveLocalTripId(data.tripFirebaseId)
          if (localTripId === null) {
            console.warn('[Sync] Skipping expense - trip not found:', data.tripFirebaseId)
            continue
          }
          await dexieDb.expenses.add({
            ...expenseData,
            firebaseId: fbId,
            tripId: localTripId,
          } as Expense)
        } else {
          // Both exist → newer wins
          const local = localByFbId.get(fbId)!
          const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
          const localMs = dateToMs(local.updatedAt)
          if (remoteMs > localMs) {
            const expenseData = firestoreToExpenseData(data)
            await dexieDb.expenses.update(local.id!, { ...expenseData, firebaseId: fbId })
          } else if (localMs > remoteMs) {
            let tripFbId = local.tripFirebaseId
            if (!tripFbId) tripFbId = (await this.resolveTripFirebaseId(local.tripId)) || ''
            const expenseWithTripFbId = { ...local, tripFirebaseId: tripFbId }
            this.markPushed(`expense:${fbId}`)
            await setDoc(doc(expensesRef, fbId), expenseToFirestore(expenseWithTripFbId))
          }
        }
      } catch (e) {
        console.error('[Sync] Failed to sync expense:', fbId, e)
      }
    }

    // Local-only (no firebaseId) → push to cloud
    for (const expense of localExpenses) {
      if (!expense.firebaseId && expense.id) {
        try {
          let tripFbId = expense.tripFirebaseId
          if (!tripFbId) tripFbId = (await this.resolveTripFirebaseId(expense.tripId)) || ''
          if (!tripFbId) {
            console.warn('[Sync] Skipping local-only expense push — no tripFirebaseId:', expense.id)
            continue
          }
          const expenseWithTripFbId = { ...expense, tripFirebaseId: tripFbId }
          const newDocRef = doc(expensesRef)
          this.markPushed(`expense:${newDocRef.id}`)
          await setDoc(newDocRef, expenseToFirestore(expenseWithTripFbId))
          await dexieDb.expenses.update(expense.id, { firebaseId: newDocRef.id })
          console.log('[Sync] Pushed local-only expense to cloud:', expense.id, '→', newDocRef.id)
        } catch (e) {
          console.error('[Sync] Failed to push local-only expense:', expense.id, e)
        }
      }
    }

    // Local has firebaseId but remote doesn't → deleted remotely, clean up locally
    for (const expense of localExpenses) {
      if (expense.firebaseId && !remoteMap.has(expense.firebaseId) && expense.id) {
        try {
          await dexieDb.expenses.delete(expense.id)
          console.log('[Sync] Deleted locally (remotely deleted expense):', expense.firebaseId)
        } catch (e) {
          console.error('[Sync] Failed to clean up orphaned expense:', expense.firebaseId, e)
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
      const processTrips = async () => {
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
            const addedId = await dexieDb.trips.add({ ...tripData, firebaseId: docId, coverImage: '', coverImagePath: data.coverImagePath || undefined } as Trip)
            if (this.tripIdCache && addedId) this.tripIdCache.set(docId, addedId as number)
            changed = true
            // Drain any child docs (plans/segments/logs/expenses) that arrived before this trip.
            await this.drainPendingChildren(docId)
            // Trigger background image download if cloud has image
            if (data.coverImagePath) {
              import('@/services/imageSync').then(({ scheduleImageDownload, downloadTripCoverImage }) => {
                scheduleImageDownload(`trip-cover:${docId}`, async () => {
                  const added = await dexieDb.trips.where('firebaseId').equals(docId).first()
                  if (added) await downloadTripCoverImage(added)
                }, () => this.notifyUpdateDebounced())
              }).catch(e => console.error('[Sync] Trip image download schedule failed:', e))
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
                import('@/services/imageSync').then(({ scheduleImageDownload, downloadTripCoverImage }) => {
                  scheduleImageDownload(`trip-cover:${docId}`, async () => {
                    const t = await dexieDb.trips.get(local.id!)
                    if (t) await downloadTripCoverImage({ ...t, coverImage: '' })
                  }, () => this.notifyUpdateDebounced())
                }).catch(e => console.error('[Sync] Trip image download schedule failed:', e))
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
                import('@/services/imageSync').then(({ scheduleImageDownload, downloadTripCoverImage }) => {
                  scheduleImageDownload(`trip-cover:${docId}`, async () => {
                    const t = await dexieDb.trips.get(local.id!)
                    if (t) await downloadTripCoverImage(t)
                  }, () => this.notifyUpdateDebounced())
                }).catch(e => console.error('[Sync] Trip image download schedule failed:', e))
              }
            }
          }
        } else if (change.type === 'removed') {
          const local = await database.getTripByFirebaseId(docId)
          if (local?.id) {
            await dexieDb.plans.where('tripId').equals(local.id).delete()
            await dexieDb.routeSegments.where('tripId').equals(local.id).delete()
            await dexieDb.travelLogs.where('tripId').equals(local.id).delete()
            await dexieDb.expenses.where('tripId').equals(local.id).delete()
            await dexieDb.trips.delete(local.id)
            if (this.tripIdCache) this.tripIdCache.delete(docId)
            changed = true
          }
        }
      }
      if (changed) this.notifyUpdateDebounced()
      } // end processTrips
      if (this.mergeInProgress) { this.mergeQueue.push(processTrips); return }
      await processTrips()
    }, (error) => console.error('[Sync] Trip listener error:', error))
    this.unsubscribers.push(tripUnsub)

    // Plan listener
    const plansRef = collection(firestore, 'users', this.userId, 'plans')
    const planUnsub = onSnapshot(plansRef, async (snapshot) => {
      const processPlans = async () => {
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
            const addNewPlan = async (resolvedTripId: number) => {
              if (await database.getPlanByFirebaseId(docId)) return // race guard: already added
              await dexieDb.plans.add({ ...planData, firebaseId: docId, tripId: resolvedTripId, photos: [], photoPaths: data.photoPaths || undefined } as Plan)
              // Trigger background image download if cloud has photos
              if (data.photoPaths?.length) {
                import('@/services/imageSync').then(({ scheduleImageDownload, downloadPlanPhotos }) => {
                  scheduleImageDownload(`plan-photos:${docId}`, async () => {
                    const added = await dexieDb.plans.where('firebaseId').equals(docId).first()
                    if (added) await downloadPlanPhotos(added)
                  }, () => this.notifyUpdateDebounced())
                }).catch(e => console.error('[Sync] Plan photos download schedule failed:', e))
              }
            }
            const localTripId = await this.resolveLocalTripId(data.tripFirebaseId)
            if (localTripId === null) {
              // Parent trip snapshot hasn't arrived yet — buffer and retry on trip add.
              this.enqueuePendingChild(data.tripFirebaseId, async () => {
                const resolved = await this.resolveLocalTripId(data.tripFirebaseId)
                if (resolved === null) return
                await addNewPlan(resolved)
                this.notifyUpdateDebounced()
              })
              continue
            }
            await addNewPlan(localTripId)
            affectedTripIds.add(localTripId)
            changed = true
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
                import('@/services/imageSync').then(({ scheduleImageDownload, downloadPlanPhotos }) => {
                  scheduleImageDownload(`plan-photos:${docId}`, async () => {
                    const p = await dexieDb.plans.get(local.id!)
                    if (p) await downloadPlanPhotos({ ...p, photos: [] })
                  }, () => this.notifyUpdateDebounced())
                }).catch(e => console.error('[Sync] Plan photos download schedule failed:', e))
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
                import('@/services/imageSync').then(({ scheduleImageDownload, downloadPlanPhotos }) => {
                  scheduleImageDownload(`plan-photos:${docId}`, async () => {
                    const p = await dexieDb.plans.get(local.id!)
                    if (p) await downloadPlanPhotos({ ...p, photos: [] })
                  }, () => this.notifyUpdateDebounced())
                }).catch(e => console.error('[Sync] Plan photos download schedule failed:', e))
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
      // Recalculate plansCount for affected trips (parallel)
      if (changed) {
        await Promise.all([...affectedTripIds].map(async (tripId) => {
          const count = await dexieDb.plans.where('tripId').equals(tripId).count()
          await dexieDb.trips.update(tripId, { plansCount: count })
        }))
        this.notifyUpdateDebounced()
      }
      } // end processPlans
      if (this.mergeInProgress) { this.mergeQueue.push(processPlans); return }
      await processPlans()
    }, (error) => console.error('[Sync] Plan listener error:', error))
    this.unsubscribers.push(planUnsub)

    // Place listener
    const placesRef = collection(firestore, 'users', this.userId, 'places')
    const placeUnsub = onSnapshot(placesRef, async (snapshot) => {
      const processPlaces = async () => {
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
              import('@/services/imageSync').then(({ scheduleImageDownload, downloadPlacePhotos }) => {
                scheduleImageDownload(`place-photos:${docId}`, async () => {
                  const added = await dexieDb.places.where('firebaseId').equals(docId).first()
                  if (added) await downloadPlacePhotos(added)
                }, () => this.notifyUpdateDebounced())
              }).catch(e => console.error('[Sync] Place photos download schedule failed:', e))
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
                import('@/services/imageSync').then(({ scheduleImageDownload, downloadPlacePhotos }) => {
                  scheduleImageDownload(`place-photos:${docId}`, async () => {
                    const p = await dexieDb.places.get(local.id!)
                    if (p) await downloadPlacePhotos({ ...p, photos: [] })
                  }, () => this.notifyUpdateDebounced())
                }).catch(e => console.error('[Sync] Place photos download schedule failed:', e))
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
                import('@/services/imageSync').then(({ scheduleImageDownload, downloadPlacePhotos }) => {
                  scheduleImageDownload(`place-photos:${docId}`, async () => {
                    const p = await dexieDb.places.get(local.id!)
                    if (p) await downloadPlacePhotos({ ...p, photos: [] })
                  }, () => this.notifyUpdateDebounced())
                }).catch(e => console.error('[Sync] Place photos download schedule failed:', e))
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
      } // end processPlaces
      if (this.mergeInProgress) { this.mergeQueue.push(processPlaces); return }
      await processPlaces()
    }, (error) => console.error('[Sync] Place listener error:', error))
    this.unsubscribers.push(placeUnsub)

    // Settings listener
    const settingsDocRef = doc(firestore, 'users', this.userId, 'settings', 'main')
    const settingsUnsub = onSnapshot(settingsDocRef, async (docSnap) => {
      const processSettings = async () => {
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
      } // end processSettings
      if (this.mergeInProgress) { this.mergeQueue.push(processSettings); return }
      await processSettings()
    }, (error) => console.error('[Sync] Settings listener error:', error))
    this.unsubscribers.push(settingsUnsub)

    // RouteSegment listener
    const segmentsRef = collection(firestore, 'users', this.userId, 'routeSegments')
    const segmentUnsub = onSnapshot(segmentsRef, async (snapshot) => {
      const processSegments = async () => {
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
            const addNewSegment = async (resolvedTripId: number) => {
              if (await database.getRouteSegmentByFirebaseId(docId)) return // race guard
              await dexieDb.routeSegments.add({
                ...segData,
                firebaseId: docId,
                tripId: resolvedTripId,
              } as RouteSegment)
            }
            const localTripId = await this.resolveLocalTripId(data.tripFirebaseId)
            if (localTripId === null) {
              this.enqueuePendingChild(data.tripFirebaseId, async () => {
                const resolved = await this.resolveLocalTripId(data.tripFirebaseId)
                if (resolved === null) return
                await addNewSegment(resolved)
                this.notifyUpdateDebounced()
              })
              continue
            }
            await addNewSegment(localTripId)
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
      } // end processSegments
      if (this.mergeInProgress) { this.mergeQueue.push(processSegments); return }
      await processSegments()
    }, (error) => console.error('[Sync] RouteSegment listener error:', error))
    this.unsubscribers.push(segmentUnsub)

    // TravelLog listener
    const logsRef = collection(firestore, 'users', this.userId, 'travelLogs')
    const logUnsub = onSnapshot(logsRef, async (snapshot) => {
      const processLogs = async () => {
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
            const addNewLog = async (resolvedTripId: number) => {
              if (await database.getTravelLogByFirebaseId(docId)) return // race guard
              await dexieDb.travelLogs.add({
                ...logData,
                firebaseId: docId,
                tripId: resolvedTripId,
                photo: undefined,
                thumbnailPhoto: undefined,
                photoPath: data.photoPath || undefined,
                thumbnailPhotoPath: data.thumbnailPhotoPath || undefined,
              } as TravelLog)
              // Trigger background image download if cloud has photo
              if (data.photoPath) {
                import('@/services/imageSync').then(({ scheduleImageDownload, downloadTravelLogPhoto }) => {
                  scheduleImageDownload(`travellog-photo:${docId}`, async () => {
                    const added = await dexieDb.travelLogs.where('firebaseId').equals(docId).first()
                    if (added) await downloadTravelLogPhoto(added)
                  }, () => this.notifyUpdateDebounced())
                }).catch(e => console.error('[Sync] TravelLog photo download schedule failed:', e))
              }
            }
            const localTripId = await this.resolveLocalTripId(data.tripFirebaseId)
            if (localTripId === null) {
              this.enqueuePendingChild(data.tripFirebaseId, async () => {
                const resolved = await this.resolveLocalTripId(data.tripFirebaseId)
                if (resolved === null) return
                await addNewLog(resolved)
                this.notifyUpdateDebounced()
              })
              continue
            }
            await addNewLog(localTripId)
            changed = true
          } else {
            const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
            const localMs = dateToMs(local.updatedAt)
            if (remoteMs > localMs) {
              const logData = firestoreToTravelLogData(data)
              await dexieDb.travelLogs.update(local.id!, { ...logData, firebaseId: docId, photo: local.photo || undefined, thumbnailPhoto: local.thumbnailPhoto || undefined })
              changed = true
              // Trigger background image download if cloud has updated photo path
              if (data.photoPath && data.photoPath !== local.photoPath) {
                import('@/services/imageSync').then(({ scheduleImageDownload, downloadTravelLogPhoto }) => {
                  scheduleImageDownload(`travellog-photo:${docId}`, async () => {
                    const l = await dexieDb.travelLogs.get(local.id!)
                    if (l) await downloadTravelLogPhoto(l)
                  }, () => this.notifyUpdateDebounced())
                }).catch(e => console.error('[Sync] TravelLog photo download schedule failed:', e))
              }
            }
            // Image path sync — independent of timestamp (paths arrive later via fire-and-forget upload)
            if (data.photoPath && data.photoPath !== local.photoPath) {
              await dexieDb.travelLogs.update(local.id!, { photoPath: data.photoPath, thumbnailPhotoPath: data.thumbnailPhotoPath })
              if (!local.photo) {
                import('@/services/imageSync').then(({ scheduleImageDownload, downloadTravelLogPhoto }) => {
                  scheduleImageDownload(`travellog-photo:${docId}`, async () => {
                    const l = await dexieDb.travelLogs.get(local.id!)
                    if (l) await downloadTravelLogPhoto(l)
                  }, () => this.notifyUpdateDebounced())
                }).catch(e => console.error('[Sync] TravelLog photo download schedule failed:', e))
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
      } // end processLogs
      if (this.mergeInProgress) { this.mergeQueue.push(processLogs); return }
      await processLogs()
    }, (error) => console.error('[Sync] TravelLog listener error:', error))
    this.unsubscribers.push(logUnsub)

    // Expense listener
    const expensesRef = collection(firestore, 'users', this.userId, 'expenses')
    const expenseUnsub = onSnapshot(expensesRef, async (snapshot) => {
      const processExpenses = async () => {
      let changed = false
      for (const change of snapshot.docChanges()) {
        const docId = change.doc.id
        if (this.isEcho(`expense:${docId}`)) continue
        if (this.isPendingDelete(docId)) continue

        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data()
          const local = await database.getExpenseByFirebaseId(docId)
          if (!local) {
            const expenseData = firestoreToExpenseData(data)
            const addNewExpense = async (resolvedTripId: number) => {
              if (await database.getExpenseByFirebaseId(docId)) return // race guard
              await dexieDb.expenses.add({
                ...expenseData,
                firebaseId: docId,
                tripId: resolvedTripId,
              } as Expense)
            }
            const localTripId = await this.resolveLocalTripId(data.tripFirebaseId)
            if (localTripId === null) {
              this.enqueuePendingChild(data.tripFirebaseId, async () => {
                const resolved = await this.resolveLocalTripId(data.tripFirebaseId)
                if (resolved === null) return
                await addNewExpense(resolved)
                this.notifyUpdateDebounced()
              })
              continue
            }
            await addNewExpense(localTripId)
            changed = true
          } else {
            const remoteMs = dateToMs(fromTimestamp(data.updatedAt))
            const localMs = dateToMs(local.updatedAt)
            if (remoteMs > localMs) {
              const expenseData = firestoreToExpenseData(data)
              await dexieDb.expenses.update(local.id!, { ...expenseData, firebaseId: docId })
              changed = true
            }
          }
        } else if (change.type === 'removed') {
          const local = await database.getExpenseByFirebaseId(docId)
          if (local?.id) {
            await dexieDb.expenses.delete(local.id)
            changed = true
          }
        }
      }
      if (changed) this.notifyUpdateDebounced()
      } // end processExpenses
      if (this.mergeInProgress) { this.mergeQueue.push(processExpenses); return }
      await processExpenses()
    }, (error) => console.error('[Sync] Expense listener error:', error))
    this.unsubscribers.push(expenseUnsub)
  }

  // ============================================
  // Batch Write Queue (debounced 500ms)
  // ============================================

  private batchQueue: Array<{
    type: 'set' | 'delete'
    ref: DocumentReference
    data?: DocumentData
    echoKey?: string
    retryCount?: number
  }> = []
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private failedOps: Array<{ type: 'set' | 'delete'; ref: DocumentReference; data?: DocumentData; echoKey?: string; retryCount?: number }> = []
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryAttempt = 0
  private static readonly BATCH_DEBOUNCE_MS = 500
  private static readonly MAX_BATCH_SIZE = 450 // Firestore limit is 500
  private static readonly MAX_RETRY_COUNT = 3

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
        this.retryAttempt = 0
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
            const retryCount = (op.retryCount ?? 0) + 1
            if (retryCount < SyncManager.MAX_RETRY_COUNT) {
              console.warn(`[Sync] Individual write failed (attempt ${retryCount}/${SyncManager.MAX_RETRY_COUNT}):`, e)
              this.failedOps.push({ ...op, retryCount })
            } else {
              console.error(`[Sync] Permanently failed after ${SyncManager.MAX_RETRY_COUNT} retries:`, op.ref.path, e)
            }
          }
        }
      }
    }

    // Schedule retry for any failed operations
    if (this.failedOps.length > 0) {
      this.scheduleRetry()
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return
    this.retryAttempt++
    if (this.retryAttempt > 3) {
      console.error(`[Sync] Giving up after ${this.retryAttempt} retry cycles. ${this.failedOps.length} ops permanently failed.`)
      this.failedOps = []
      this.retryAttempt = 0
      return
    }
    const delay = 10_000 * Math.pow(2, this.retryAttempt - 1) // 10s, 20s, 40s
    console.log(`[Sync] Scheduling retry #${this.retryAttempt} in ${delay / 1000}s for ${this.failedOps.length} ops`)
    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null
      if (this.failedOps.length === 0) { this.retryAttempt = 0; return }
      const ops = [...this.failedOps]
      this.failedOps = []
      console.log(`[Sync] Retrying ${ops.length} failed operations (attempt ${this.retryAttempt})...`)
      this.batchQueue.push(...ops)
      this.scheduleBatchFlush()
    }, delay)
  }

  // ============================================
  // Upload Methods (called by stores)
  // ============================================

  async uploadTrip(trip: Trip): Promise<string> {
    if (!this.userId) return trip.firebaseId || ''
    const firestore = getFirebaseDb()
    const tripsRef = collection(firestore, 'users', this.userId, 'trips')

    if (trip.firebaseId) {
      // Existing doc → batch queue for efficiency
      this.queueWrite(doc(tripsRef, trip.firebaseId), tripToFirestore(trip), `trip:${trip.firebaseId}`)
      return trip.firebaseId
    }

    // New doc → immediate write (caller needs the firebaseId)
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
      // Existing doc → batch queue for efficiency
      this.queueWrite(doc(plansRef, plan.firebaseId), planToFirestore(planWithTripFbId), `plan:${plan.firebaseId}`)
      return plan.firebaseId
    }

    // New doc → immediate write (caller needs the firebaseId)
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
      // Existing doc → batch queue for efficiency
      this.queueWrite(doc(placesRef, place.firebaseId), placeToFirestore(place), `place:${place.firebaseId}`)
      return place.firebaseId
    }

    // New doc → immediate write (caller needs the firebaseId)
    const newDocRef = doc(placesRef)
    this.markPushed(`place:${newDocRef.id}`)
    await setDoc(newDocRef, placeToFirestore(place))
    return newDocRef.id
  }

  async uploadSettings(settings: Settings): Promise<void> {
    if (!this.userId) return
    const firestore = getFirebaseDb()
    const settingsDocRef = doc(firestore, 'users', this.userId, 'settings', 'main')
    // Settings update → batch queue for efficiency
    this.queueWrite(settingsDocRef, settingsToFirestore(settings), 'settings')
  }

  async deleteRemoteTrip(firebaseId: string, signal?: AbortSignal): Promise<void> {
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

    // Also delete associated expenses
    const expensesRef = collection(firestore, 'users', this.userId, 'expenses')
    const expensesSnapshot = await getDocs(expensesRef)

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

    for (const expDoc of expensesSnapshot.docs) {
      if (expDoc.data().tripFirebaseId === firebaseId) {
        this.markPushed(`expense:${expDoc.id}`)
        batch.delete(expDoc.ref)
        opCount++
      }
    }

    batch.delete(doc(firestore, 'users', this.userId, 'trips', firebaseId))
    opCount++

    // Check if abort requested before committing
    if (signal?.aborted) return

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
      for (const expDoc of expensesSnapshot.docs) {
        if (expDoc.data().tripFirebaseId === firebaseId) allRefs.push(expDoc.ref)
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
      // Existing doc → batch queue for efficiency
      this.queueWrite(doc(segmentsRef, segment.firebaseId), routeSegmentToFirestore(segment), `routeSegment:${segment.firebaseId}`)
      return segment.firebaseId
    }

    // New doc → immediate write (caller needs the firebaseId)
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
      // Existing doc → batch queue for efficiency
      this.queueWrite(doc(logsRef, log.firebaseId), travelLogToFirestore(logWithTripFbId), `travelLog:${log.firebaseId}`)
      return log.firebaseId
    }

    // New doc → immediate write (caller needs the firebaseId)
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

  async uploadExpense(expense: Expense): Promise<string> {
    if (!this.userId) return expense.firebaseId || ''
    const firestore = getFirebaseDb()
    const expensesRef = collection(firestore, 'users', this.userId, 'expenses')

    // Ensure tripFirebaseId is set
    let tripFbId = expense.tripFirebaseId
    if (!tripFbId) {
      tripFbId = await this.resolveTripFirebaseId(expense.tripId) || ''
    }
    const expenseWithTripFbId = { ...expense, tripFirebaseId: tripFbId }

    if (expense.firebaseId) {
      this.queueWrite(doc(expensesRef, expense.firebaseId), expenseToFirestore(expenseWithTripFbId), `expense:${expense.firebaseId}`)
      return expense.firebaseId
    }

    const newDocRef = doc(expensesRef)
    this.markPushed(`expense:${newDocRef.id}`)
    await setDoc(newDocRef, expenseToFirestore(expenseWithTripFbId))
    return newDocRef.id
  }

  async deleteRemoteExpense(firebaseId: string): Promise<void> {
    if (!this.userId || !firebaseId) return
    const firestore = getFirebaseDb()
    this.markPushed(`expense:${firebaseId}`)
    await deleteDoc(doc(firestore, 'users', this.userId, 'expenses', firebaseId))
  }

  async deleteRemoteExpensesForTrip(tripFirebaseId: string): Promise<void> {
    if (!this.userId || !tripFirebaseId) return
    const firestore = getFirebaseDb()
    const expensesRef = collection(firestore, 'users', this.userId, 'expenses')
    const expensesSnapshot = await getDocs(expensesRef)

    const batch = writeBatch(firestore)
    let opCount = 0

    for (const expenseDoc of expensesSnapshot.docs) {
      if (expenseDoc.data().tripFirebaseId === tripFirebaseId) {
        this.markPushed(`expense:${expenseDoc.id}`)
        batch.delete(expenseDoc.ref)
        opCount++
      }
    }

    if (opCount > 0) {
      if (opCount <= 450) {
        await batch.commit()
      } else {
        const allRefs: DocumentReference[] = []
        for (const expenseDoc of expensesSnapshot.docs) {
          if (expenseDoc.data().tripFirebaseId === tripFirebaseId) allRefs.push(expenseDoc.ref)
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

  // Children (plan/routeSegment/travelLog/expense) whose parent trip snapshot has
  // not arrived yet. Keyed by tripFirebaseId; drained when the trip doc is added.
  // Closes the cross-device race where a dependent snapshot is processed before
  // its parent trip, which previously dropped the record permanently.
  private pendingChildAdds = new Map<string, Array<() => Promise<void>>>()

  private enqueuePendingChild(tripFirebaseId: string, retry: () => Promise<void>): void {
    if (!tripFirebaseId) return
    const list = this.pendingChildAdds.get(tripFirebaseId)
    if (list) {
      list.push(retry)
    } else {
      this.pendingChildAdds.set(tripFirebaseId, [retry])
    }
  }

  private async drainPendingChildren(tripFirebaseId: string): Promise<void> {
    const list = this.pendingChildAdds.get(tripFirebaseId)
    if (!list || list.length === 0) return
    this.pendingChildAdds.delete(tripFirebaseId)
    for (const retry of list) {
      try {
        await retry()
      } catch (e) {
        console.error('[Sync] Pending child add retry failed:', e)
      }
    }
  }

  private async buildTripIdCache(): Promise<void> {
    const trips = await dexieDb.trips.toArray()
    this.tripIdCache = new Map()
    for (const trip of trips) {
      if (trip.firebaseId && trip.id) {
        this.tripIdCache.set(trip.firebaseId, trip.id)
      }
    }
  }

  private async resolveLocalTripId(tripFirebaseId: string): Promise<number | null> {
    if (!tripFirebaseId) return null
    const cached = this.tripIdCache?.get(tripFirebaseId)
    if (cached != null) return cached
    // Cache miss: fall back to the DB so a newly-added trip not yet reflected in
    // the cache is still found, and back-fill the cache for next time.
    const trip = await database.getTripByFirebaseId(tripFirebaseId)
    if (trip?.id != null) {
      this.tripIdCache?.set(tripFirebaseId, trip.id)
      return trip.id
    }
    return null
  }

  private async resolveTripFirebaseId(localTripId: number): Promise<string | null> {
    const trip = await dexieDb.trips.get(localTripId)
    return trip?.firebaseId ?? null
  }
}

// Singleton
export const syncManager = new SyncManager()
