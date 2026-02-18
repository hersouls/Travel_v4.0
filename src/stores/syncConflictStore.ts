// ============================================
// Sync Conflict Store (Zustand)
// Manages pending field-level sync conflicts
// ============================================

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { PendingConflict, ConflictResolution, SyncEntityType } from '@/types'
import { buildMergedRecord } from '@/utils/syncConflict'
import { db as dexieDb } from '@/services/database'
import { syncManager } from '@/services/firestoreSync'

interface SyncConflictState {
  pendingConflicts: PendingConflict[]
  isModalOpen: boolean
  currentIndex: number

  addConflict: (conflict: PendingConflict) => void
  removeConflict: (conflictId: string) => void
  clearAllConflicts: () => void
  openModal: () => void
  closeModal: () => void
  setCurrentIndex: (index: number) => void

  resolveConflict: (
    conflictId: string,
    resolutions: Record<string, ConflictResolution>,
  ) => Promise<void>
  resolveAllAsCloud: () => Promise<void>
  resolveAllAsLocal: () => Promise<void>
}

export const useSyncConflictStore = create<SyncConflictState>()(
  devtools(
    (set, get) => ({
      pendingConflicts: [],
      isModalOpen: false,
      currentIndex: 0,

      addConflict: (conflict) => {
        set((state) => {
          const filtered = state.pendingConflicts.filter(
            (c) => !(c.entityType === conflict.entityType && c.firebaseId === conflict.firebaseId),
          )
          const updated = [...filtered, conflict]
          return {
            pendingConflicts: updated,
            isModalOpen: updated.length > 0,
          }
        })
      },

      removeConflict: (conflictId) => {
        set((state) => {
          const updated = state.pendingConflicts.filter((c) => c.id !== conflictId)
          return {
            pendingConflicts: updated,
            isModalOpen: updated.length > 0 ? state.isModalOpen : false,
            currentIndex: Math.min(state.currentIndex, Math.max(0, updated.length - 1)),
          }
        })
      },

      clearAllConflicts: () => {
        set({ pendingConflicts: [], isModalOpen: false, currentIndex: 0 })
      },

      openModal: () => set({ isModalOpen: true }),
      closeModal: () => set({ isModalOpen: false }),
      setCurrentIndex: (index) => set({ currentIndex: index }),

      resolveConflict: async (conflictId, resolutions) => {
        const conflict = get().pendingConflicts.find((c) => c.id === conflictId)
        if (!conflict) return

        const merged = buildMergedRecord(conflict, resolutions, conflict.entityType)
        // Remove conflict from store FIRST to prevent race condition:
        // If we remove after upload, a concurrent onSnapshot can replace
        // this conflict with a new one (same entity, new ID), and our
        // removeConflict(oldId) would fail to find it.
        get().removeConflict(conflictId)
        await applyResolution(conflict.entityType, conflict.entityId, conflict.firebaseId, merged)
      },

      resolveAllAsCloud: async () => {
        const conflicts = [...get().pendingConflicts]
        for (const conflict of conflicts) {
          const allCloud: Record<string, ConflictResolution> = {}
          for (const cf of conflict.conflictFields) allCloud[cf.field] = 'cloud'
          const merged = buildMergedRecord(conflict, allCloud, conflict.entityType)
          await applyResolution(conflict.entityType, conflict.entityId, conflict.firebaseId, merged)
        }
        set({ pendingConflicts: [], isModalOpen: false, currentIndex: 0 })
      },

      resolveAllAsLocal: async () => {
        const conflicts = [...get().pendingConflicts]
        for (const conflict of conflicts) {
          const allLocal: Record<string, ConflictResolution> = {}
          for (const cf of conflict.conflictFields) allLocal[cf.field] = 'local'
          const merged = buildMergedRecord(conflict, allLocal, conflict.entityType)
          await applyResolution(conflict.entityType, conflict.entityId, conflict.firebaseId, merged)
        }
        set({ pendingConflicts: [], isModalOpen: false, currentIndex: 0 })
      },
    }),
    { name: 'sync-conflict-store' },
  ),
)

async function applyResolution(
  entityType: SyncEntityType,
  entityId: number,
  firebaseId: string,
  mergedFields: Record<string, unknown>,
): Promise<void> {
  // Mark as recently resolved to suppress conflict re-detection
  syncManager.markResolved(entityType, firebaseId)

  const updates = { ...mergedFields, updatedAt: new Date() }

  switch (entityType) {
    case 'trip': {
      await dexieDb.trips.update(entityId, updates)
      const trip = await dexieDb.trips.get(entityId)
      if (trip && syncManager.isActive()) await syncManager.uploadTrip(trip)
      break
    }
    case 'plan': {
      await dexieDb.plans.update(entityId, updates)
      const plan = await dexieDb.plans.get(entityId)
      if (plan && syncManager.isActive()) await syncManager.uploadPlan(plan)
      break
    }
    case 'place': {
      await dexieDb.places.update(entityId, updates)
      const place = await dexieDb.places.get(entityId)
      if (place && syncManager.isActive()) await syncManager.uploadPlace(place)
      break
    }
  }
}

// Selector hooks
export const usePendingConflicts = () => useSyncConflictStore((s) => s.pendingConflicts)
export const useConflictModalOpen = () => useSyncConflictStore((s) => s.isModalOpen)
