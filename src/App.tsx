import { useEffect, Suspense, lazy } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useTripStore } from '@/stores/tripStore'
import { usePlaceStore } from '@/stores/placeStore'
import { useSettingsStore, useMusicPlayerEnabled, useTimezoneAutoDetect } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore, useToasts } from '@/stores/uiStore'
import { ToastContainer } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { MusicPlayer } from '@/components/audio'
import { TimezoneAlert } from '@/components/timezone'
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt'
import { SyncProgressOverlay } from '@/components/sync/SyncProgressOverlay'
import { CommandPalette } from '@/components/search/CommandPalette'
import { useTimezoneDetection } from '@/hooks/useTimezoneDetection'
import { subscribeToBroadcast, type BroadcastMessage } from '@/services/broadcast'
import { useSync } from '@/hooks/useSync'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'

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
  const isMusicPlayerEnabled = useMusicPlayerEnabled()
  const timezoneAutoDetect = useTimezoneAutoDetect()
  const updateDetectedTimezone = useSettingsStore((s) => s.updateDetectedTimezone)

  // Timezone detection
  const {
    currentTimezone,
    previousTimezone,
    hasChanged,
    updateTimezone,
    dismissChange
  } = useTimezoneDetection()

  // Initialize stores and auth on mount
  useEffect(() => {
    const initialize = async () => {
      await useSettingsStore.getState().initialize()
      await useTripStore.getState().initialize()
      await usePlaceStore.getState().initialize()
    }
    initialize()

    // Initialize Firebase Auth listener
    const unsubAuth = useAuthStore.getState().initialize()
    return () => unsubAuth()
  }, [])

  // Start/stop Firestore sync based on auth state
  useSync()

  // Global keyboard shortcuts (Ctrl+N, Escape, etc.)
  useKeyboardShortcuts()

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
        useSettingsStore.getState().initialize()
      }
    }

    const unsubscribe = subscribeToBroadcast(handleBroadcast)
    return () => unsubscribe()
  }, [])

  // Scroll position restoration (saves on leave, restores on back/forward)
  useScrollRestoration()

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)]">
      {/* Skip Navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary-500 focus:text-white focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-semibold"
      >
        본문으로 건너뛰기
      </a>

      {/* Header */}
      <Suspense fallback={<Skeleton height={64} className="w-full" />}>
        <Header />
      </Suspense>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (Desktop) */}
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>

        {/* Main Content */}
        <div
          id="main-content"
          tabIndex={-1}
          className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 outline-none ${
            isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
          }`}
        >
          <Suspense fallback={<LoadingFallback />}>
            <Outlet />
          </Suspense>
        </div>
      </div>

      {/* Mobile Navigation */}
      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>

      {/* Music Player */}
      {isMusicPlayerEnabled && (
        <div className="fixed bottom-20 lg:bottom-4 right-4 z-30">
          <MusicPlayer />
        </div>
      )}

      {/* Timezone Change Alert */}
      {timezoneAutoDetect && (
        <TimezoneAlert
          isVisible={hasChanged}
          previousTimezone={previousTimezone}
          currentTimezone={currentTimezone}
          onConfirm={() => {
            updateTimezone()
            updateDetectedTimezone(currentTimezone)
          }}
          onDismiss={dismissChange}
        />
      )}

      {/* PWA Update Prompt */}
      <PWAUpdatePrompt />

      {/* Sync Progress Overlay */}
      <SyncProgressOverlay />

      {/* Command Palette */}
      <CommandPalette />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
