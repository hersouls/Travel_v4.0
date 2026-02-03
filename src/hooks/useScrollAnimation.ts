// ============================================
// Scroll Animation Hook with Intersection Observer
// ============================================

import { useEffect, useRef, useState, useMemo } from 'react'

type AnimationType = 'fade-up' | 'fade-in' | 'fade-down' | 'slide-left' | 'slide-right' | 'scale' | 'none'

interface UseScrollAnimationOptions {
  threshold?: number
  rootMargin?: string
  delay?: number
  once?: boolean
}

interface AnimationStyles {
  initial: string
  animated: string
}

const animationPresets: Record<AnimationType, AnimationStyles> = {
  'fade-up': {
    initial: 'opacity-0 translate-y-6',
    animated: 'opacity-100 translate-y-0',
  },
  'fade-in': {
    initial: 'opacity-0',
    animated: 'opacity-100',
  },
  'fade-down': {
    initial: 'opacity-0 -translate-y-6',
    animated: 'opacity-100 translate-y-0',
  },
  'slide-left': {
    initial: 'opacity-0 translate-x-6',
    animated: 'opacity-100 translate-x-0',
  },
  'slide-right': {
    initial: 'opacity-0 -translate-x-6',
    animated: 'opacity-100 translate-x-0',
  },
  'scale': {
    initial: 'opacity-0 scale-95',
    animated: 'opacity-100 scale-100',
  },
  'none': {
    initial: '',
    animated: '',
  },
}

/**
 * Hook for scroll-based animations using Intersection Observer
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { ref, className, isVisible } = useScrollAnimation('fade-up')
 *   return <div ref={ref} className={className}>Content</div>
 * }
 * ```
 */
export function useScrollAnimation<T extends HTMLElement = HTMLDivElement>(
  animation: AnimationType = 'fade-up',
  options: UseScrollAnimationOptions = {}
) {
  const { threshold = 0.1, rootMargin = '0px', delay = 0, once = true } = options

  const ref = useRef<T>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // Skip if already animated and once is true
    if (once && hasAnimated) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            setTimeout(() => {
              setIsVisible(true)
              setHasAnimated(true)
            }, delay)
          } else {
            setIsVisible(true)
            setHasAnimated(true)
          }

          if (once) {
            observer.disconnect()
          }
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [threshold, rootMargin, delay, once, hasAnimated])

  const preset = animationPresets[animation]

  const className = useMemo(() => {
    const base = 'transition-all duration-500 ease-out'
    const state = isVisible ? preset.animated : preset.initial
    return `${base} ${state}`
  }, [isVisible, preset])

  return { ref, className, isVisible }
}

/**
 * Hook for staggered scroll animations (for lists)
 *
 * @example
 * ```tsx
 * function MyList({ items }) {
 *   const { getItemProps } = useStaggeredAnimation(items.length)
 *   return items.map((item, i) => (
 *     <div key={i} {...getItemProps(i)}>...</div>
 *   ))
 * }
 * ```
 */
export function useStaggeredAnimation(
  itemCount: number,
  options: UseScrollAnimationOptions & { staggerDelay?: number } = {}
) {
  const { staggerDelay = 100, ...animationOptions } = options
  const containerRef = useRef<HTMLDivElement>(null)
  const [isContainerVisible, setIsContainerVisible] = useState(false)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsContainerVisible(true)
          observer.disconnect()
        }
      },
      { threshold: animationOptions.threshold ?? 0.1, rootMargin: animationOptions.rootMargin ?? '0px' }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [animationOptions.threshold, animationOptions.rootMargin])

  const getItemProps = (index: number) => ({
    style: {
      transitionDelay: isContainerVisible ? `${index * staggerDelay}ms` : '0ms',
    },
    className: `transition-all duration-500 ease-out ${
      isContainerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
    }`,
  })

  return { containerRef, isContainerVisible, getItemProps }
}

/**
 * Simple visibility hook without animation classes
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: { threshold?: number; rootMargin?: string; once?: boolean } = {}
) {
  const { threshold = 0.1, rootMargin = '0px', once = true } = options
  const ref = useRef<T>(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setIsInView(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [threshold, rootMargin, once])

  return { ref, isInView }
}
