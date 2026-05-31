// ============================================
// Trip Sharing Service
// Public read-only link via Firestore sharedTrips collection
// ============================================

import { doc, setDoc, getDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { getFirebaseDb } from '@/services/firebase'
import * as db from '@/services/database'
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
export function generateShareId(length = 12): string {
  // 각 문자를 36-심볼 알파벳에서 균일하게 추출 (rejection sampling으로 modulo 편향 제거).
  // 기존 byte.toString(36) 방식은 36~255 바이트가 2글자로 펼쳐져 앞 문자가 1~7로 편향되어
  // 실효 키스페이스가 36^12보다 훨씬 작았다.
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz' // 36 chars
  const max = 256 - (256 % alphabet.length) // 252: 균일성을 위해 252~255는 버림
  const id: string[] = []
  const buf = new Uint8Array(length * 2)
  while (id.length < length) {
    crypto.getRandomValues(buf)
    for (let i = 0; i < buf.length && id.length < length; i++) {
      if (buf[i] < max) {
        id.push(alphabet[buf[i] % alphabet.length])
      }
    }
  }
  return id.join('')
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

  // Build the shared trip document (Firestore rejects undefined values)
  const sharedData: SharedTripData = {
    trip: {
      title: trip.title,
      country: trip.country,
      ...(trip.timezone != null && { timezone: trip.timezone }),
      startDate: trip.startDate,
      endDate: trip.endDate,
      plansCount: plans.length,
    },
    plans: plans.map((plan) => ({
      day: plan.day,
      placeName: plan.placeName,
      startTime: plan.startTime,
      ...(plan.endTime ? { endTime: plan.endTime } : {}),
      type: plan.type,
      ...(plan.address ? { address: plan.address } : {}),
      ...(plan.memo ? { memo: plan.memo } : {}),
      ...(plan.latitude != null && { latitude: plan.latitude }),
      ...(plan.longitude != null && { longitude: plan.longitude }),
      ...(plan.order != null && { order: plan.order }),
    })),
    sharedAt: Timestamp.now(),
    sharedBy: uid,
  }

  // Write to Firestore sharedTrips collection
  const firestore = getFirebaseDb()
  const sharedDocRef = doc(firestore, 'sharedTrips', shareId)
  try {
    await setDoc(sharedDocRef, sharedData)
  } catch (error) {
    console.error('[Sharing] Failed to write shared trip:', error)
    throw new Error('공유 문서를 생성할 수 없습니다. 다시 시도해주세요.')
  }

  // Update local trip with the shareId (only after Firestore succeeds)
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
  try {
    await deleteDoc(sharedDocRef)
  } catch (error) {
    console.error('[Sharing] Failed to delete shared trip:', error)
    throw new Error('공유 해제에 실패했습니다. 다시 시도해주세요.')
  }

  // Remove shareId from local trip (only after Firestore succeeds)
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
