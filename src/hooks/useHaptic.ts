// ============================================
// useHaptic Hook
// 터치 기기에서 navigator.vibrate 기반 햅틱 피드백. PWA를 네이티브 앱처럼 느끼게 한다.
// 가드: 터치 포인터(pointer:coarse) + 모션 최소화 비선호 + vibrate 지원(주로 Android Chrome).
// iOS Safari는 vibrate 미지원 → 자동 no-op.
// 롱프레스/스와이프 임계/DnD drop/풀투리프레시/내비 도착 등에 연결한다.
// ============================================

import { useCallback } from 'react'

export type HapticPattern = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning'

const PATTERNS: Record<HapticPattern, number | number[]> = {
  selection: 8,
  light: 10,
  medium: 20,
  heavy: 35,
  success: [10, 30, 10],
  warning: [20, 60, 20],
}

function canVibrate(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  if (typeof window === 'undefined' || !window.matchMedia) return false
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return coarse && !reduced
}

/**
 * 햅틱 트리거 함수를 반환. 미지원/비터치/모션최소화 시 조용히 무시된다.
 * @example const haptic = useHaptic(); haptic('success')
 */
export function useHaptic() {
  return useCallback((pattern: HapticPattern = 'light') => {
    if (!canVibrate()) return
    try {
      navigator.vibrate(PATTERNS[pattern])
    } catch {
      // 미지원 환경 no-op
    }
  }, [])
}
