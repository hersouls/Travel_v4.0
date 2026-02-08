// ============================================
// Auth Store (Zustand)
// Firebase Google Authentication (Redirect flow)
// ============================================

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { getFirebaseAuth, isFirebaseConfigured } from '@/services/firebase'

interface AuthState {
  user: User | null
  isLoading: boolean
  isInitialized: boolean
  error: string | null

  initialize: () => () => void
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      isLoading: false,
      isInitialized: false,
      error: null,

      initialize: () => {
        if (!isFirebaseConfigured()) {
          set({ isInitialized: true })
          return () => {}
        }

        set({ isLoading: true })
        const auth = getFirebaseAuth()

        // Check for redirect result (after page reload from redirect login)
        getRedirectResult(auth)
          .then((result) => {
            if (result?.user) {
              console.log('[Auth] Redirect login successful:', result.user.email)
            }
          })
          .catch((error) => {
            console.error('[Auth] Redirect result error:', error)
          })

        const unsubscribe = onAuthStateChanged(auth, (user) => {
          console.log('[Auth] State changed:', user?.email || 'signed out')
          set({ user, isLoading: false, isInitialized: true })
        })
        return unsubscribe
      },

      signInWithGoogle: async () => {
        if (!isFirebaseConfigured()) {
          set({ error: 'Firebase가 설정되지 않았습니다' })
          return
        }
        set({ isLoading: true, error: null })
        const auth = getFirebaseAuth()
        const provider = new GoogleAuthProvider()

        try {
          // Try popup first (works on desktop browsers)
          await signInWithPopup(auth, provider)
          console.log('[Auth] Popup login successful')
        } catch (popupError) {
          const message = (popupError as Error).message || ''
          console.warn('[Auth] Popup failed, trying redirect:', message)

          // If popup blocked or failed, fall back to redirect
          if (
            message.includes('popup-blocked') ||
            message.includes('popup-closed-by-user') ||
            message.includes('cancelled-popup-request') ||
            message.includes('unauthorized-domain') ||
            message.includes('operation-not-allowed') ||
            message.includes('internal-error')
          ) {
            try {
              await signInWithRedirect(auth, provider)
              // Page will reload, getRedirectResult handles the rest
            } catch (redirectError) {
              set({ error: (redirectError as Error).message, isLoading: false })
            }
          } else if (!message.includes('popup-closed-by-user')) {
            set({ error: message, isLoading: false })
          } else {
            set({ isLoading: false })
          }
        }
      },

      logout: async () => {
        if (!isFirebaseConfigured()) return
        set({ isLoading: true, error: null })
        try {
          const auth = getFirebaseAuth()
          await signOut(auth)
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      clearError: () => set({ error: null }),
    }),
    { name: 'auth-store' },
  ),
)

// Selector hooks
export const useUser = () => useAuthStore((s) => s.user)
export const useIsAuthenticated = () => useAuthStore((s) => s.user !== null)
export const useAuthLoading = () => useAuthStore((s) => s.isLoading)
export const useAuthInitialized = () => useAuthStore((s) => s.isInitialized)
