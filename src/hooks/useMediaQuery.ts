// ============================================
// useMediaQuery / useBreakpoint Hooks
// CSS의 sm:/lg: 클래스로는 불가능한 "다른 컴포넌트 트리" 렌더 분기를 위한 JS 레벨 미디어 쿼리.
// 무거운 컴포넌트(지도/DnD 보드/가상 테이블)를 해당 뷰포트에서만 마운트하는 데 사용한다.
// index.css의 브레이크포인트 토큰과 px 값을 동기화 유지할 것.
// ============================================

import { useCallback, useSyncExternalStore } from 'react'

/**
 * SSR-safe matchMedia 구독 훅. 쿼리 매치 여부를 반응형으로 반환한다.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      // 구형 Safari(<16, iOS 15 등)는 MediaQueryList.addEventListener 미지원 → deprecated addListener fallback
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onChange)
        return () => mql.removeEventListener('change', onChange)
      }
      mql.addListener(onChange)
      return () => mql.removeListener(onChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  }, [query])

  // 서버 스냅샷은 false (모바일 우선 기본값)
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

// index.css 브레이크포인트 토큰과 동기화된 파생 훅
// Mobile <768 / Tablet 768~1023 / Desktop 1024~1535 / Wide 1536+
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')
export const useIsTablet = () => useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
export const useIsWide = () => useMediaQuery('(min-width: 1536px)')
/** 큰 폰(iPhone 16 Pro Max·Galaxy S24 Ultra 등) — 한손 모드/큰 타깃 분기용 */
export const useIsLargePhone = () => useMediaQuery('(min-width: 430px) and (max-width: 767px)')
/** 터치 기반 포인터(손가락) — hover 불가 기기 분기용 */
export const useIsTouch = () => useMediaQuery('(pointer: coarse)')
/** 모션 최소화 선호 */
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
