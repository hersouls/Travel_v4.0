// ============================================
// Auth Store (Zustand)
// Firebase Google Authentication
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
          console.warn('[Auth] Firebase not configured')
          set({ isInitialized: true })
          return () => {}
        }

        set({ isLoading: true })
        const auth = getFirebaseAuth()

        // Check for redirect result (from signInWithRedirect fallback)
        getRedirectResult(auth).catch((error) => {
          if (error) {
            console.error('[Auth] Redirect result error:', error)
            set({ error: (error as Error).message })
          }
        })

        const unsubscribe = onAuthStateChanged(auth, (user) => {
          console.log('[Auth] State changed:', user?.email || 'signed out')
          set({ user, isLoading: false, isInitialized: true })
        })
        return unsubscribe
      },

      signInWithGoogle: async () => {
        if (!isFirebaseConfigured()) {
          const msg = 'Firebase가 설정되지 않았습니다'
          set({ error: msg, isLoading: false })
          throw new Error(msg)
        }
        set({ isLoading: true, error: null })
        const auth = getFirebaseAuth()
        const provider = new GoogleAuthProvider()

        try {
          await signInWithPopup(auth, provider)
          console.log('[Auth] Login successful')
        } catch (error: unknown) {
          const firebaseError = error as { code?: string; message?: string }
          const code = firebaseError.code || ''
          const message = firebaseError.message || 'Unknown error'
          console.error('[Auth] Login failed:', code, message)

          // popup-closed-by-user is a user action, not an error
          if (code === 'auth/popup-closed-by-user' || message.includes('popup-closed-by-user')) {
            set({ isLoading: false })
            return
          }

          // Popup blocked → redirect fallback
          if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
            console.log('[Auth] Popup blocked, falling back to redirect')
            await signInWithRedirect(auth, provider)
            return
          }

          set({ error: message, isLoading: false })
          throw error
        }
      },

      logout: async () => {
        if (!isFirebaseConfigured()) return
        set({ isLoading: true, error: null })
        try {
          const auth = getFirebaseAuth()
          await signOut(auth)
          // onAuthStateChanged will set isLoading: false and user: null
        } catch (error) {
          set({ error: (error as Error).message, isLoading: false })
          throw error
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
