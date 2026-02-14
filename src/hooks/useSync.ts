// ============================================
// Sync Hook
// Auth 상태 변화에 따라 syncManager 시작/중지
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
