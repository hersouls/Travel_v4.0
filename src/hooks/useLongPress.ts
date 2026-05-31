// ============================================
// Long Press Hook
// Detects long-press gesture for context menus
// ============================================

import { useRef, useCallback, useEffect } from 'react'
import { useHaptic } from './useHaptic'

interface LongPressOptions {
  onLongPress: () => void
  delay?: number
}

export function useLongPress({ onLongPress, delay = 500 }: LongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPress = useRef(false)
  const haptic = useHaptic()

  const start = useCallback(() => {
    isLongPress.current = false
    timerRef.current = setTimeout(() => {
      isLongPress.current = true
      haptic('medium') // 롱프레스 발동 햅틱
      onLongPress()
    }, delay)
  }, [onLongPress, delay, haptic])

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // 언마운트 시 진행 중인 타이머를 정리하여 언마운트 후 onLongPress 발화 방지
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  const handlers = {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
  }

  return { handlers, isLongPress }
}
