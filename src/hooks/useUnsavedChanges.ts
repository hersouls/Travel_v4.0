// ============================================
// Unsaved Changes Warning Hook
// beforeunload + React Router useBlocker
// ============================================

import { useEffect, useCallback, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

export function useUnsavedChanges(isDirty: boolean) {
  const blockerRef = useRef<{ proceed?: () => void; reset?: () => void }>({})

  // Browser tab close / refresh warning
  useEffect(() => {
    if (!isDirty) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // React Router navigation blocking
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) => {
        return isDirty && currentLocation.pathname !== nextLocation.pathname
      },
      [isDirty]
    )
  )

  useEffect(() => {
    if (blocker.state === 'blocked') {
      blockerRef.current = {
        proceed: blocker.proceed,
        reset: blocker.reset,
      }

      const confirmed = window.confirm('저장하지 않은 변경사항이 있습니다. 페이지를 떠나시겠습니까?')
      if (confirmed) {
        blocker.proceed()
      } else {
        blocker.reset()
      }
    }
  }, [blocker])

  return { isBlocked: blocker.state === 'blocked' }
}
