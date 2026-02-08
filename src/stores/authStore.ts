// ============================================
// Auth Store (Zustand)
// Firebase Google Authentication
// ============================================

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  GoogleAuthProvider,
  signInWithPopup,
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
        const unsubscribe = onAuthStateChanged(auth, (user) => {
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
        try {
          const auth = getFirebaseAuth()
          const provider = new GoogleAuthProvider()
          await signInWithPopup(auth, provider)
        } catch (error) {
          const message = (error as Error).message
          if (!message.includes('popup-closed-by-user')) {
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
