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

      // Delete trip
      deleteTrip: async (id) => {
        set({ isLoading: true, error: null })
        try {
          // Save firebaseId before deleting
          const tripToDelete = await db.getTrip(id)
          const firebaseId = tripToDelete?.firebaseId

          await db.deleteTrip(id)

          // Sync deletion to Firestore
          if (syncManager.isActive() && firebaseId) {
            syncManager.deleteRemoteTrip(firebaseId).catch((e) =>
              console.error('[Sync] Failed to delete remote trip:', e))
          }

          const trips = await db.getAllTrips()
          set({
            trips,
            currentTrip: get().currentTrip?.id === id ? null : get().currentTrip,
            currentPlans: get().currentTrip?.id === id ? [] : get().currentPlans,
            isLoading: false,
          })
          sendBroadcast('TRIP_DELETED', { id })
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

      // Delete plan
      deletePlan: async (id) => {
        set({ isLoading: true, error: null })
        try {
          const plan = await db.getPlan(id)
          if (plan) {
            const tripId = plan.tripId
            const firebaseId = plan.firebaseId

            await db.deletePlan(id)

            // Sync deletion to Firestore
            if (syncManager.isActive() && firebaseId) {
              syncManager.deleteRemotePlan(firebaseId).catch((e) =>
                console.error('[Sync] Failed to delete remote plan:', e))
            }

            const [plans, trips] = await Promise.all([
              db.getPlansForTrip(tripId),
              db.getAllTrips(),
            ])
            set({ currentPlans: plans, trips, isLoading: false })
            sendBroadcast('PLAN_DELETED', { id, tripId })
          } else {
            set({ isLoading: false })
          }
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
