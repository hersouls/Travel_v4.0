// ============================================
// Trip Statistics Dashboard
// ============================================

import { useMemo } from 'react'
import { MapPin, Clock, Route as RouteIcon, Car, Footprints, Bus, Bike } from 'lucide-react'
import type { Plan, RouteSegment, TravelMode } from '@/types'
import { PLAN_TYPE_LABELS, TRAVEL_MODE_LABELS } from '@/utils/constants'

interface TripStatisticsProps {
  plans: Plan[]
  routeSegments: RouteSegment[]
  className?: string
}

const MODE_ICONS: Record<TravelMode, typeof Car> = {
  DRIVE: Car,
  WALK: Footprints,
  TRANSIT: Bus,
  BICYCLE: Bike,
}

const MODE_COLORS: Record<TravelMode, string> = {
  DRIVE: 'text-blue-500',
  WALK: 'text-green-500',
  TRANSIT: 'text-orange-500',
  BICYCLE: 'text-purple-500',
}

export function TripStatistics({
  plans,
  routeSegments,
  className = '',
}: TripStatisticsProps) {
  const stats = useMemo(() => {
    // Total distance & time
    let totalDistance = 0
    let totalDuration = 0
    const modeBreakdown: Record<string, { distance: number; duration: number; count: number }> = {}

    for (const seg of routeSegments) {
      totalDistance += seg.distanceMeters
      const seconds = parseInt(seg.duration?.replace('s', '') || '0', 10)
      totalDuration += seconds

      if (!modeBreakdown[seg.travelMode]) {
        modeBreakdown[seg.travelMode] = { distance: 0, duration: 0, count: 0 }
      }
      modeBreakdown[seg.travelMode].distance += seg.distanceMeters
      modeBreakdown[seg.travelMode].duration += seconds
      modeBreakdown[seg.travelMode].count += 1
    }

    // Type breakdown
    const typeBreakdown: Record<string, number> = {}
    for (const plan of plans) {
      typeBreakdown[plan.type] = (typeBreakdown[plan.type] || 0) + 1
    }

    return {
      totalDistance,
      totalDuration,
      modeBreakdown,
      typeBreakdown,
      segmentCount: routeSegments.length,
      planCount: plans.length,
    }
  }, [plans, routeSegments])

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.round((seconds % 3600) / 60)
    if (hours > 0) return `${hours}시간 ${mins}분`
    return `${mins}분`
  }

  const formatDistance = (meters: number) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
    return `${meters} m`
  }

  if (routeSegments.length === 0) return null

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        여행 통계
      </h3>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-center">
          <RouteIcon className="size-4 text-blue-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
            {formatDistance(stats.totalDistance)}
          </p>
          <p className="text-xs text-blue-500">총 이동거리</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-center">
          <Clock className="size-4 text-amber-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
            {formatDuration(stats.totalDuration)}
          </p>
          <p className="text-xs text-amber-500">총 이동시간</p>
        </div>
        <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-center">
          <MapPin className="size-4 text-violet-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-violet-700 dark:text-violet-300">
            {stats.planCount}
          </p>
          <p className="text-xs text-violet-500">전체 일정</p>
        </div>
      </div>

      {/* Mode Breakdown */}
      {Object.keys(stats.modeBreakdown).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-500">교통수단별</p>
          {Object.entries(stats.modeBreakdown).map(([mode, data]) => {
            const Icon = MODE_ICONS[mode as TravelMode] || Car
            const pct = stats.totalDistance > 0
              ? Math.round((data.distance / stats.totalDistance) * 100)
              : 0
            return (
              <div key={mode} className="flex items-center gap-2">
                <Icon className={`size-4 ${MODE_COLORS[mode as TravelMode] || 'text-zinc-400'}`} />
                <span className="text-xs text-zinc-600 dark:text-zinc-400 w-16">
                  {TRAVEL_MODE_LABELS[mode as TravelMode] || mode}
                </span>
                <div className="flex-1 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 w-8 text-right">{pct}%</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Type Breakdown */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-500">장소 유형별</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(stats.typeBreakdown)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <span
                key={type}
                className="px-2 py-1 text-xs rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
              >
                {PLAN_TYPE_LABELS[type as keyof typeof PLAN_TYPE_LABELS] || type} {count}
              </span>
            ))}
        </div>
      </div>
    </div>
  )
}
