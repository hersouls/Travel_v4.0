// ============================================
// Route Info Panel (Compact Inline)
// ============================================
// Displays travel info between two plan cards
// with a dashed connecting line design.

import { clsx } from 'clsx'
import { Car, Footprints, Bus, Bike } from 'lucide-react'
import type { TravelMode } from '@/types'
import { TRAVEL_MODE_LABELS, TRAVEL_MODE_ICONS } from '@/utils/constants'

interface RouteInfoPanelProps {
  distanceText: string
  durationText: string
  travelMode: TravelMode
  className?: string
}

const ICON_MAP = {
  Car,
  Footprints,
  Bus,
  Bike,
} as const

type IconName = keyof typeof ICON_MAP

export function RouteInfoPanel({
  distanceText,
  durationText,
  travelMode,
  className,
}: RouteInfoPanelProps) {
  const iconName = TRAVEL_MODE_ICONS[travelMode] as IconName
  const Icon = ICON_MAP[iconName]
  const label = TRAVEL_MODE_LABELS[travelMode]

  return (
    <div
      className={clsx(
        'relative flex items-center py-1.5 pl-6',
        className
      )}
    >
      {/* Dashed vertical connecting line */}
      <div
        className="absolute left-3 top-0 bottom-0 w-px border-l-2 border-dashed border-zinc-300 dark:border-zinc-600"
        aria-hidden="true"
      />

      {/* Route info content */}
      <div className="flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1">
        {Icon && (
          <Icon className="size-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
        )}
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {label}
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {durationText}
        </span>
        <span
          className="text-xs text-zinc-400 dark:text-zinc-500"
          aria-hidden="true"
        >
          &middot;
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {distanceText}
        </span>
      </div>
    </div>
  )
}
