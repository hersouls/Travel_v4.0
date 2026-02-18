// ============================================
// Sync Hook
// Auth 상태 변화에 따라 syncManager 시작/중지
// StrictMode 이중 마운트는 SyncManager 내부
// generation 카운터로 처리됨 (첫 번째 sync 자동 중단)
// ============================================

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useTripStore } from '@/stores/tripStore'
import { usePlaceStore } from '@/stores/placeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import { syncManager } from '@/services/firestoreSync'

export function useSync() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!user) {
      syncManager.stop()
      useUIStore.getState().setSyncProgress({ status: 'idle' })
      return
    }

    syncManager.start(user.uid)

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
      syncManager.stop()
    }
  }, [user?.uid])
}
