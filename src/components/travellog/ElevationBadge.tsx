// ============================================
// Elevation Badge Component
// Shows elevation (meters above sea level)
// ============================================

import { Mountain } from 'lucide-react'
import { useElevation } from '@/hooks/useElevation'

interface ElevationBadgeProps {
  latitude: number
  longitude: number
}

export function ElevationBadge({ latitude, longitude }: ElevationBadgeProps) {
  const { elevation, isLoading } = useElevation(latitude, longitude)

  if (isLoading || elevation == null) return null

  return (
    <span className="inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
      <Mountain className="size-3" />
      {elevation.toLocaleString()}m
    </span>
  )
}
