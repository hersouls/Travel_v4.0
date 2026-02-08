// ============================================
// Elevation Profile Component (SVG-based)
// ============================================

import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, Loader2, Mountain } from 'lucide-react'

interface ElevationPoint {
  elevation: number
  distance: number
}

interface ElevationProfileProps {
  encodedPolyline: string
  className?: string
}

export function ElevationProfile({
  encodedPolyline,
  className = '',
}: ElevationProfileProps) {
  const [points, setPoints] = useState<ElevationPoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!encodedPolyline) return

    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch('/api/routes/elevation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ encodedPolyline, samples: 100 }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Elevation API error')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setPoints(data.elevations || [])
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [encodedPolyline])

  const stats = useMemo(() => {
    if (points.length < 2) return null
    let totalAscent = 0
    let totalDescent = 0
    let minElevation = Infinity
    let maxElevation = -Infinity

    for (let i = 0; i < points.length; i++) {
      const elev = points[i].elevation
      if (elev < minElevation) minElevation = elev
      if (elev > maxElevation) maxElevation = elev
      if (i > 0) {
        const diff = elev - points[i - 1].elevation
        if (diff > 0) totalAscent += diff
        else totalDescent += Math.abs(diff)
      }
    }

    return { totalAscent, totalDescent, minElevation, maxElevation }
  }, [points])

  const svgPath = useMemo(() => {
    if (points.length < 2 || !stats) return ''

    const width = 400
    const height = 120
    const padding = { top: 10, bottom: 10, left: 0, right: 0 }
    const chartW = width - padding.left - padding.right
    const chartH = height - padding.top - padding.bottom

    const maxDist = points[points.length - 1].distance || 1
    const elevRange = stats.maxElevation - stats.minElevation || 1

    const pathPoints = points.map((p, i) => {
      const x = padding.left + (p.distance / maxDist) * chartW
      const y =
        padding.top +
        chartH -
        ((p.elevation - stats.minElevation) / elevRange) * chartH
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })

    const linePath = pathPoints.join(' ')
    const lastX = padding.left + chartW
    const fillPath = `${linePath} L${lastX},${height - padding.bottom} L${padding.left},${height - padding.bottom} Z`

    return { linePath, fillPath }
  }, [points, stats])

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-6 ${className}`}>
        <Loader2 className="size-5 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (error || !stats || !svgPath) return null

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <Mountain className="size-4 text-zinc-500" />
        <span className="text-xs font-medium text-zinc-500">고도 프로파일</span>
      </div>

      {/* SVG Chart */}
      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-2 overflow-hidden">
        <svg
          viewBox="0 0 400 120"
          className="w-full h-auto"
          preserveAspectRatio="none"
        >
          {/* Fill area */}
          <path
            d={typeof svgPath === 'object' ? svgPath.fillPath : ''}
            fill="url(#elevation-gradient)"
            opacity="0.3"
          />
          {/* Line */}
          <path
            d={typeof svgPath === 'object' ? svgPath.linePath : ''}
            fill="none"
            stroke="var(--color-primary, #2effb4)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient
              id="elevation-gradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="var(--color-primary, #2effb4)" />
              <stop offset="100%" stopColor="var(--color-primary, #2effb4)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <TrendingUp className="size-3 text-green-500" />
          +{Math.round(stats.totalAscent)}m
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp className="size-3 text-red-500 rotate-180" />
          -{Math.round(stats.totalDescent)}m
        </span>
        <span>
          최저 {Math.round(stats.minElevation)}m / 최고{' '}
          {Math.round(stats.maxElevation)}m
        </span>
      </div>
    </div>
  )
}
