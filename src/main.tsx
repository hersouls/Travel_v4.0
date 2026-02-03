import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'
import App from './App'
import { requestPersistentStorage } from '@/services/storageQuota'
import { initCacheWarming } from '@/services/cacheWarming'

// Lazy load pages
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })))
const TripDetail = lazy(() => import('@/pages/TripDetail').then(m => ({ default: m.TripDetail })))
const TripForm = lazy(() => import('@/pages/TripForm').then(m => ({ default: m.TripForm })))
const PlanForm = lazy(() => import('@/pages/PlanForm').then(m => ({ default: m.PlanForm })))
const PlanDetail = lazy(() => import('@/pages/PlanDetail').then(m => ({ default: m.PlanDetail })))
const TripMap = lazy(() => import('@/pages/TripMap').then(m => ({ default: m.TripMap })))
const DayDetail = lazy(() => import('@/pages/DayDetail').then(m => ({ default: m.DayDetail })))
const PlaceLibrary = lazy(() => import('@/pages/PlaceLibrary').then(m => ({ default: m.PlaceLibrary })))
const Settings = lazy(() => import('@/pages/Settings').then(m => ({ default: m.Settings })))
const About = lazy(() => import('@/pages/About').then(m => ({ default: m.About })))

// Loading fallback component
function PageLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// Router configuration
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<PageLoading />}>
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: 'trips/new',
        element: (
          <Suspense fallback={<PageLoading />}>
            <TripForm />
          </Suspense>
        ),
      },
      {
        path: 'trips/:id',
        element: (
          <Suspense fallback={<PageLoading />}>
            <TripDetail />
          </Suspense>
        ),
      },
      {
        path: 'trips/:id/edit',
        element: (
          <Suspense fallback={<PageLoading />}>
            <TripForm />
          </Suspense>
        ),
      },
      {
        path: 'trips/:tripId/plans/new',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PlanForm />
          </Suspense>
        ),
      },
      {
        path: 'trips/:tripId/plans/:planId',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PlanDetail />
          </Suspense>
        ),
      },
      {
        path: 'trips/:tripId/plans/:planId/edit',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PlanForm />
          </Suspense>
        ),
      },
      {
        path: 'trips/:id/day/:day',
        element: (
          <Suspense fallback={<PageLoading />}>
            <DayDetail />
          </Suspense>
        ),
      },
      {
        path: 'trips/:id/map',
        element: (
          <Suspense fallback={<PageLoading />}>
            <TripMap />
          </Suspense>
        ),
      },
      {
        path: 'places',
        element: (
          <Suspense fallback={<PageLoading />}>
            <PlaceLibrary />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<PageLoading />}>
            <Settings />
          </Suspense>
        ),
      },
      {
        path: 'about',
        element: (
          <Suspense fallback={<PageLoading />}>
            <About />
          </Suspense>
        ),
      },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])

// Service Worker Registration (PWA)
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope)

        // Check for updates every 60 minutes
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content available
                if (confirm('새 버전이 있습니다. 새로고침하시겠습니까?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' })
                  window.location.reload()
                }
              }
            })
          }
        })
      })
      .catch((error) => {
        console.error('SW registration failed:', error)
      })
  } else {
    // Development: unregister all service workers
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister()
      }
    })
  }
}

// PWA Install Prompt
let deferredPrompt: BeforeInstallPromptEvent | null = null

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

window.addEventListener('beforeinstallprompt', (e: Event) => {
  e.preventDefault()
  deferredPrompt = e as BeforeInstallPromptEvent
  window.dispatchEvent(new CustomEvent('pwaInstallAvailable'))
})

// Expose install function globally
declare global {
  interface Window {
    installPWA: () => Promise<boolean>
  }
}

window.installPWA = async () => {
  if (!deferredPrompt) return false
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  return outcome === 'accepted'
}

// Request persistent storage and initialize cache warming
if (typeof window !== 'undefined') {
  // Request persistent storage to prevent data loss
  requestPersistentStorage().then((granted) => {
    if (granted) {
      console.log('[App] Persistent storage granted')
    }
  })

  // Initialize cache warming after page load
  window.addEventListener('load', () => {
    initCacheWarming()
  })
}

// Render app
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
