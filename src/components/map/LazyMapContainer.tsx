// ============================================
// Lazy Map Container with Intersection Observer
// ============================================

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { MapPin } from 'lucide-react'

interface LazyMapContainerProps {
  children: ReactNode
  className?: string
  fallback?: ReactNode
  rootMargin?: string
  threshold?: number
}

/**
 * Lazy loads map content when it enters the viewport
 * Uses Intersection Observer for efficient detection
 */
export function LazyMapContainer({
  children,
  className = '',
  fallback,
  rootMargin = '100px',
  threshold = 0.1,
}: LazyMapContainerProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          // Once loaded, always keep it loaded
          setHasLoaded(true)
          observer.disconnect()
        }
      },
      {
        rootMargin,
        threshold,
      }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [rootMargin, threshold])

  // Custom fallback or default skeleton
  const defaultFallback = (
    <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-lg">
      <MapPin className="size-10 text-zinc-300 dark:text-zinc-600 mb-3 animate-pulse" />
      <Skeleton width={120} height={16} className="mb-2" />
      <Skeleton width={80} height={12} />
    </div>
  )

  return (
    <div ref={containerRef} className={className}>
      {isVisible || hasLoaded ? children : (fallback || defaultFallback)}
    </div>
  )
}

/**
 * Hook for lazy loading with Intersection Observer
 */
export function useLazyLoad(
  options: { rootMargin?: string; threshold?: number } = {}
) {
  const { rootMargin = '100px', threshold = 0.1 } = options
  const ref = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin, threshold }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [rootMargin, threshold])

  return { ref, isVisible }
}
