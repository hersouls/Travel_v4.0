// ============================================
// Sync Hook
// Auth 상태 변화에 따라 syncManager 시작/중지
// 로그아웃/계정전환 시 IndexedDB 캐시 정리
// StrictMode 이중 마운트는 SyncManager 내부
// generation 카운터로 처리됨 (첫 번째 sync 자동 중단)
// ============================================

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useTripStore } from '@/stores/tripStore'
import { usePlaceStore } from '@/stores/placeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTravelLogStore } from '@/stores/travelLogStore'
import { useUIStore } from '@/stores/uiStore'
import { syncManager } from '@/services/firestoreSync'

export function useSync() {
  const user = useAuthStore((s) => s.user)
  const prevUserIdRef = useRef<string | null>(null)
  // BUG-05: Generation counter to detect stale async operations
  // during rapid account switches
  const generationRef = useRef(0)

  useEffect(() => {
    const currentGeneration = ++generationRef.current

    if (!user) {
      const wasLoggedIn = prevUserIdRef.current !== null
      prevUserIdRef.current = null

      if (wasLoggedIn) {
        // User explicitly logged out: stop sync AND clear stale IndexedDB data
        // This prevents data resurrection when the same or different user logs in next
        syncManager.stop({ clearData: true }).then(() => {
          // Check generation: if another switch happened, abort
          if (generationRef.current !== currentGeneration) return
          // Reload stores to reflect the now-empty IndexedDB
          useTripStore.getState().loadTrips()
          usePlaceStore.getState().loadPlaces()
        }).catch((err) => {
          console.error('[Sync] Failed to stop with clearData:', err)
        })
      } else {
        // App initialized with no user (never logged in this session)
        syncManager.stop().catch((err) => {
          console.error('[Sync] Stop failed:', err)
        })
      }
      useUIStore.getState().setSyncProgress({ status: 'idle' })
      return
    }

    // Handle user switch (different uid than previous)
    const previousUserId = prevUserIdRef.current
    if (previousUserId && previousUserId !== user.uid) {
      // Different user logging in: clear previous user's data first, then start sync
      console.log('[Sync] User switch detected:', previousUserId, '→', user.uid)
      syncManager.stop({ clearData: true }).then(() => {
        // BUG-05: If yet another switch happened during the async gap, abort
        if (generationRef.current !== currentGeneration) return
        prevUserIdRef.current = user.uid
        syncManager.start(user.uid)
      }).catch((err) => {
        console.error('[Sync] Failed to stop during user switch:', err)
      })
    } else {
      // Same user or first login: start sync normally
      prevUserIdRef.current = user.uid
      syncManager.start(user.uid)
    }

    const unsubUpdate = syncManager.onSyncUpdate(() => {
      try {
        useTripStore.getState().loadTrips()
        usePlaceStore.getState().loadPlaces()
        useSettingsStore.getState().initialize()
        // Reload current trip/plans to pick up downloaded images
        const currentTrip = useTripStore.getState().currentTrip
        if (currentTrip?.id) {
          useTripStore.getState().loadTrip(currentTrip.id)
        }
        // Reload travel logs if currently viewing a trip
        const { logs } = useTravelLogStore.getState()
        if (logs.length > 0) {
          const tripId = logs[0]?.tripId
          if (tripId) useTravelLogStore.getState().loadLogs(tripId)
        }
      } catch (err) {
        console.error('[Sync] onSyncUpdate callback error:', err)
      }
    })

    const unsubStatus = syncManager.onSyncStatus((progress) => {
      useUIStore.getState().setSyncProgress(progress)
    })

    return () => {
      unsubUpdate()
      unsubStatus()
      // Component unmount cleanup: stop sync but do NOT clear data
      // (This runs on HMR, tab close, or React StrictMode re-mount)
      syncManager.stop().catch((err) => {
        console.error('[Sync] Stop on unmount failed:', err)
      })
    }
  }, [user?.uid])
}
