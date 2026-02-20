// ============================================
// Service Worker Hook - PWA Update Management
// ============================================

import { useState, useEffect, useCallback } from 'react'

interface ServiceWorkerState {
  isUpdateAvailable: boolean
  isUpdating: boolean
  registration: ServiceWorkerRegistration | null
  waitingWorker: ServiceWorker | null
}

declare global {
  interface WindowEventMap {
    pwaUpdateAvailable: CustomEvent<{
      registration: ServiceWorkerRegistration
      waitingWorker: ServiceWorker
    }>
  }
}

export function useServiceWorker() {
  const [state, setState] = useState<ServiceWorkerState>({
    isUpdateAvailable: false,
    isUpdating: false,
    registration: null,
    waitingWorker: null,
  })

  useEffect(() => {
    const handleUpdate = (e: CustomEvent<{
      registration: ServiceWorkerRegistration
      waitingWorker: ServiceWorker
    }>) => {
      console.log('[useServiceWorker] Update available event received')
      setState(prev => ({
        ...prev,
        isUpdateAvailable: true,
        registration: e.detail.registration,
        waitingWorker: e.detail.waitingWorker,
      }))
    }

    window.addEventListener('pwaUpdateAvailable', handleUpdate)
    return () => {
      window.removeEventListener('pwaUpdateAvailable', handleUpdate)
    }
  }, [])

  const applyUpdate = useCallback(() => {
    const { waitingWorker } = state
    if (!waitingWorker) {
      console.warn('[useServiceWorker] No waiting worker to update')
      return
    }

    console.log('[useServiceWorker] Applying update...')
    setState(prev => ({ ...prev, isUpdating: true }))

    let reloading = false

    const handleControllerChange = () => {
      if (reloading) return
      reloading = true
      console.log('[useServiceWorker] Controller changed, reloading...')
      // 리스너 정리 후 리로드
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      window.location.reload()
    }

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    // Send SKIP_WAITING to the waiting worker
    waitingWorker.postMessage({ type: 'SKIP_WAITING' })

    // Fallback: if controllerchange doesn't fire within 3 seconds
    setTimeout(() => {
      if (!reloading) {
        console.warn('[useServiceWorker] controllerchange timeout, forcing reload')
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
        window.location.reload()
      }
    }, 3000)
  }, [state])

  const dismissUpdate = useCallback(() => {
    console.log('[useServiceWorker] Update dismissed')
    setState(prev => ({ ...prev, isUpdateAvailable: false }))
  }, [])

  return {
    isUpdateAvailable: state.isUpdateAvailable,
    isUpdating: state.isUpdating,
    applyUpdate,
    dismissUpdate,
  }
}
