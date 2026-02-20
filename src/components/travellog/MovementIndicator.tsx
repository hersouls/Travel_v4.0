// ============================================
// Movement Indicator Component
// Shows distance and estimated time between
// two consecutive travel log entries
// ============================================

import { ArrowDown } from 'lucide-react'
import type { TravelLog } from '@/types'
import { haversineDistance, formatDistance, estimateTravelTime } from '@/utils/distanceCalculation'

interface MovementIndicatorProps {
  fromLog: TravelLog
  toLog: TravelLog
}

export function MovementIndicator({ fromLog, toLog }: MovementIndicatorProps) {
  if (
    !fromLog.latitude || !fromLog.longitude ||
    !toLog.latitude || !toLog.longitude
  ) {
    return null
  }

  const meters = haversineDistance(
    fromLog.latitude,
    fromLog.longitude,
    toLog.latitude,
    toLog.longitude,
  )

  // Skip very short distances (likely same location)
  if (meters < 30) return null

  const distance = formatDistance(meters)
  const { walkMinutes, driveMinutes } = estimateTravelTime(meters)

  // Show walk time for short distances, drive time for longer
  const timeStr = meters < 2000
    ? `도보 ${walkMinutes}분`
    : `차량 ${driveMinutes}분`

  return (
    <div className="flex items-center gap-2 py-1 pl-4">
      <ArrowDown className="size-3 text-zinc-300 dark:text-zinc-600" />
      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
        {distance} · {timeStr}
      </span>
    </div>
  )
}
