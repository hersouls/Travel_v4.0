// ============================================
// UI Store (Zustand)
// ============================================

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Toast } from '@/types'

type ViewType = 'dashboard' | 'tripDetail' | 'tripForm' | 'planForm' | 'map' | 'places' | 'settings'

interface UIState {
  // Navigation
  currentView: ViewType

  // Modal States
  isSettingsOpen: boolean
  isSearchOpen: boolean

  // Mobile Menu
  isMobileMenuOpen: boolean
  isSidebarCollapsed: boolean

  // Loading States
  isGlobalLoading: boolean
  loadingMessage: string

  // Toast Notifications
  toasts: Toast[]

  // Actions
  setCurrentView: (view: ViewType) => void
  setSettingsOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  setMobileMenuOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setGlobalLoading: (loading: boolean, message?: string) => void

  // Toast Actions
  showToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  clearAllToasts: () => void
}

export const useUIStore = create<UIState>()(
  devtools(
    (set, get) => ({
      // Initial State
      currentView: 'dashboard',
      isSettingsOpen: false,
      isSearchOpen: false,
      isMobileMenuOpen: false,
      isSidebarCollapsed: false,
      isGlobalLoading: false,
      loadingMessage: '',
      toasts: [],

      // Navigation
      setCurrentView: (view) => set({ currentView: view }),

      // Modals
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),
      setSearchOpen: (open) => set({ isSearchOpen: open }),

      // Mobile
      setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),

      // Loading
      setGlobalLoading: (loading, message = '') => set({ isGlobalLoading: loading, loadingMessage: message }),

      // Toast
      showToast: (toast) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const newToast: Toast = { ...toast, id }
        set((state) => ({ toasts: [...state.toasts, newToast] }))

        // Auto dismiss after duration
        if (toast.duration !== 0) {
          setTimeout(() => {
            get().dismissToast(id)
          }, toast.duration || 5000)
        }
      },

      dismissToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      },

      clearAllToasts: () => set({ toasts: [] }),
    }),
    { name: 'ui-store' }
  )
)

// Selector hooks
export const useCurrentView = () => useUIStore((state) => state.currentView)
export const useToasts = () => useUIStore((state) => state.toasts)
export const useIsLoading = () => useUIStore((state) => state.isGlobalLoading)

// Toast helper functions
export const toast = {
  success: (title: string, message?: string) => useUIStore.getState().showToast({ type: 'success', title, message }),
  error: (title: string, message?: string) => useUIStore.getState().showToast({ type: 'error', title, message }),
  warning: (title: string, message?: string) => useUIStore.getState().showToast({ type: 'warning', title, message }),
  info: (title: string, message?: string) => useUIStore.getState().showToast({ type: 'info', title, message }),
}
