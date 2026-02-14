// ============================================
// Trip Sharing Service
// Public read-only link via Firestore sharedTrips collection
// ============================================

import { doc, setDoc, getDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { getFirebaseDb } from '@/services/firebase'
import * as db from '@/services/database'
import type { Trip, Plan } from '@/types'
import { useAuthStore } from '@/stores/authStore'

// ============================================
// Shared Trip Document Structure
// ============================================

export interface SharedTripData {
  trip: {
    title: string
    country: string
    timezone?: string
    startDate: string
    endDate: string
    plansCount: number
  }
  plans: Array<{
    day: number
    placeName: string
    startTime: string
    endTime?: string
    type: string
    address?: string
    memo?: string
    latitude?: number
    longitude?: number
    order?: number
  }>
  sharedAt: Timestamp
  sharedBy: string
}

// ============================================
// Share ID Generation
// ============================================

/**
 * Generate a random 12-character alphanumeric share ID.
 * Uses crypto.getRandomValues for cryptographic randomness.
 */
export function generateShareId(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  // Convert to base36 (0-9, a-z) and take the first 12 characters
  let id = ''
  for (let i = 0; i < array.length; i++) {
    id += array[i].toString(36)
  }
  return id.slice(0, 12)
}

// ============================================
// Share / Unshare Operations
// ============================================

/**
 * Share a trip publicly. Creates a sharedTrips/{shareId} document in Firestore.
 * If the trip already has a shareId, returns the existing one.
 *
 * @param tripId - Local Dexie trip ID
 * @returns The shareId for the public link
 */
export async function shareTrip(tripId: number): Promise<string> {
  const trip = await db.getTrip(tripId)
  if (!trip) {
    throw new Error('여행을 찾을 수 없습니다')
  }

  // If already shared, return existing shareId
  if (trip.shareId) {
    return trip.shareId
  }

  // Generate a new share ID
  const shareId = generateShareId()

  // Get all plans for this trip
  const plans = await db.getPlansForTrip(tripId)

  // Get current user uid
  const uid = useAuthStore.getState().user?.uid || 'anonymous'

  // Build the shared trip document
  const sharedData: SharedTripData = {
    trip: {
      title: trip.title,
      country: trip.country,
      timezone: trip.timezone,
      startDate: trip.startDate,
      endDate: trip.endDate,
      plansCount: plans.length,
    },
    plans: plans.map((plan) => ({
      day: plan.day,
      placeName: plan.placeName,
      startTime: plan.startTime,
      endTime: plan.endTime || undefined,
      type: plan.type,
      address: plan.address || undefined,
      memo: plan.memo || undefined,
      latitude: plan.latitude,
      longitude: plan.longitude,
      order: plan.order,
    })),
    sharedAt: Timestamp.now(),
    sharedBy: uid,
  }

  // Write to Firestore sharedTrips collection
  const firestore = getFirebaseDb()
  const sharedDocRef = doc(firestore, 'sharedTrips', shareId)
  await setDoc(sharedDocRef, sharedData)

  // Update local trip with the shareId
  await db.updateTrip(tripId, { shareId })

  return shareId
}

/**
 * Unshare a trip. Removes the shareId from the local trip and deletes
 * the corresponding sharedTrips document from Firestore.
 *
 * @param tripId - Local Dexie trip ID
 */
export async function unshareTrip(tripId: number): Promise<void> {
  const trip = await db.getTrip(tripId)
  if (!trip) {
    throw new Error('여행을 찾을 수 없습니다')
  }

  if (!trip.shareId) {
    return // Nothing to unshare
  }

  const shareId = trip.shareId

  // Delete the shared document from Firestore
  const firestore = getFirebaseDb()
  const sharedDocRef = doc(firestore, 'sharedTrips', shareId)
  await deleteDoc(sharedDocRef)

  // Remove shareId from local trip
  await db.updateTrip(tripId, { shareId: undefined })
}

// ============================================
// Public Read (for SharedTrip viewer)
// ============================================

/**
 * Read shared trip data from Firestore by shareId.
 * This is used by the public shared trip viewer page.
 *
 * @param shareId - The public share ID
 * @returns The shared trip data, or null if not found
 */
export async function getSharedTrip(shareId: string): Promise<SharedTripData | null> {
  const firestore = getFirebaseDb()
  const sharedDocRef = doc(firestore, 'sharedTrips', shareId)
  const docSnap = await getDoc(sharedDocRef)

  if (!docSnap.exists()) {
    return null
  }

  return docSnap.data() as SharedTripData
}
