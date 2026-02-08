// ============================================
// Sync Hook
// Auth 상태 변화에 따라 syncManager 시작/중지
// ============================================

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useTripStore } from '@/stores/tripStore'
import { usePlaceStore } from '@/stores/placeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { syncManager } from '@/services/firestoreSync'

export function useSync() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!user) {
      syncManager.stop()
      return
    }

    syncManager.start(user.uid)

    const unsub = syncManager.onSyncUpdate(() => {
      useTripStore.getState().loadTrips()
      usePlaceStore.getState().loadPlaces()
      useSettingsStore.getState().initialize()
    })

    return () => {
      unsub()
      syncManager.stop()
    }
  }, [user?.uid])
}
