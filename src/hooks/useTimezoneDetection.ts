// ============================================
// Timezone Detection Hook
// 시스템 시간대 변경 감지 및 알림
// ============================================

import { useState, useEffect, useCallback } from 'react'
import { getSystemTimezone } from '@/utils/timezone'

const STORAGE_KEY = 'user-detected-timezone'

export interface TimezoneInfo {
  currentTimezone: string
  previousTimezone: string | null
  hasChanged: boolean
  updateTimezone: () => void
  dismissChange: () => void
}

/**
 * 시스템 시간대 변경을 감지하고 관리하는 훅
 * - 탭 전환, 포커스 복귀 시 시간대 재확인
 * - 변경 감지 시 hasChanged를 true로 설정
 * - localStorage에 마지막 확인된 시간대 저장
 */
export function useTimezoneDetection(): TimezoneInfo {
  const [currentTimezone, setCurrentTimezone] = useState(getSystemTimezone)
  const [previousTimezone, setPreviousTimezone] = useState<string | null>(null)
  const [hasChanged, setHasChanged] = useState(false)

  const checkTimezone = useCallback(() => {
    const newTimezone = getSystemTimezone()
    setCurrentTimezone(newTimezone)

    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored !== newTimezone) {
      // 시간대가 변경됨
      setPreviousTimezone(stored)
      setHasChanged(true)
    } else if (!stored) {
      // 첫 방문: 현재 시간대 저장
      localStorage.setItem(STORAGE_KEY, newTimezone)
    }
  }, [])

  useEffect(() => {
    // 초기 시간대 확인
    checkTimezone()

    // 탭 활성화 시 재확인
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkTimezone()
      }
    }

    // 포커스 복귀 시 재확인
    const handleFocus = () => checkTimezone()

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [checkTimezone])

  // 사용자가 시간대 변경을 확인한 경우
  const updateTimezone = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, currentTimezone)
    setPreviousTimezone(null)
    setHasChanged(false)
  }, [currentTimezone])

  // 사용자가 알림을 무시한 경우
  const dismissChange = useCallback(() => {
    setHasChanged(false)
  }, [])

  return {
    currentTimezone,
    previousTimezone,
    hasChanged,
    updateTimezone,
    dismissChange,
  }
}
