// ============================================
// Local Time Comparison Component
// 여행지 현지 시간과 사용자 시간대 비교 표시
// ============================================

import { Globe, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import {
  getSystemTimezone,
  getTimezoneDifference,
  getCurrentTimeDisplay
} from '@/utils/timezone'

interface LocalTimeComparisonProps {
  tripTimezone: string
}

export function LocalTimeComparison({ tripTimezone }: LocalTimeComparisonProps) {
  const systemTimezone = getSystemTimezone()

  // 같은 시간대면 현지 표시
  if (systemTimezone === tripTimezone) {
    return (
      <Badge color="success" size="sm" className="inline-flex items-center gap-1">
        <MapPin className="size-3" />
        현지에 있습니다
      </Badge>
    )
  }

  const tripTime = getCurrentTimeDisplay(tripTimezone, 'HH:mm')
  const timeDiff = getTimezoneDifference(systemTimezone, tripTimezone)

  return (
    <div className="flex items-center gap-2 text-sm">
      <Globe className="size-4 text-primary-500" />
      <span className="text-zinc-600 dark:text-zinc-400">현지 시간:</span>
      <span className="font-medium text-[var(--foreground)]">{tripTime}</span>
      <span className="text-zinc-400">({timeDiff})</span>
    </div>
  )
}
