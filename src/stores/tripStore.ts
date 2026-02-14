// ============================================
// Trip Store (Zustand)
// ============================================

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Trip, Plan } from '@/types'
import * as db from '@/services/database'
import { sendBroadcast } from '@/services/broadcast'
import { getTimezoneFromCountry } from '@/utils/timezone'
import { syncManager } from '@/services/firestoreSync'
import { useUIStore } from '@/stores/uiStore'

const UNDO_TIMEOUT_MS = 30_000

interface TripState {
  // State
  trips: Trip[]
  currentTrip: Trip | null
  currentPlans: Plan[]
  isLoading: boolean
  error: string | null

  // Trip Actions
  initialize: () => Promise<void>
  loadTrips: () => Promise<void>
  loadTrip: (id: number) => Promise<void>
  addTrip: (trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt' | 'isFavorite' | 'plansCount'>) => Promise<number>
  updateTrip: (id: number, updates: Partial<Trip>) => Promise<void>
  deleteTrip: (id: number) => Promise<void>
  toggleFavorite: (id: number) => Promise<void>

  // Plan Actions
  loadPlans: (tripId: number) => Promise<void>
  addPlan: (plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>) => Promise<number>
  updatePlan: (id: number, updates: Partial<Plan>) => Promise<void>
  deletePlan: (id: number) => Promise<void>
  reorderPlans: (tripId: number, day: number, planIds: number[]) => Promise<void>

  // Duplicate
  duplicateTrip: (id: number) => Promise<number>

  // Batch
  deleteTrips: (ids: number[]) => Promise<void>

  // Utils
  clearCurrentTrip: () => void
  setError: (error: string | null) => void
}

export const useTripStore = create<TripState>()(
  devtools(
    (set, get) => ({
      // Initial State
      trips: [],
      currentTrip: null,
      currentPlans: [],
      isLoading: false,
      error: null,

      // Initialize - load all trips
      initialize: async () => {
        set({ isLoading: true, error: null })
        try {
          const trips = await db.getAllTrips()
          set({ trips, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Load all trips
      loadTrips: async () => {
        set({ isLoading: true, error: null })
        try {
          const trips = await db.getAllTrips()
          set({ trips, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Load single trip with plans (with lazy timezone migration)
      loadTrip: async (id: number) => {
        set({ isLoading: true, error: null })
        try {
          let [trip, plans] = await Promise.all([db.getTrip(id), db.getPlansForTrip(id)])

          // Lazy migration: add timezone if missing
          if (trip && !trip.timezone) {
            const timezone = getTimezoneFromCountry(trip.country)
            await db.updateTrip(id, { timezone })
            trip = { ...trip, timezone }
          }

          set({
            currentTrip: trip || null,
            currentPlans: plans,
            isLoading: false,
          })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Add new trip (with automatic timezone from country)
      addTrip: async (tripData) => {
        set({ isLoading: true, error: null })
        try {
          // Ensure timezone is set from country if not provided
          const timezone = tripData.timezone || getTimezoneFromCountry(tripData.country)
          const trip: Omit<Trip, 'id'> = {
            ...tripData,
            timezone,
            isFavorite: false,
            plansCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          const id = await db.addTrip(trip)

          // Sync to Firestore
          if (syncManager.isActive()) {
            const savedTrip = await db.getTrip(id)
            if (savedTrip) {
              const firebaseId = await syncManager.uploadTrip(savedTrip)
              await db.updateTrip(id, { firebaseId })
            }
          }

          const trips = await db.getAllTrips()
          set({ trips, isLoading: false })
          sendBroadcast('TRIP_CREATED', { id })
          return id
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      // Update trip
      updateTrip: async (id, updates) => {
        set({ isLoading: true, error: null })
        try {
          await db.updateTrip(id, updates)

          // Sync to Firestore
          if (syncManager.isActive()) {
            const updatedTrip = await db.getTrip(id)
            if (updatedTrip) {
              const firebaseId = await syncManager.uploadTrip(updatedTrip)
              if (!updatedTrip.firebaseId && firebaseId) {
                await db.updateTrip(id, { firebaseId })
              }
            }
          }

          const [trips, currentTrip] = await Promise.all([db.getAllTrips(), db.getTrip(id)])
          set({
            trips,
            currentTrip: get().currentTrip?.id === id ? currentTrip || null : get().currentTrip,
            isLoading: false,
          })
          sendBroadcast('TRIP_UPDATED', { id })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Delete trip (with undo support)
      deleteTrip: async (id) => {
        set({ isLoading: true, error: null })
        try {
          // Snapshot before delete
          const tripSnapshot = await db.getTrip(id)
          const plansSnapshot = await db.getPlansForTrip(id)
          const firebaseId = tripSnapshot?.firebaseId

          if (!tripSnapshot) {
            set({ isLoading: false })
            return
          }

          // Immediately delete from local DB
          await db.deleteTrip(id)

          const trips = await db.getAllTrips()
          set({
            trips,
            currentTrip: get().currentTrip?.id === id ? null : get().currentTrip,
            currentPlans: get().currentTrip?.id === id ? [] : get().currentPlans,
            isLoading: false,
          })
          sendBroadcast('TRIP_DELETED', { id })

          // Deferred Firestore deletion with undo
          let undone = false
          const timer = setTimeout(async () => {
            if (undone) return
            if (syncManager.isActive() && firebaseId) {
              syncManager.deleteRemoteTrip(firebaseId).catch((e) =>
                console.error('[Sync] Failed to delete remote trip:', e))
            }
          }, UNDO_TIMEOUT_MS)

          useUIStore.getState().showToast({
            type: 'warning',
            title: `"${tripSnapshot.title}" 삭제됨`,
            message: '30초 이내에 되돌릴 수 있습니다',
            duration: UNDO_TIMEOUT_MS,
            action: {
              label: '되돌리기',
              onClick: async () => {
                undone = true
                clearTimeout(timer)
                // Restore trip
                const restoredId = await db.addTrip(tripSnapshot)
                // Restore plans
                for (const plan of plansSnapshot) {
                  await db.addPlan({ ...plan, tripId: restoredId, id: undefined } as Omit<Plan, 'id'>)
                }
                const restoredTrips = await db.getAllTrips()
                set({ trips: restoredTrips })
                sendBroadcast('TRIP_CREATED', { id: restoredId })
                useUIStore.getState().showToast({
                  type: 'success',
                  title: '여행이 복원되었습니다',
                })
              },
            },
          })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Toggle favorite
      toggleFavorite: async (id) => {
        try {
          await db.toggleTripFavorite(id)

          // Sync to Firestore
          if (syncManager.isActive()) {
            const updatedTrip = await db.getTrip(id)
            if (updatedTrip) syncManager.uploadTrip(updatedTrip).catch(console.error)
          }

          const trips = await db.getAllTrips()
          const currentTrip = get().currentTrip
          set({
            trips,
            currentTrip:
              currentTrip?.id === id
                ? { ...currentTrip, isFavorite: !currentTrip.isFavorite }
                : currentTrip,
          })
          sendBroadcast('TRIP_UPDATED', { id })
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      // Load plans for trip
      loadPlans: async (tripId) => {
        try {
          const plans = await db.getPlansForTrip(tripId)
          set({ currentPlans: plans })
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      // Add plan
      addPlan: async (planData) => {
        set({ isLoading: true, error: null })
        try {
          const plan: Omit<Plan, 'id'> = {
            ...planData,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          const id = await db.addPlan(plan)

          // Sync to Firestore
          if (syncManager.isActive()) {
            const savedPlan = await db.getPlan(id)
            if (savedPlan) {
              const firebaseId = await syncManager.uploadPlan(savedPlan)
              await db.updatePlan(id, { firebaseId })
            }
          }

          const [plans, trips] = await Promise.all([
            db.getPlansForTrip(planData.tripId),
            db.getAllTrips(),
          ])
          set({ currentPlans: plans, trips, isLoading: false })
          sendBroadcast('PLAN_CREATED', { id, tripId: planData.tripId })
          return id
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      // Update plan
      updatePlan: async (id, updates) => {
        set({ isLoading: true, error: null })
        try {
          await db.updatePlan(id, updates)
          const plan = await db.getPlan(id)
          if (plan) {
            // Sync to Firestore
            if (syncManager.isActive()) {
              const firebaseId = await syncManager.uploadPlan(plan)
              if (!plan.firebaseId && firebaseId) {
                await db.updatePlan(id, { firebaseId })
              }
            }

            const plans = await db.getPlansForTrip(plan.tripId)
            set({ currentPlans: plans, isLoading: false })
            sendBroadcast('PLAN_UPDATED', { id, tripId: plan.tripId })
          } else {
            set({ isLoading: false })
          }
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Delete plan (with undo support)
      deletePlan: async (id) => {
        set({ isLoading: true, error: null })
        try {
          const planSnapshot = await db.getPlan(id)
          if (!planSnapshot) {
            set({ isLoading: false })
            return
          }

          const tripId = planSnapshot.tripId
          const firebaseId = planSnapshot.firebaseId

          // Collect route segments referencing this plan for remote cleanup
          const tripSegments = await db.getRouteSegmentsForTrip(tripId)
          const affectedSegments = tripSegments.filter(
            (s) => s.fromPlanId === id || s.toPlanId === id,
          )

          // Immediately delete from local DB
          await db.deletePlan(id)
          await db.deleteRouteSegmentsForPlan(id)

          const [plans, trips] = await Promise.all([
            db.getPlansForTrip(tripId),
            db.getAllTrips(),
          ])
          set({ currentPlans: plans, trips, isLoading: false })
          sendBroadcast('PLAN_DELETED', { id, tripId })

          // Deferred Firestore deletion with undo
          let undone = false
          const timer = setTimeout(async () => {
            if (undone) return
            if (syncManager.isActive()) {
              if (firebaseId) {
                syncManager.deleteRemotePlan(firebaseId).catch((e) =>
                  console.error('[Sync] Failed to delete remote plan:', e))
              }
              for (const seg of affectedSegments) {
                if (seg.firebaseId) {
                  syncManager.deleteRemoteRouteSegment(seg.firebaseId).catch((e) =>
                    console.error('[Sync] Failed to delete remote route segment:', e))
                }
              }
            }
          }, UNDO_TIMEOUT_MS)

          useUIStore.getState().showToast({
            type: 'warning',
            title: `"${planSnapshot.placeName}" 삭제됨`,
            message: '30초 이내에 되돌릴 수 있습니다',
            duration: UNDO_TIMEOUT_MS,
            action: {
              label: '되돌리기',
              onClick: async () => {
                undone = true
                clearTimeout(timer)
                await db.addPlan({ ...planSnapshot, id: undefined } as Omit<Plan, 'id'>)
                const restoredPlans = await db.getPlansForTrip(tripId)
                const restoredTrips = await db.getAllTrips()
                set({ currentPlans: restoredPlans, trips: restoredTrips })
                sendBroadcast('PLAN_CREATED', { tripId })
                useUIStore.getState().showToast({
                  type: 'success',
                  title: '일정이 복원되었습니다',
                })
              },
            },
          })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Reorder plans (드래그앤드롭)
      reorderPlans: async (tripId, day, planIds) => {
        try {
          // Update order for each plan
          await Promise.all(
            planIds.map((id, index) => db.updatePlan(id, { order: index }))
          )

          // Sync reordered plans to Firestore
          if (syncManager.isActive()) {
            for (const planId of planIds) {
              const plan = await db.getPlan(planId)
              if (plan) syncManager.uploadPlan(plan).catch(console.error)
            }
          }

          // Reload plans
          const plans = await db.getPlansForTrip(tripId)
          set({ currentPlans: plans })
          sendBroadcast('PLANS_REORDERED', { tripId, day })
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      // Duplicate trip with all plans
      duplicateTrip: async (id) => {
        set({ isLoading: true, error: null })
        try {
          const sourceTrip = await db.getTrip(id)
          if (!sourceTrip) {
            set({ isLoading: false })
            throw new Error('Trip not found')
          }

          const sourcePlans = await db.getPlansForTrip(id)

          // Create duplicated trip (reset id, firebaseId)
          const newTripData: Omit<Trip, 'id'> = {
            title: `${sourceTrip.title} (복사)`,
            country: sourceTrip.country,
            timezone: sourceTrip.timezone,
            startDate: sourceTrip.startDate,
            endDate: sourceTrip.endDate,
            coverImage: sourceTrip.coverImage,
            plansCount: sourceTrip.plansCount,
            isFavorite: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          const newTripId = await db.addTrip(newTripData)

          // Sync new trip to Firestore
          if (syncManager.isActive()) {
            const savedTrip = await db.getTrip(newTripId)
            if (savedTrip) {
              const firebaseId = await syncManager.uploadTrip(savedTrip)
              await db.updateTrip(newTripId, { firebaseId })
            }
          }

          // Duplicate all plans (reset id, firebaseId, update tripId)
          for (const plan of sourcePlans) {
            const newPlanData: Omit<Plan, 'id'> = {
              tripId: newTripId,
              day: plan.day,
              order: plan.order,
              placeName: plan.placeName,
              startTime: plan.startTime,
              endTime: plan.endTime,
              type: plan.type,
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
            const newPlanId = await db.addPlan(newPlanData)

            // Sync new plan to Firestore
            if (syncManager.isActive()) {
              const savedPlan = await db.getPlan(newPlanId)
              if (savedPlan) {
                const firebaseId = await syncManager.uploadPlan(savedPlan)
                await db.updatePlan(newPlanId, { firebaseId })
              }
            }
          }

          const trips = await db.getAllTrips()
          set({ trips, isLoading: false })
          sendBroadcast('TRIP_CREATED', { id: newTripId })
          return newTripId
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
        }
      },

      // Batch delete trips
      deleteTrips: async (ids) => {
        set({ isLoading: true, error: null })
        try {
          for (const id of ids) {
            const tripSnapshot = await db.getTrip(id)
            if (!tripSnapshot) continue
            const firebaseId = tripSnapshot.firebaseId
            const planSnapshots = await db.getPlansForTrip(id)

            // Delete plans
            for (const plan of planSnapshots) {
              if (plan.id) await db.deletePlan(plan.id)
            }
            await db.deleteTrip(id)

            // Sync to Firestore
            if (syncManager.isActive() && firebaseId) {
              syncManager.deleteRemoteTrip(firebaseId).catch(console.error)
            }
          }

          const trips = await db.getAllTrips()
          set({ trips, isLoading: false })
          sendBroadcast('TRIP_DELETED', { ids })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Clear current trip
      clearCurrentTrip: () => {
        set({ currentTrip: null, currentPlans: [] })
      },

      // Set error
      setError: (error) => {
        set({ error })
      },
    }),
    { name: 'trip-store' }
  )
)

// Selector hooks
export const useTrips = () => useTripStore((state) => state.trips)
export const useCurrentTrip = () => useTripStore((state) => state.currentTrip)
export const useCurrentPlans = () => useTripStore((state) => state.currentPlans)
export const useTripLoading = () => useTripStore((state) => state.isLoading)
