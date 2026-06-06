// ============================================
// RingProgress Component
// 목표 달성률 원형 게이지 (D-day·여행 진행도 등)
// Health_v1.0 이식 — animateOnMount 시 빈 링→목표 드로우 인트로
// ============================================

import { useEffect, useRef, useState } from 'react'

interface RingProgressProps {
  value: number
  max: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  /** 마운트 시 빈 링→목표 드로우 인트로 (옵트인) */
  animateOnMount?: boolean
  children?: React.ReactNode
}

export function RingProgress({
  value,
  max,
  size = 120,
  strokeWidth = 12,
  color = 'var(--color-primary-500)',
  trackColor = 'var(--muted)',
  animateOnMount = false,
  children,
}: RingProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const targetOffset = circumference * (1 - ratio)

  /* animateOnMount 일 때만 마운트 1회 빈 링→목표 드로우 (reduce-motion 은 즉시 표시).
     이후 값 변화·기본 동작은 즉시 반영 (CSS transition 이 전이를 부드럽게 처리) */
  const didIntro = useRef(false)
  const [offset, setOffset] = useState(animateOnMount ? circumference : targetOffset)
  useEffect(() => {
    if (!animateOnMount || didIntro.current) {
      setOffset(targetOffset)
      return
    }
    didIntro.current = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOffset(targetOffset)
      return
    }
    let inner = 0
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setOffset(targetOffset))
    })
    return () => {
      cancelAnimationFrame(outer)
      cancelAnimationFrame(inner)
    }
  }, [targetOffset, animateOnMount])

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: `stroke-dashoffset ${animateOnMount ? 900 : 700}ms cubic-bezier(0.22,1,0.36,1)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  )
}
