// ============================================
// Dexie Database Service
// ============================================

import Dexie, { type Table } from 'dexie'
import type { Trip, Plan, Place, Settings, RouteSegment } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'

class TravelDatabase extends Dexie {
  trips!: Table<Trip, number>
  plans!: Table<Plan, number>
  places!: Table<Place, number>
  settings!: Table<Settings, string>
  routeSegments!: Table<RouteSegment, number>

  constructor() {
    super('MoonwaveTravel')

    this.version(1).stores({
      trips: '++id, title, country, startDate, isFavorite, updatedAt',
      plans: '++id, tripId, day, type, [tripId+day]',
      places: '++id, name, type, isFavorite, usageCount',
      settings: 'id',
    })

    // v2: Add firebaseId indexes for cloud sync
    this.version(2).stores({
      trips: '++id, title, country, startDate, isFavorite, updatedAt, firebaseId',
      plans: '++id, tripId, day, type, [tripId+day], firebaseId, tripFirebaseId',
      places: '++id, name, type, isFavorite, usageCount, firebaseId',
      settings: 'id',
    })

    // v3: Add routeSegments table for Google Maps Directions caching
    this.version(3).stores({
      trips: '++id, title, country, startDate, isFavorite, updatedAt, firebaseId',
      plans: '++id, tripId, day, type, [tripId+day], firebaseId, tripFirebaseId',
      places: '++id, name, type, isFavorite, usageCount, firebaseId',
      settings: 'id',
      routeSegments: '++id, tripId, [fromPlanId+toPlanId], firebaseId, tripFirebaseId',
    })
  }
}

export const db = new TravelDatabase()

// ============================================
// Trip CRUD Operations
// ============================================

export async function getAllTrips(): Promise<Trip[]> {
  return db.trips.orderBy('updatedAt').reverse().toArray()
}

export async function getFavoriteTrips(): Promise<Trip[]> {
  return db.trips.where('isFavorite').equals(1).toArray()
}

export async function getTrip(id: number): Promise<Trip | undefined> {
  return db.trips.get(id)
}

export async function addTrip(trip: Omit<Trip, 'id'>): Promise<number> {
  return db.trips.add(trip as Trip)
}

export async function updateTrip(id: number, updates: Partial<Trip>): Promise<void> {
  await db.trips.update(id, { ...updates, updatedAt: new Date() })
}

export async function deleteTrip(id: number): Promise<void> {
  await db.transaction('rw', [db.trips, db.plans, db.routeSegments], async () => {
    await db.plans.where('tripId').equals(id).delete()
    await db.routeSegments.where('tripId').equals(id).delete()
    await db.trips.delete(id)
  })
}

export async function toggleTripFavorite(id: number): Promise<void> {
  const trip = await db.trips.get(id)
  if (trip) {
    await db.trips.update(id, {
      isFavorite: !trip.isFavorite,
      updatedAt: new Date(),
    })
  }
}

export async function updateTripPlansCount(tripId: number): Promise<void> {
  const count = await db.plans.where('tripId').equals(tripId).count()
  await db.trips.update(tripId, { plansCount: count })
}

// ============================================
// Firebase ID Lookups (for cloud sync)
// ============================================

export async function getTripByFirebaseId(firebaseId: string): Promise<Trip | undefined> {
  return db.trips.where('firebaseId').equals(firebaseId).first()
}

export async function getPlanByFirebaseId(firebaseId: string): Promise<Plan | undefined> {
  return db.plans.where('firebaseId').equals(firebaseId).first()
}

export async function getPlaceByFirebaseId(firebaseId: string): Promise<Place | undefined> {
  return db.places.where('firebaseId').equals(firebaseId).first()
}

// ============================================
// Plan CRUD Operations
// ============================================

export async function getPlansForTrip(tripId: number): Promise<Plan[]> {
  return db.plans.where('tripId').equals(tripId).sortBy('day')
}

export async function getPlansForTripDay(tripId: number, day: number): Promise<Plan[]> {
  return db.plans.where({ tripId, day }).sortBy('startTime')
}

export async function getPlan(id: number): Promise<Plan | undefined> {
  return db.plans.get(id)
}

export async function addPlan(plan: Omit<Plan, 'id'>): Promise<number> {
  const id = await db.plans.add(plan as Plan)
  await updateTripPlansCount(plan.tripId)
  return id
}

export async function updatePlan(id: number, updates: Partial<Plan>): Promise<void> {
  await db.plans.update(id, { ...updates, updatedAt: new Date() })
}

export async function deletePlan(id: number): Promise<void> {
  const plan = await db.plans.get(id)
  if (plan) {
    await db.plans.delete(id)
    await updateTripPlansCount(plan.tripId)
  }
}

// ============================================
// RouteSegment CRUD Operations
// ============================================

export async function getRouteSegmentsForTrip(tripId: number): Promise<RouteSegment[]> {
  return db.routeSegments.where('tripId').equals(tripId).toArray()
}

export async function getRouteSegment(
  fromPlanId: number,
  toPlanId: number,
): Promise<RouteSegment | undefined> {
  return db.routeSegments.where({ fromPlanId, toPlanId }).first()
}

export async function upsertRouteSegment(
  segment: Omit<RouteSegment, 'id'>,
): Promise<number> {
  const existing = await db.routeSegments
    .where({ fromPlanId: segment.fromPlanId, toPlanId: segment.toPlanId })
    .first()

  if (existing?.id) {
    await db.routeSegments.update(existing.id, { ...segment, updatedAt: new Date() })
    return existing.id
  }
  return db.routeSegments.add(segment as RouteSegment)
}

export async function deleteRouteSegmentsForTrip(tripId: number): Promise<void> {
  await db.routeSegments.where('tripId').equals(tripId).delete()
}

export async function deleteRouteSegmentsForPlan(planId: number): Promise<void> {
  await db.routeSegments
    .filter((s) => s.fromPlanId === planId || s.toPlanId === planId)
    .delete()
}

export async function getRouteSegmentByFirebaseId(
  firebaseId: string,
): Promise<RouteSegment | undefined> {
  return db.routeSegments.where('firebaseId').equals(firebaseId).first()
}

// ============================================
// Place CRUD Operations
// ============================================

export async function getAllPlaces(): Promise<Place[]> {
  return db.places.orderBy('usageCount').reverse().toArray()
}

export async function getFavoritePlaces(): Promise<Place[]> {
  return db.places.where('isFavorite').equals(1).toArray()
}

export async function getPlace(id: number): Promise<Place | undefined> {
  return db.places.get(id)
}

export async function addPlace(place: Omit<Place, 'id'>): Promise<number> {
  return db.places.add(place as Place)
}

export async function updatePlace(id: number, updates: Partial<Place>): Promise<void> {
  await db.places.update(id, { ...updates, updatedAt: new Date() })
}

export async function deletePlace(id: number): Promise<void> {
  await db.places.delete(id)
}

export async function incrementPlaceUsage(id: number): Promise<void> {
  const place = await db.places.get(id)
  if (place) {
    await db.places.update(id, {
      usageCount: (place.usageCount || 0) + 1,
      updatedAt: new Date(),
    })
  }
}

export async function togglePlaceFavorite(id: number): Promise<void> {
  const place = await db.places.get(id)
  if (place) {
    await db.places.update(id, {
      isFavorite: !place.isFavorite,
      updatedAt: new Date(),
    })
  }
}

export async function findPlaceByName(name: string): Promise<Place | undefined> {
  return db.places.where('name').equals(name).first()
}

export async function findPlaceByGoogleId(googlePlaceId: string): Promise<Place | undefined> {
  return db.places.filter((p) => p.googlePlaceId === googlePlaceId).first()
}

// ============================================
// Settings Operations
// ============================================

export async function getSettings(): Promise<Settings> {
  const settings = await db.settings.get('main')
  return settings || DEFAULT_SETTINGS
}

export async function updateSettings(updates: Partial<Settings>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...updates, id: 'main' })
}

// ============================================
// Backup & Restore
// ============================================

import { APP_VERSION, SCHEMA_VERSION } from '@/utils/constants'
import { sendBroadcast } from './broadcast'

export interface BackupData {
  version: string
  appVersion: string
  schemaVersion: number
  exportedAt: string
  trips: Trip[]
  plans: Plan[]
  places: Place[]
  settings: Settings
  routeSegments?: RouteSegment[]
}

// Serialize Date objects to ISO strings
function serializeDates<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj
  if (obj instanceof Date) return obj.toISOString() as unknown as T
  if (Array.isArray(obj)) return obj.map(serializeDates) as unknown as T
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeDates(value)
    }
    return result as T
  }
  return obj
}

// Deserialize ISO strings back to Date objects
function deserializeDates<T>(obj: T, dateFields: string[]): T {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) {
    return obj.map((item) => deserializeDates(item, dateFields)) as unknown as T
  }
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (dateFields.includes(key) && typeof value === 'string') {
        result[key] = new Date(value)
      } else if (typeof value === 'object') {
        result[key] = deserializeDates(value, dateFields)
      } else {
        result[key] = value
      }
    }
    return result as T
  }
  return obj
}

const DATE_FIELDS = [
  'createdAt',
  'updatedAt',
  'startDate',
  'endDate',
  'lastBackupDate',
  'extractedAt', // for googleInfo.extractedAt in Plan type
]

export async function exportAllData(): Promise<BackupData> {
  const [trips, plans, places, settings, routeSegments] = await Promise.all([
    db.trips.toArray(),
    db.plans.toArray(),
    db.places.toArray(),
    getSettings(),
    db.routeSegments.toArray(),
  ])

  return {
    version: APP_VERSION,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    trips: serializeDates(trips),
    plans: serializeDates(plans),
    places: serializeDates(places),
    settings: serializeDates(settings),
    routeSegments: serializeDates(routeSegments),
  }
}

export async function importAllData(data: BackupData): Promise<void> {
  // Trip: startDate/endDate는 문자열(YYYY-MM-DD)로 유지
  const TRIP_DATE_FIELDS = ['createdAt', 'updatedAt']
  const PLAN_DATE_FIELDS = ['createdAt', 'updatedAt', 'extractedAt']
  const TIMESTAMP_FIELDS = ['createdAt', 'updatedAt', 'lastBackupDate']

  // Trip 날짜 처리: startDate/endDate를 문자열로 정규화
  const trips = data.trips.map(trip => ({
    ...deserializeDates(trip, TRIP_DATE_FIELDS),
    startDate: normalizeToDateString(trip.startDate),
    endDate: normalizeToDateString(trip.endDate),
  }))
  const plans = deserializeDates(data.plans, PLAN_DATE_FIELDS)
  const places = deserializeDates(data.places, TIMESTAMP_FIELDS)
  const settings = deserializeDates(data.settings, TIMESTAMP_FIELDS)

  const ROUTE_DATE_FIELDS = ['cachedAt', 'updatedAt']
  const routeSegments = data.routeSegments
    ? deserializeDates(data.routeSegments, ROUTE_DATE_FIELDS)
    : []

  await db.transaction('rw', [db.trips, db.plans, db.places, db.settings, db.routeSegments], async () => {
    // Clear existing data
    await db.trips.clear()
    await db.plans.clear()
    await db.places.clear()
    await db.routeSegments.clear()

    // Import new data
    if (trips.length > 0) await db.trips.bulkAdd(trips)
    if (plans.length > 0) await db.plans.bulkAdd(plans)
    if (places.length > 0) await db.places.bulkAdd(places)
    if (routeSegments.length > 0) await db.routeSegments.bulkAdd(routeSegments)
    if (settings) await db.settings.put(settings)
  })

  sendBroadcast('DATA_IMPORTED')
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.trips, db.plans, db.places, db.routeSegments], async () => {
    await db.trips.clear()
    await db.plans.clear()
    await db.places.clear()
    await db.routeSegments.clear()
  })

  sendBroadcast('DATA_CLEARED')
}

// ============================================
// Backup Validation
// ============================================

export interface BackupValidationResult {
  valid: boolean
  error?: string
  needsMigration: boolean
  schemaVersion?: number
  appVersion?: string
}

export function validateBackupData(data: unknown): BackupValidationResult {
  // Basic type check
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: '유효하지 않은 백업 파일입니다',
      needsMigration: false,
    }
  }

  const backup = data as Partial<BackupData>

  // Required fields check
  if (!backup.version || !backup.trips) {
    return {
      valid: false,
      error: '필수 데이터가 누락되었습니다 (version, trips)',
      needsMigration: false,
    }
  }

  // Validate trips is an array
  if (!Array.isArray(backup.trips)) {
    return {
      valid: false,
      error: 'trips 데이터가 올바르지 않습니다',
      needsMigration: false,
    }
  }

  // Schema version check
  const backupSchema = backup.schemaVersion || 0

  if (backupSchema > SCHEMA_VERSION) {
    return {
      valid: false,
      error: `이 백업은 더 최신 버전의 앱에서 생성되었습니다 (v${backup.appVersion || 'unknown'}). 앱을 업데이트해주세요.`,
      needsMigration: false,
      schemaVersion: backupSchema,
      appVersion: backup.appVersion,
    }
  }

  if (backupSchema < SCHEMA_VERSION) {
    return {
      valid: true,
      needsMigration: true,
      schemaVersion: backupSchema,
      appVersion: backup.appVersion,
    }
  }

  return {
    valid: true,
    needsMigration: false,
    schemaVersion: backupSchema,
    appVersion: backup.appVersion,
  }
}

// ============================================
// Single Trip Backup & Restore
// ============================================

export interface SingleTripBackup {
  version: string
  appVersion: string
  schemaVersion: number
  exportedAt: string
  trip: Omit<Trip, 'id'> & { id?: number }
  plans: (Omit<Plan, 'id' | 'tripId'> & { id?: number; tripId?: number })[]
}

export interface SingleTripBackupValidationResult {
  valid: boolean
  error?: string
  needsMigration: boolean
  schemaVersion?: number
  appVersion?: string
}

// Export a single trip with its plans
export async function exportSingleTrip(tripId: number): Promise<SingleTripBackup> {
  const trip = await db.trips.get(tripId)
  if (!trip) {
    throw new Error('여행을 찾을 수 없습니다')
  }

  const plans = await db.plans.where('tripId').equals(tripId).toArray()

  // Remove ids for portability
  const tripWithoutId = { ...trip }
  const { id: _tripId, ...tripData } = tripWithoutId

  const plansWithoutIds = plans.map((plan) => {
    const { id: _planId, tripId: _planTripId, ...planData } = plan
    return planData
  })

  return {
    version: APP_VERSION,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    trip: serializeDates(tripData),
    plans: serializeDates(plansWithoutIds),
  }
}

// 날짜 값을 YYYY-MM-DD 형식 문자열로 정규화
function normalizeToDateString(value: unknown): string {
  if (typeof value === 'string') {
    // 이미 YYYY-MM-DD 형식이면 그대로 반환
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value
    }
    // ISO 형식(YYYY-MM-DDTHH:mm:ss)이면 날짜 부분만 추출
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return value.split('T')[0]
    }
    // 다른 형식이면 Date로 파싱 후 변환
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }
  // 기본값 (오늘 날짜)
  return new Date().toISOString().split('T')[0]
}

// Import a single trip with its plans
export async function importSingleTrip(data: SingleTripBackup): Promise<number> {
  // Trip과 Plan에 대해 별도의 DATE_FIELDS 사용
  // startDate, endDate는 문자열(YYYY-MM-DD)로 유지해야 함
  const TRIP_DATE_FIELDS = ['createdAt', 'updatedAt']
  const PLAN_DATE_FIELDS = ['createdAt', 'updatedAt', 'extractedAt']

  // Deserialize dates (startDate, endDate는 문자열로 유지)
  const trip = deserializeDates(data.trip, TRIP_DATE_FIELDS)
  const plans = deserializeDates(data.plans || [], PLAN_DATE_FIELDS)

  const newTripId = await db.transaction('rw', [db.trips, db.plans], async () => {
    // startDate, endDate를 YYYY-MM-DD 형식으로 정규화
    // ISO 형식("2026-02-18T00:00:00.000Z")도 올바르게 처리
    const startDateStr = normalizeToDateString(data.trip.startDate)
    const endDateStr = normalizeToDateString(data.trip.endDate)

    // Create trip without id (auto-generate)
    const tripData: Omit<Trip, 'id'> = {
      title: trip.title,
      country: trip.country,
      timezone: trip.timezone,
      startDate: startDateStr,
      endDate: endDateStr,
      coverImage: trip.coverImage || '',
      plansCount: plans.length,
      isFavorite: trip.isFavorite || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const tripId = await db.trips.add(tripData as Trip)

    // Map plans to new tripId and add them
    if (plans.length > 0) {
      const mappedPlans = plans.map((plan, index) => ({
        ...plan,
        tripId: tripId,
        order: plan.order ?? index,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      await db.plans.bulkAdd(mappedPlans as Plan[])
    }

    return tripId
  })

  // Zustand 스토어 동기화를 위한 브로드캐스트
  sendBroadcast('TRIP_CREATED', { id: newTripId })

  return newTripId
}

// Validate single trip backup data
export function validateSingleTripBackup(data: unknown): SingleTripBackupValidationResult {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '유효하지 않은 파일입니다', needsMigration: false }
  }

  const backup = data as Partial<SingleTripBackup>

  // Required fields
  if (!backup.version || !backup.trip) {
    return { valid: false, error: '필수 데이터가 누락되었습니다 (version, trip)', needsMigration: false }
  }

  // Validate trip structure
  const trip = backup.trip
  if (!trip.title || !trip.country || !trip.startDate || !trip.endDate) {
    return { valid: false, error: '여행 정보가 올바르지 않습니다 (title, country, startDate, endDate 필요)', needsMigration: false }
  }

  // Validate plans is array
  if (backup.plans && !Array.isArray(backup.plans)) {
    return { valid: false, error: '일정 데이터가 올바르지 않습니다', needsMigration: false }
  }

  // Schema version check
  const backupSchema = backup.schemaVersion || 0
  if (backupSchema > SCHEMA_VERSION) {
    return {
      valid: false,
      error: `이 백업은 더 최신 버전의 앱에서 생성되었습니다. 앱을 업데이트해주세요.`,
      needsMigration: false,
      schemaVersion: backupSchema,
      appVersion: backup.appVersion,
    }
  }

  return {
    valid: true,
    needsMigration: backupSchema < SCHEMA_VERSION,
    schemaVersion: backupSchema,
    appVersion: backup.appVersion,
  }
}

// Get empty trip template
export function getSingleTripTemplate(): SingleTripBackup {
  const now = new Date().toISOString()
  return {
    version: APP_VERSION,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    trip: {
      title: '예시 여행 (제목을 변경하세요)',
      country: '대한민국',
      timezone: 'Asia/Seoul',
      startDate: '2025-01-01',
      endDate: '2025-01-03',
      coverImage: '',
      plansCount: 1,
      isFavorite: false,
      createdAt: now as unknown as Date,
      updatedAt: now as unknown as Date,
    },
    plans: [
      {
        day: 1,
        order: 0,
        placeName: '예시 장소 (삭제 후 사용하세요)',
        startTime: '09:00',
        endTime: '12:00',
        type: 'attraction',
        address: '서울시 종로구',
        memo: '메모를 입력하세요',
        createdAt: now as unknown as Date,
        updatedAt: now as unknown as Date,
      } as Omit<Plan, 'id' | 'tripId'>,
    ],
  }
}

// ============================================
// Single Plan Backup & Restore
// ============================================

export interface SinglePlanBackup {
  version: string
  appVersion: string
  schemaVersion: number
  exportedAt: string
  plan: Omit<Plan, 'id' | 'tripId'> & { id?: number; tripId?: number }
}

export interface SinglePlanBackupValidationResult {
  valid: boolean
  error?: string
  needsMigration: boolean
  schemaVersion?: number
  appVersion?: string
}

// Export a single plan
export async function exportSinglePlan(planId: number): Promise<SinglePlanBackup> {
  const plan = await db.plans.get(planId)
  if (!plan) {
    throw new Error('일정을 찾을 수 없습니다')
  }

  // Remove id and tripId for portability
  const { id: _planId, tripId: _tripId, ...planData } = plan

  return {
    version: APP_VERSION,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    plan: serializeDates(planData),
  }
}

// Import a single plan to a trip
export async function importSinglePlan(
  data: SinglePlanBackup,
  tripId: number,
  day?: number
): Promise<number> {
  // Deserialize dates
  const plan = deserializeDates(data.plan, DATE_FIELDS)

  // Create plan with assigned tripId
  const planData: Omit<Plan, 'id'> = {
    tripId,
    day: day ?? plan.day ?? 1,
    order: plan.order ?? 0,
    placeName: plan.placeName,
    startTime: plan.startTime,
    endTime: plan.endTime,
    type: plan.type || 'attraction',
    address: plan.address,
    website: plan.website,
    openingHours: plan.openingHours,
    memo: plan.memo,
    photos: plan.photos,
    youtubeLink: plan.youtubeLink,
    mapUrl: plan.mapUrl,
    latitude: plan.latitude,
    longitude: plan.longitude,
    googlePlaceId: plan.googlePlaceId,
    googleInfo: plan.googleInfo,
    audioScript: plan.audioScript,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const newPlanId = await db.plans.add(planData as Plan)

  // Update trip's plansCount
  const trip = await db.trips.get(tripId)
  if (trip) {
    const plansCount = await db.plans.where('tripId').equals(tripId).count()
    await db.trips.update(tripId, { plansCount, updatedAt: new Date() })
  }

  // Zustand 스토어 동기화를 위한 브로드캐스트
  sendBroadcast('PLAN_CREATED', { id: newPlanId, tripId })

  return newPlanId
}

// Validate single plan backup data
export function validateSinglePlanBackup(data: unknown): SinglePlanBackupValidationResult {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '유효하지 않은 파일입니다', needsMigration: false }
  }

  const backup = data as Partial<SinglePlanBackup>

  // Required fields
  if (!backup.version || !backup.plan) {
    return { valid: false, error: '필수 데이터가 누락되었습니다 (version, plan)', needsMigration: false }
  }

  // Validate plan structure
  const plan = backup.plan
  if (!plan.placeName || !plan.startTime) {
    return { valid: false, error: '일정 정보가 올바르지 않습니다 (placeName, startTime 필요)', needsMigration: false }
  }

  // Schema version check
  const backupSchema = backup.schemaVersion || 0
  if (backupSchema > SCHEMA_VERSION) {
    return {
      valid: false,
      error: `이 백업은 더 최신 버전의 앱에서 생성되었습니다. 앱을 업데이트해주세요.`,
      needsMigration: false,
      schemaVersion: backupSchema,
      appVersion: backup.appVersion,
    }
  }

  return {
    valid: true,
    needsMigration: backupSchema < SCHEMA_VERSION,
    schemaVersion: backupSchema,
    appVersion: backup.appVersion,
  }
}

// Get empty plan template
export function getSinglePlanTemplate(): SinglePlanBackup {
  const now = new Date().toISOString()
  return {
    version: APP_VERSION,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    plan: {
      day: 1,
      order: 0,
      placeName: '예시 장소 (이름을 변경하세요)',
      startTime: '09:00',
      endTime: '12:00',
      type: 'attraction',
      address: '주소를 입력하세요',
      website: '',
      memo: '메모를 입력하세요',
      photos: [],
      youtubeLink: '',
      mapUrl: '',
      audioScript: '',
      createdAt: now as unknown as Date,
      updatedAt: now as unknown as Date,
    } as Omit<Plan, 'id' | 'tripId'>,
  }
}

// ============================================
// Single Place Backup/Restore
// ============================================

export interface SinglePlaceBackup {
  version: string
  appVersion: string
  schemaVersion: number
  exportedAt: string
  place: Omit<Place, 'id' | 'isFavorite' | 'usageCount' | 'createdAt' | 'updatedAt'>
}

export interface SinglePlaceBackupValidationResult {
  valid: boolean
  error?: string
  needsMigration?: boolean
  schemaVersion?: number
  appVersion?: string
}

// Export single place to backup
export async function exportSinglePlace(placeId: number): Promise<SinglePlaceBackup> {
  const place = await db.places.get(placeId)
  if (!place) {
    throw new Error('장소를 찾을 수 없습니다')
  }

  // Remove runtime fields
  const { id, isFavorite, usageCount, createdAt, updatedAt, ...placeData } = place

  return {
    version: APP_VERSION,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    place: placeData,
  }
}

// Import single place from backup
export async function importSinglePlace(
  data: SinglePlaceBackup
): Promise<number> {
  const now = new Date()

  const newPlace: Omit<Place, 'id'> = {
    ...data.place,
    isFavorite: false,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  }

  const newPlaceId = await db.places.add(newPlace as Place)

  // Zustand 스토어 동기화를 위한 브로드캐스트
  sendBroadcast('PLACE_CREATED', { id: newPlaceId })

  return newPlaceId
}

// Validate single place backup
export function validateSinglePlaceBackup(data: unknown): SinglePlaceBackupValidationResult {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '유효하지 않은 백업 파일입니다.' }
  }

  const backup = data as Partial<SinglePlaceBackup>

  // Check required fields
  if (!backup.version || !backup.place) {
    return { valid: false, error: '필수 필드가 누락되었습니다.' }
  }

  // Check place data
  if (!backup.place.name || !backup.place.type) {
    return { valid: false, error: '장소 데이터가 올바르지 않습니다.' }
  }

  // Check schema version
  const backupSchema = backup.schemaVersion || 1
  if (backupSchema > SCHEMA_VERSION) {
    return {
      valid: false,
      error: `이 백업은 더 최신 버전의 앱에서 생성되었습니다. 앱을 업데이트해주세요.`,
      needsMigration: false,
      schemaVersion: backupSchema,
      appVersion: backup.appVersion,
    }
  }

  return {
    valid: true,
    needsMigration: backupSchema < SCHEMA_VERSION,
    schemaVersion: backupSchema,
    appVersion: backup.appVersion,
  }
}

// Get empty place template
export function getSinglePlaceTemplate(): SinglePlaceBackup {
  const now = new Date().toISOString()
  return {
    version: APP_VERSION,
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    place: {
      name: '예시 장소 (이름을 변경하세요)',
      type: 'attraction',
      address: '주소를 입력하세요',
      memo: '메모를 입력하세요',
      audioScript: '',
      photos: [],
      rating: undefined,
      mapUrl: '',
      website: '',
      googlePlaceId: undefined,
      latitude: undefined,
      longitude: undefined,
    },
  }
}
