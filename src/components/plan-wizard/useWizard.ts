// ============================================
// useWizard — 단계 index·전환 방향·이동 관리
// ============================================

import { useCallback, useRef, useState } from 'react'

export interface WizardNav {
  index: number
  /** 전환 방향: 1=전진, -1=후진 (framer-motion 슬라이드 방향에 사용) */
  direction: 1 | -1
  isFirst: boolean
  isLast: boolean
  goTo: (target: number) => void
  goNext: () => void
  goPrev: () => void
}

export function useWizard(initialIndex: number, count: number): WizardNav {
  const [index, setIndex] = useState(initialIndex)
  const [direction, setDirection] = useState<1 | -1>(1)
  const indexRef = useRef(index)
  indexRef.current = index

  const goTo = useCallback(
    (target: number) => {
      const clamped = Math.max(0, Math.min(count - 1, target))
      if (clamped === indexRef.current) return
      setDirection(clamped > indexRef.current ? 1 : -1)
      setIndex(clamped)
    },
    [count],
  )

  const goNext = useCallback(() => goTo(indexRef.current + 1), [goTo])
  const goPrev = useCallback(() => goTo(indexRef.current - 1), [goTo])

  return {
    index,
    direction,
    isFirst: index === 0,
    isLast: index === count - 1,
    goTo,
    goNext,
    goPrev,
  }
}
