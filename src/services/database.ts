// ============================================
// Dexie Database Service
// ============================================

import Dexie, { type Table } from 'dexie'
import type { Trip, Plan, Place, Settings } from '@/types'
import { DEFAULT_SETTINGS } from '@/types'

class TravelDatabase extends Dexie {
  trips!: Table<Trip, number>
  plans!: Table<Plan, number>
  places!: Table<Place, number>
  settings!: Table<Settings, string>

  constructor() {
    super('MoonwaveTravel')

    this.version(1).stores({
      trips: '++id, title, country, startDate, isFavorite, updatedAt',
      plans: '++id, tripId, day, type, [tripId+day]',
      places: '++id, name, type, isFavorite, usageCount',
      settings: 'id',
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
  await db.transaction('rw', [db.trips, db.plans], async () => {
    await db.plans.where('tripId').equals(id).delete()
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

const DATE_FIELDS = ['createdAt', 'updatedAt', 'startDate', 'endDate', 'lastBackupDate']

export async function exportAllData(): Promise<BackupData> {
  const [trips, plans, places, settings] = await Promise.all([
    db.trips.toArray(),
    db.plans.toArray(),
    db.places.toArray(),
    getSettings(),
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
  }
}

export async function importAllData(data: BackupData): Promise<void> {
  // Deserialize dates
  const trips = deserializeDates(data.trips, DATE_FIELDS)
  const plans = deserializeDates(data.plans, DATE_FIELDS)
  const places = deserializeDates(data.places, DATE_FIELDS)
  const settings = deserializeDates(data.settings, DATE_FIELDS)

  await db.transaction('rw', [db.trips, db.plans, db.places, db.settings], async () => {
    // Clear existing data
    await db.trips.clear()
    await db.plans.clear()
    await db.places.clear()

    // Import new data
    if (trips.length > 0) await db.trips.bulkAdd(trips)
    if (plans.length > 0) await db.plans.bulkAdd(plans)
    if (places.length > 0) await db.places.bulkAdd(places)
    if (settings) await db.settings.put(settings)
  })

  sendBroadcast('DATA_IMPORTED')
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.trips, db.plans, db.places], async () => {
    await db.trips.clear()
    await db.plans.clear()
    await db.places.clear()
  })

  sendBroadcast('DATA_CLEARED')
}
