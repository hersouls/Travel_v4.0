// ============================================
// Pull to Refresh Hook
// ============================================

import { useState, useRef, useEffect } from 'react'

interface PullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number
  maxPull?: number
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
}: PullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const isPulling = useRef(false)
  const mountedRef = useRef(true)

  // ref를 사용하여 stale closure 방지
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh
  const isRefreshingRef = useRef(isRefreshing)
  isRefreshingRef.current = isRefreshing
  const pullDistanceRef = useRef(pullDistance)
  pullDistanceRef.current = pullDistance

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) {
        touchStartY.current = e.touches[0].clientY
        isPulling.current = true
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isPulling.current || isRefreshingRef.current) return
      const diff = e.touches[0].clientY - touchStartY.current
      if (diff > 0 && window.scrollY <= 0) {
        const distance = Math.min(diff * 0.5, maxPull)
        setPullDistance(distance)
      }
    }

    const onTouchEnd = async () => {
      if (!isPulling.current) return
      isPulling.current = false

      if (pullDistanceRef.current >= threshold && !isRefreshingRef.current) {
        setIsRefreshing(true)
        setPullDistance(threshold * 0.5)
        try {
          await onRefreshRef.current()
        } finally {
          if (mountedRef.current) {
            setIsRefreshing(false)
            setPullDistance(0)
          }
        }
      } else {
        if (mountedRef.current) setPullDistance(0)
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd)

    return () => {
      mountedRef.current = false
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [threshold, maxPull]) // 안정적인 값만 의존성에 포함

  return { pullDistance, isRefreshing, isActive: pullDistance > 0 }
}
