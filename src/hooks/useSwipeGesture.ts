// ============================================
// Swipe Gesture Hook
// Left/Right swipe detection for navigation
// ============================================

import { useRef, useCallback } from 'react'

interface SwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
  preventScroll?: boolean
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  preventScroll = false,
}: SwipeOptions) {
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const isSwiping = useRef(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isSwiping.current = false
  }, [])

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!preventScroll) return
      const diffX = Math.abs(e.touches[0].clientX - touchStartX.current)
      const diffY = Math.abs(e.touches[0].clientY - touchStartY.current)
      if (diffX > diffY && diffX > 10) {
        isSwiping.current = true
      }
    },
    [preventScroll]
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX
      const touchEndY = e.changedTouches[0].clientY
      const diffX = touchEndX - touchStartX.current
      const diffY = Math.abs(touchEndY - touchStartY.current)

      // Only trigger if horizontal swipe is dominant
      if (Math.abs(diffX) > threshold && Math.abs(diffX) > diffY * 1.5) {
        if (diffX > 0 && onSwipeRight) {
          onSwipeRight()
        } else if (diffX < 0 && onSwipeLeft) {
          onSwipeLeft()
        }
      }
    },
    [onSwipeLeft, onSwipeRight, threshold]
  )

  return { onTouchStart, onTouchMove, onTouchEnd }
}
