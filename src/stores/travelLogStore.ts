// ============================================
// Travel Log Store (Zustand)
// ============================================

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { TravelLog } from '@/types'
import * as db from '@/services/database'
import { sendBroadcast } from '@/services/broadcast'
import { syncManager } from '@/services/firestoreSync'
import { useUIStore } from '@/stores/uiStore'

const UNDO_TIMEOUT_MS = 30_000

interface TravelLogState {
  // State
  logs: TravelLog[]
  isLoading: boolean
  error: string | null

  // Actions
  loadLogs: (tripId: number) => Promise<void>
  loadLogsForDay: (tripId: number, day: number) => Promise<void>
  addLog: (log: Omit<TravelLog, 'id' | 'createdAt' | 'updatedAt'>) => Promise<number>
  updateLog: (id: number, updates: Partial<TravelLog>) => Promise<void>
  deleteLog: (id: number) => Promise<void>
  clearLogs: () => void
  setError: (error: string | null) => void
}

export const useTravelLogStore = create<TravelLogState>()(
  devtools(
    (set) => ({
      // Initial State
      logs: [],
      isLoading: false,
      error: null,

      // Load all logs for a trip
      loadLogs: async (tripId) => {
        set({ isLoading: true, error: null })
        try {
          const logs = await db.getTravelLogsForTrip(tripId)
          set({ logs, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Load logs for a specific day
      loadLogsForDay: async (tripId, day) => {
        set({ isLoading: true, error: null })
        try {
          const logs = await db.getTravelLogsForTripDay(tripId, day)
          set({ logs, isLoading: false })
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Add a new log
      addLog: async (logData) => {
        try {
          const log: Omit<TravelLog, 'id'> = {
            ...logData,
            // Ensure coordinates are valid finite numbers
            latitude: typeof logData.latitude === 'number' && isFinite(logData.latitude) ? logData.latitude : undefined,
            longitude: typeof logData.longitude === 'number' && isFinite(logData.longitude) ? logData.longitude : undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          const id = await db.addTravelLog(log)

          // Sync to Firestore
          if (syncManager.isActive()) {
            const savedLog = await db.getTravelLog(id)
            if (savedLog) {
              try {
                const firebaseId = await syncManager.uploadTravelLog(savedLog)
                if (firebaseId) {
                  await db.updateTravelLog(id, { firebaseId })
                }
                // Background photo upload
                if (savedLog.photo) {
                  const updatedLog = await db.getTravelLog(id)
                  if (updatedLog?.firebaseId) {
                    import('@/services/imageSync').then(({ uploadTravelLogPhoto }) => {
                      import('@/stores/authStore').then(({ useAuthStore }) => {
                        const userId = useAuthStore.getState().user?.uid
                        if (userId && updatedLog) uploadTravelLogPhoto(userId, updatedLog)
                      })
                    }).catch(console.error)
                  }
                }
              } catch (e) {
                console.error('[TravelLogStore] Sync failed:', e)
              }
            }
          }

          // Partial update: append new log and re-sort instead of full reload
          const newLog = await db.getTravelLog(id)
          if (newLog) {
            set(state => {
              const updated = [...state.logs, newLog]
              updated.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
              return { logs: updated }
            })
          }
          sendBroadcast('LOG_CREATED', { id, tripId: logData.tripId })
          return id
        } catch (error) {
          set({ error: (error as Error).message })
          throw error
        }
      },

      // Update a log
      updateLog: async (id, updates) => {
        try {
          // If photo changed, clear path to trigger re-upload
          if ('photo' in updates) {
            updates.photoPath = undefined
          }
          if ('thumbnailPhoto' in updates) {
            updates.thumbnailPhotoPath = undefined
          }

          await db.updateTravelLog(id, updates)

          const log = await db.getTravelLog(id)
          if (log) {
            // Sync
            if (syncManager.isActive()) {
              try {
                const firebaseId = await syncManager.uploadTravelLog(log)
                if (!log.firebaseId && firebaseId) {
                  await db.updateTravelLog(id, { firebaseId })
                }
              } catch (e) {
                console.error('[TravelLogStore] Sync update failed:', e)
              }
            }

            // Partial update: replace single log in-place
            set(state => ({
              logs: state.logs.map(l => l.id === id ? log : l),
            }))
            sendBroadcast('LOG_UPDATED', { id, tripId: log.tripId })
          }
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      // Delete a log with 30s undo
      deleteLog: async (id) => {
        try {
          const snapshot = await db.getTravelLog(id)
          if (!snapshot) return

          const tripId = snapshot.tripId
          const firebaseId = snapshot.firebaseId

          // Mark as pending delete to prevent sync listener from re-creating
          if (firebaseId) syncManager.addPendingDelete(firebaseId)

          // Delete locally
          await db.deleteTravelLog(id)

          // Partial update: filter out deleted log
          set(state => ({ logs: state.logs.filter(l => l.id !== id) }))
          sendBroadcast('LOG_DELETED', { id, tripId })

          // Deferred remote delete with undo
          const undoController = new AbortController()
          const timer = setTimeout(async () => {
            if (undoController.signal.aborted) return
            if (syncManager.isActive() && firebaseId) {
              try {
                await syncManager.deleteRemoteTravelLog(firebaseId)
              } catch (e) {
                if (undoController.signal.aborted) return
                console.error('[TravelLogStore] Remote delete failed:', e)
              }
            }
            if (firebaseId) syncManager.removePendingDelete(firebaseId)
          }, UNDO_TIMEOUT_MS)

          useUIStore.getState().showToast({
            type: 'warning',
            title: '기록이 삭제되었습니다',
            message: '30초 이내에 되돌릴 수 있습니다',
            duration: UNDO_TIMEOUT_MS,
            action: {
              label: '되돌리기',
              onClick: async () => {
                undoController.abort()
                clearTimeout(timer)
                if (firebaseId) syncManager.removePendingDelete(firebaseId)
                // Restore from snapshot
                const { id: _id, ...rest } = snapshot
                await db.addTravelLog(rest as Omit<TravelLog, 'id'>)
                // Partial update: re-insert restored log and re-sort
                set(state => {
                  const updated = [...state.logs, snapshot as TravelLog]
                  updated.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                  return { logs: updated }
                })
                useUIStore.getState().showToast({
                  type: 'success',
                  title: '기록이 복원되었습니다',
                })
              },
            },
          })
        } catch (error) {
          set({ error: (error as Error).message })
        }
      },

      // Clear logs (when navigating away)
      clearLogs: () => set({ logs: [], error: null }),

      // Set error
      setError: (error) => set({ error }),
    }),
    { name: 'travel-log-store' },
  ),
)

// Selector hooks
export const useTravelLogs = () => useTravelLogStore((state) => state.logs)
export const useTravelLogLoading = () => useTravelLogStore((state) => state.isLoading)
