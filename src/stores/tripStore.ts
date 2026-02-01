// ============================================
// Trip Store (Zustand)
// ============================================

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Trip, Plan } from '@/types'
import * as db from '@/services/database'
import { sendBroadcast } from '@/services/broadcast'

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

      // Load single trip with plans
      loadTrip: async (id: number) => {
        set({ isLoading: true, error: null })
        try {
          const [trip, plans] = await Promise.all([db.getTrip(id), db.getPlansForTrip(id)])
          set({
            currentTrip: trip || null,
            currentPlans: plans,
            isLoading: false,
          })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Add new trip
      addTrip: async (tripData) => {
        set({ isLoading: true, error: null })
        try {
          const trip: Omit<Trip, 'id'> = {
            ...tripData,
            isFavorite: false,
            plansCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          const id = await db.addTrip(trip)
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
          await db.deleteTrip(id)
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
          const trips = await db.getAllTrips()
          const currentTrip = get().currentTrip
          set({
            trips,
            currentTrip:
              currentTrip?.id === id
                ? { ...currentTrip, isFavorite: !currentTrip.isFavorite }
                : currentTrip,
          })
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
            await db.deletePlan(id)
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
