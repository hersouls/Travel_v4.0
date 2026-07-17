// ============================================
// Unsaved Changes Warning Hook
// beforeunload + React Router useBlocker
// ============================================

import { useCallback, useEffect, useRef } from 'react'
import { useBlocker } from 'react-router-dom'

export function useUnsavedChanges(isDirty: boolean) {
  const blockerRef = useRef<{ proceed?: () => void; reset?: () => void }>({})
  // 저장/가져오기 성공 후 프로그램적 이탈 시 블로커를 1회 우회 (isDirty 커밋 타이밍과 무관)
  const skipRef = useRef(false)

  // Browser tab close / refresh warning
  useEffect(() => {
    if (!isDirty) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Safari/WebKit 및 일부 구형 Chromium은 returnValue가 설정되어야 확인 대화상자를 표시
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // React Router navigation blocking
  const blocker = useBlocker(
    useCallback(
      ({
        currentLocation,
        nextLocation,
      }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) => {
        if (skipRef.current) {
          skipRef.current = false
          return false
        }
        return isDirty && currentLocation.pathname !== nextLocation.pathname
      },
      [isDirty],
    ),
  )

  /** 다음 프로그램적 이탈 1회를 확인 없이 허용 (저장/가져오기 성공 직후 호출) */
  const allowNextNavigation = useCallback(() => {
    skipRef.current = true
  }, [])

  useEffect(() => {
    if (blocker.state === 'blocked') {
      blockerRef.current = {
        proceed: blocker.proceed,
        reset: blocker.reset,
      }

      const confirmed = window.confirm(
        '저장하지 않은 변경사항이 있습니다. 페이지를 떠나시겠습니까?',
      )
      if (confirmed) {
        blocker.proceed()
      } else {
        blocker.reset()
      }
    }
  }, [blocker])

  return { isBlocked: blocker.state === 'blocked', allowNextNavigation }
}
