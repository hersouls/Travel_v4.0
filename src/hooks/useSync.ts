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
import { useUIStore } from '@/stores/uiStore'
import { syncManager } from '@/services/firestoreSync'

export function useSync() {
  const user = useAuthStore((s) => s.user)
  const prevUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!user) {
      const wasLoggedIn = prevUserIdRef.current !== null
      prevUserIdRef.current = null

      if (wasLoggedIn) {
        // User explicitly logged out: stop sync AND clear stale IndexedDB data
        // This prevents data resurrection when the same or different user logs in next
        syncManager.stop({ clearData: true }).then(() => {
          // Reload stores to reflect the now-empty IndexedDB
          useTripStore.getState().loadTrips()
          usePlaceStore.getState().loadPlaces()
        })
      } else {
        // App initialized with no user (never logged in this session)
        syncManager.stop()
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
        prevUserIdRef.current = user.uid
        syncManager.start(user.uid)
      })
    } else {
      // Same user or first login: start sync normally
      prevUserIdRef.current = user.uid
      syncManager.start(user.uid)
    }

    const unsubUpdate = syncManager.onSyncUpdate(() => {
      useTripStore.getState().loadTrips()
      usePlaceStore.getState().loadPlaces()
      useSettingsStore.getState().initialize()
      // Reload current trip/plans to pick up downloaded images
      const currentTrip = useTripStore.getState().currentTrip
      if (currentTrip?.id) {
        useTripStore.getState().loadTrip(currentTrip.id)
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
      syncManager.stop()
    }
  }, [user?.uid])
}
