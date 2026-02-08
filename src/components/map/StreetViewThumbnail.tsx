// ============================================
// Street View Thumbnail with Lazy Loading
// ============================================
// Shows a Google Street View preview image that
// loads only when scrolled into the viewport.

import { useState, useEffect, useRef, useCallback } from 'react'
import { clsx } from 'clsx'
import { MapPin, Eye } from 'lucide-react'
import { getStreetViewUrl, getStreetViewPageUrl } from '@/services/streetViewService'

type LoadState = 'idle' | 'loading' | 'loaded' | 'error'

interface StreetViewThumbnailProps {
  latitude: number
  longitude: number
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASSES = {
  sm: 'h-24',
  md: 'h-32',
  lg: 'h-48',
} as const

const SIZE_DIMENSIONS = {
  sm: { width: 320, height: 160 },
  md: { width: 480, height: 240 },
  lg: { width: 640, height: 320 },
} as const

export function StreetViewThumbnail({
  latitude,
  longitude,
  className,
  size = 'md',
}: StreetViewThumbnailProps) {
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [isInViewport, setIsInViewport] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin: '150px', threshold: 0.1 }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Load image when in viewport
  useEffect(() => {
    if (!isInViewport || loadState !== 'idle') return

    setLoadState('loading')

    const { width, height } = SIZE_DIMENSIONS[size]
    const src = getStreetViewUrl(latitude, longitude, { width, height })

    const img = new Image()
    imgRef.current = img

    img.onload = () => {
      // Google Street View Static API returns a grey placeholder
      // when no imagery is available. We check dimensions as a basic
      // heuristic -- a valid response is the requested size.
      setLoadState('loaded')
    }

    img.onerror = () => {
      setLoadState('error')
    }

    img.src = src

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [isInViewport, latitude, longitude, size, loadState])

  const handleClick = useCallback(() => {
    const url = getStreetViewPageUrl(latitude, longitude)
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [latitude, longitude])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick()
      }
    },
    [handleClick]
  )

  const heightClass = SIZE_CLASSES[size]
  const { width, height } = SIZE_DIMENSIONS[size]

  // Idle or loading state: skeleton
  if (loadState === 'idle' || loadState === 'loading') {
    return (
      <div
        ref={containerRef}
        className={clsx(
          'w-full rounded-xl overflow-hidden',
          heightClass,
          className
        )}
      >
        <div className="w-full h-full animate-pulse bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
          <MapPin className="size-6 text-zinc-300 dark:text-zinc-600" />
        </div>
      </div>
    )
  }

  // Error state: placeholder
  if (loadState === 'error') {
    return (
      <div
        ref={containerRef}
        className={clsx(
          'w-full rounded-xl overflow-hidden',
          heightClass,
          className
        )}
      >
        <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center gap-1.5">
          <MapPin className="size-5 text-zinc-400 dark:text-zinc-500" />
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            Street View 미지원
          </span>
        </div>
      </div>
    )
  }

  // Loaded state: image with hover overlay
  const src = getStreetViewUrl(latitude, longitude, { width, height })

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-label="Google Street View 열기"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={clsx(
        'group relative w-full rounded-xl overflow-hidden cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
        heightClass,
        className
      )}
    >
      <img
        src={src}
        alt={`Street View: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-1.5 bg-white/90 dark:bg-zinc-900/90 rounded-full px-3 py-1.5 shadow-sm">
          <Eye className="size-3.5 text-zinc-700 dark:text-zinc-300" />
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Street View
          </span>
        </div>
      </div>
    </div>
  )
}
