import { useEffect, Suspense, lazy } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTripStore } from '@/stores/tripStore'
import { usePlaceStore } from '@/stores/placeStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore, useToasts } from '@/stores/uiStore'
import { ToastContainer } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { subscribeToBroadcast, type BroadcastMessage } from '@/services/broadcast'

// Lazy load layout components
const Header = lazy(() => import('@/components/layout/Header').then(m => ({ default: m.Header })))
const Sidebar = lazy(() => import('@/components/layout/Sidebar').then(m => ({ default: m.Sidebar })))
const MobileNav = lazy(() => import('@/components/layout/MobileNav').then(m => ({ default: m.MobileNav })))

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-zinc-500 dark:text-zinc-400">로딩 중...</p>
      </div>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const toasts = useToasts()
  const dismissToast = useUIStore((state) => state.dismissToast)
  const isSidebarCollapsed = useUIStore((state) => state.isSidebarCollapsed)

  // Initialize stores on mount
  useEffect(() => {
    const initialize = async () => {
      await useSettingsStore.getState().initialize()
      await useTripStore.getState().initialize()
      await usePlaceStore.getState().initialize()
    }
    initialize()
  }, [])

  // Subscribe to cross-tab broadcasts
  useEffect(() => {
    const handleBroadcast = (message: BroadcastMessage) => {
      const { type } = message

      // Reload data based on message type
      if (type.startsWith('TRIP_') || type.startsWith('PLAN_')) {
        useTripStore.getState().loadTrips()
      }
      if (type.startsWith('PLACE_')) {
        usePlaceStore.getState().loadPlaces()
      }
      if (type === 'SETTINGS_CHANGED') {
        useSettingsStore.getState().initialize()
      }
      if (type === 'DATA_IMPORTED' || type === 'DATA_CLEARED') {
        useTripStore.getState().loadTrips()
        usePlaceStore.getState().loadPlaces()
      }
    }

    const unsubscribe = subscribeToBroadcast(handleBroadcast)
    return () => unsubscribe()
  }, [])

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <Suspense fallback={<Skeleton height={64} className="w-full" />}>
        <Header />
      </Suspense>

      {/* Main Layout */}
      <div className="flex">
        {/* Sidebar (Desktop) */}
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>

        {/* Main Content */}
        <main
          className={`flex-1 min-h-[calc(100vh-4rem)] transition-all duration-300 ${
            isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
          }`}
        >
          <div className="container mx-auto px-4 py-6 pb-24 lg:pb-6">
            <Suspense fallback={<LoadingFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Mobile Navigation */}
      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
