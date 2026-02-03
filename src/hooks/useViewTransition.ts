// ============================================
// View Transitions API Hook
// ============================================

import { useCallback } from 'react'
import { useNavigate, type NavigateOptions } from 'react-router-dom'

interface UseViewTransitionReturn {
  transitionTo: (to: string, options?: NavigateOptions) => void
  isSupported: boolean
}

/**
 * Custom hook for View Transitions API
 * Provides smooth page transitions in supported browsers (Chrome 111+)
 * Falls back to regular navigation in unsupported browsers
 */
export function useViewTransition(): UseViewTransitionReturn {
  const navigate = useNavigate()
  const isSupported =
    typeof document !== 'undefined' &&
    typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === 'function'

  const transitionTo = useCallback(
    (to: string, options?: NavigateOptions) => {
      const doc = document as Document & { startViewTransition?: (cb: () => void) => void }

      // Check if View Transitions API is supported
      if (doc.startViewTransition) {
        doc.startViewTransition(() => {
          navigate(to, options)
        })
      } else {
        // Fallback for unsupported browsers
        navigate(to, options)
      }
    },
    [navigate]
  )

  return { transitionTo, isSupported }
}

/**
 * Utility to wrap any state update with View Transition
 */
export function withViewTransition(callback: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => void }

  if (doc.startViewTransition) {
    doc.startViewTransition(callback)
  } else {
    callback()
  }
}
