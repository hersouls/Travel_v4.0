// ============================================
// Trip Store (Zustand)
// ============================================

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Trip, Plan, RouteSegment, TravelLog, Expense } from '@/types'
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
    (set, _get) => ({
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
              // Upload cover image in background if present
              if (savedTrip.coverImage && firebaseId) {
                const updatedTrip = await db.getTrip(id)
                if (updatedTrip) {
                  import('@/services/imageSync').then(({ uploadTripCoverImage }) => {
                    import('@/stores/authStore').then(({ useAuthStore }) => {
                      const userId = useAuthStore.getState().user?.uid
                      if (userId) uploadTripCoverImage(userId, updatedTrip)
                    })
                  }).catch(console.error)
                }
              }
            }
          }

          // Partial update: prepend new trip to list instead of full reload
          const newTrip = await db.getTrip(id)
          if (newTrip) {
            set(state => ({ trips: [newTrip, ...state.trips], isLoading: false }))
          } else {
            set({ isLoading: false })
          }
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
          // coverImage 변경 시 재업로드 트리거를 위해 storage path를 비운다.
          // 호출자의 updates 객체를 변형하지 않도록 복제본에 적용한다.
          const updatesToApply = 'coverImage' in updates ? { ...updates, coverImagePath: undefined } : updates
          await db.updateTrip(id, updatesToApply)

          // Sync to Firestore
          if (syncManager.isActive()) {
            const updatedTrip = await db.getTrip(id)
            if (updatedTrip) {
              const firebaseId = await syncManager.uploadTrip(updatedTrip)
              if (!updatedTrip.firebaseId && firebaseId) {
                await db.updateTrip(id, { firebaseId })
              }
              // Upload cover image in background if changed
              if ('coverImage' in updates && updatedTrip.coverImage && updatedTrip.firebaseId) {
                import('@/services/imageSync').then(({ uploadTripCoverImage }) => {
                  import('@/stores/authStore').then(({ useAuthStore }) => {
                    const userId = useAuthStore.getState().user?.uid
                    if (userId) uploadTripCoverImage(userId, updatedTrip)
                  })
                }).catch(console.error)
              }
              // If coverImage was cleared, delete from Storage
              if ('coverImage' in updates && !updates.coverImage && updatedTrip.firebaseId) {
                import('@/services/imageSync').then(({ deleteEntityImages }) => {
                  import('@/stores/authStore').then(({ useAuthStore }) => {
                    const userId = useAuthStore.getState().user?.uid
                    if (userId && updatedTrip.firebaseId) {
                      deleteEntityImages(userId, 'trips', updatedTrip.firebaseId)
                    }
                  })
                }).catch(console.error)
              }
            }
          }

          // Partial update: replace single trip in list instead of full reload
          const updatedTrip = await db.getTrip(id)
          set(state => ({
            trips: updatedTrip
              ? state.trips.map(t => t.id === id ? updatedTrip : t)
              : state.trips.filter(t => t.id !== id),
            currentTrip: state.currentTrip?.id === id ? updatedTrip || null : state.currentTrip,
            isLoading: false,
          }))
          sendBroadcast('TRIP_UPDATED', { id })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Delete trip (with undo support)
      deleteTrip: async (id) => {
        set({ isLoading: true, error: null })
        try {
          // Snapshot before delete — include ALL dependent collections so undo can
          // fully restore them (db.deleteTrip cascades and would otherwise lose them).
          const tripSnapshot = await db.getTrip(id)
          const plansSnapshot = await db.getPlansForTrip(id)
          const segmentsSnapshot = await db.getRouteSegmentsForTrip(id)
          const logsSnapshot = await db.getTravelLogsForTrip(id)
          const expensesSnapshot = await db.getExpensesForTrip(id)
          const firebaseId = tripSnapshot?.firebaseId

          if (!tripSnapshot) {
            set({ isLoading: false })
            return
          }

          // Mark as pending delete to prevent listener re-creation during undo window
          if (firebaseId) syncManager.addPendingDelete(firebaseId)
          for (const plan of plansSnapshot) {
            if (plan.firebaseId) syncManager.addPendingDelete(plan.firebaseId)
          }
          // 자식(segment/log/expense)도 등록 — 미등록 시 undo 창 동안 리스너가 고아로 재생성함
          for (const seg of segmentsSnapshot) {
            if (seg.firebaseId) syncManager.addPendingDelete(seg.firebaseId)
          }
          for (const log of logsSnapshot) {
            if (log.firebaseId) syncManager.addPendingDelete(log.firebaseId)
          }
          for (const exp of expensesSnapshot) {
            if (exp.firebaseId) syncManager.addPendingDelete(exp.firebaseId)
          }

          // Immediately delete from local DB
          await db.deleteTrip(id)

          // Partial update: remove from list instead of full reload
          set(state => ({
            trips: state.trips.filter(t => t.id !== id),
            currentTrip: state.currentTrip?.id === id ? null : state.currentTrip,
            currentPlans: state.currentTrip?.id === id ? [] : state.currentPlans,
            isLoading: false,
          }))
          sendBroadcast('TRIP_DELETED', { id })

          // Deferred Firestore deletion with undo
          const undoController = new AbortController()
          const timer = setTimeout(async () => {
            if (undoController.signal.aborted) return
            if (syncManager.isActive() && firebaseId) {
              try {
                await syncManager.deleteRemoteTrip(firebaseId, undoController.signal)
              } catch (e) {
                if (undoController.signal.aborted) return
                console.error('[Sync] Failed to delete remote trip:', e)
              }
            }
            // Clean up pending deletes
            if (firebaseId) syncManager.removePendingDelete(firebaseId)
            for (const plan of plansSnapshot) {
              if (plan.firebaseId) syncManager.removePendingDelete(plan.firebaseId)
            }
            for (const seg of segmentsSnapshot) {
              if (seg.firebaseId) syncManager.removePendingDelete(seg.firebaseId)
            }
            for (const log of logsSnapshot) {
              if (log.firebaseId) syncManager.removePendingDelete(log.firebaseId)
            }
            for (const exp of expensesSnapshot) {
              if (exp.firebaseId) syncManager.removePendingDelete(exp.firebaseId)
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
                undoController.abort()
                clearTimeout(timer)
                // Remove pending deletes on undo
                if (firebaseId) syncManager.removePendingDelete(firebaseId)
                for (const plan of plansSnapshot) {
                  if (plan.firebaseId) syncManager.removePendingDelete(plan.firebaseId)
                }
                for (const seg of segmentsSnapshot) {
                  if (seg.firebaseId) syncManager.removePendingDelete(seg.firebaseId)
                }
                for (const log of logsSnapshot) {
                  if (log.firebaseId) syncManager.removePendingDelete(log.firebaseId)
                }
                for (const exp of expensesSnapshot) {
                  if (exp.firebaseId) syncManager.removePendingDelete(exp.firebaseId)
                }
                // Restore trip with a fresh id — 원래 id가 undo 창 동안 재사용됐으면 ConstraintError가 나므로
                const restoredId = await db.addTrip({ ...tripSnapshot, id: undefined } as Omit<Trip, 'id'>)
                // Restore plans, tracking old→new plan id remap for dependent records
                const planIdMap = new Map<number, number>()
                for (const plan of plansSnapshot) {
                  const newPlanId = await db.addPlan({ ...plan, tripId: restoredId, id: undefined } as Omit<Plan, 'id'>)
                  if (plan.id != null) planIdMap.set(plan.id, newPlanId)
                }
                // Restore route segments (re-point tripId + remapped plan FKs)
                for (const seg of segmentsSnapshot) {
                  const fromPlanId = planIdMap.get(seg.fromPlanId) ?? seg.fromPlanId
                  const toPlanId = planIdMap.get(seg.toPlanId) ?? seg.toPlanId
                  await db.upsertRouteSegment({ ...seg, tripId: restoredId, fromPlanId, toPlanId, id: undefined } as Omit<RouteSegment, 'id'>)
                }
                // Restore travel logs (re-point tripId), tracking old→new log id remap for expenses
                const logIdMap = new Map<number, number>()
                for (const log of logsSnapshot) {
                  const newLogId = await db.addTravelLog({ ...log, tripId: restoredId, id: undefined } as Omit<TravelLog, 'id'>)
                  if (log.id != null) logIdMap.set(log.id, newLogId)
                }
                // Restore expenses (re-point tripId + remapped sourceLogId FK)
                for (const exp of expensesSnapshot) {
                  const sourceLogId =
                    exp.sourceLogId != null ? (logIdMap.get(exp.sourceLogId) ?? exp.sourceLogId) : undefined
                  await db.addExpense({ ...exp, tripId: restoredId, sourceLogId, id: undefined } as Omit<Expense, 'id'>)
                }
                // Partial update: prepend restored trip
                const restoredTrip = await db.getTrip(restoredId)
                if (restoredTrip) {
                  set(state => ({ trips: [restoredTrip, ...state.trips] }))
                }
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

          // Partial update: toggle in-place instead of full reload
          set(state => ({
            trips: state.trips.map(t => t.id === id ? { ...t, isFavorite: !t.isFavorite } : t),
            currentTrip:
              state.currentTrip?.id === id
                ? { ...state.currentTrip, isFavorite: !state.currentTrip.isFavorite }
                : state.currentTrip,
          }))
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
              // Upload plan photos in background if present
              if (savedPlan.photos?.length && firebaseId) {
                const updatedPlan = await db.getPlan(id)
                if (updatedPlan) {
                  import('@/services/imageSync').then(({ uploadPlanPhotos }) => {
                    import('@/stores/authStore').then(({ useAuthStore }) => {
                      const userId = useAuthStore.getState().user?.uid
                      if (userId) uploadPlanPhotos(userId, updatedPlan)
                    })
                  }).catch(console.error)
                }
              }
            }
          }

          // Reload plans for current trip; update plansCount in-place
          const plans = await db.getPlansForTrip(planData.tripId)
          set(state => ({
            currentPlans: plans,
            trips: state.trips.map(t => t.id === planData.tripId ? { ...t, plansCount: plans.length } : t),
            currentTrip: state.currentTrip?.id === planData.tripId ? { ...state.currentTrip, plansCount: plans.length } : state.currentTrip,
            isLoading: false,
          }))
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
          // photos 변경 시 재업로드 트리거를 위해 storage paths를 비운다 (호출자 인자 비변형)
          const updatesToApply = 'photos' in updates
            ? ({ ...updates, photoPaths: undefined } as Partial<Plan>)
            : updates
          await db.updatePlan(id, updatesToApply)
          const plan = await db.getPlan(id)
          if (plan) {
            // Sync to Firestore
            if (syncManager.isActive()) {
              const firebaseId = await syncManager.uploadPlan(plan)
              if (!plan.firebaseId && firebaseId) {
                await db.updatePlan(id, { firebaseId })
              }
              // Upload plan photos in background if changed
              if ('photos' in updates && plan.photos?.length && plan.firebaseId) {
                import('@/services/imageSync').then(({ uploadPlanPhotos }) => {
                  import('@/stores/authStore').then(({ useAuthStore }) => {
                    const userId = useAuthStore.getState().user?.uid
                    if (userId) uploadPlanPhotos(userId, plan)
                  })
                }).catch(console.error)
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

          // Mark as pending delete to prevent listener re-creation during undo window
          if (firebaseId) syncManager.addPendingDelete(firebaseId)
          for (const seg of affectedSegments) {
            if (seg.firebaseId) syncManager.addPendingDelete(seg.firebaseId)
          }

          // Immediately delete from local DB
          await db.deletePlan(id)
          await db.deleteRouteSegmentsForPlan(id)

          // Reload plans for current trip; update plansCount in-place
          const plans = await db.getPlansForTrip(tripId)
          set(state => ({
            currentPlans: plans,
            trips: state.trips.map(t => t.id === tripId ? { ...t, plansCount: plans.length } : t),
            currentTrip: state.currentTrip?.id === tripId ? { ...state.currentTrip, plansCount: plans.length } : state.currentTrip,
            isLoading: false,
          }))
          sendBroadcast('PLAN_DELETED', { id, tripId })

          // Deferred Firestore deletion with undo
          const planUndoController = new AbortController()
          const timer = setTimeout(async () => {
            if (planUndoController.signal.aborted) return
            if (syncManager.isActive()) {
              if (firebaseId) {
                try { await syncManager.deleteRemotePlan(firebaseId) }
                catch (e) {
                  if (planUndoController.signal.aborted) return
                  console.error('[Sync] Failed to delete remote plan:', e)
                }
              }
              for (const seg of affectedSegments) {
                if (seg.firebaseId) {
                  try { await syncManager.deleteRemoteRouteSegment(seg.firebaseId) }
                  catch (e) { console.error('[Sync] Failed to delete remote route segment:', e) }
                }
              }
            }
            // Clean up pending deletes
            if (firebaseId) syncManager.removePendingDelete(firebaseId)
            for (const seg of affectedSegments) {
              if (seg.firebaseId) syncManager.removePendingDelete(seg.firebaseId)
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
                planUndoController.abort()
                clearTimeout(timer)
                // Remove pending deletes on undo
                if (firebaseId) syncManager.removePendingDelete(firebaseId)
                for (const seg of affectedSegments) {
                  if (seg.firebaseId) syncManager.removePendingDelete(seg.firebaseId)
                }
                await db.addPlan({ ...planSnapshot, id: undefined } as Omit<Plan, 'id'>)
                const restoredPlans = await db.getPlansForTrip(tripId)
                set(state => ({
                  currentPlans: restoredPlans,
                  trips: state.trips.map(t => t.id === tripId ? { ...t, plansCount: restoredPlans.length } : t),
                }))
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

          // Create duplicated trip (reset id, firebaseId, coverImagePath)
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

          // Duplicate all plans (reset id, firebaseId, photoPaths, update tripId)
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
              // photoPaths intentionally omitted — new entity needs its own upload
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

          // Partial update: prepend duplicated trip
          const savedNewTrip = await db.getTrip(newTripId)
          if (savedNewTrip) {
            set(state => ({ trips: [savedNewTrip, ...state.trips], isLoading: false }))
          } else {
            set({ isLoading: false })
          }
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

          // Partial update: filter out deleted trips
          const deletedSet = new Set(ids)
          set(state => ({
            trips: state.trips.filter(t => !deletedSet.has(t.id!)),
            isLoading: false,
          }))
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
