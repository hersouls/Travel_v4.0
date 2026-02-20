// ============================================
// Day Minimap / Scroll Indicator
// Vertical dot strip for quick day navigation
// ============================================

import type { TravelLog } from '@/types'
import { clsx } from 'clsx'
import { useState } from 'react'

interface DayMinimapProps {
  days: number[]
  currentDay: number
  logsByDay: Record<number, TravelLog[]>
  onDayClick: (day: number) => void
}

export function DayMinimap({ days, currentDay, logsByDay, onDayClick }: DayMinimapProps) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)

  if (days.length <= 1) return null

  return (
    <div className="hidden lg:flex fixed right-2 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-1.5">
      {days.map((day) => {
        const hasLogs = (logsByDay[day]?.length || 0) > 0
        const isCurrent = day === currentDay
        const count = logsByDay[day]?.length || 0

        return (
          <div key={day} className="relative">
            <button
              type="button"
              onClick={() => onDayClick(day)}
              onMouseEnter={() => setHoveredDay(day)}
              onMouseLeave={() => setHoveredDay(null)}
              className={clsx(
                'rounded-full transition-all duration-150',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
                isCurrent
                  ? 'size-3 bg-primary-500 shadow-sm'
                  : hasLogs
                    ? 'size-2 bg-zinc-400 dark:bg-zinc-500 hover:bg-primary-400 dark:hover:bg-primary-400'
                    : 'size-2 border border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500',
              )}
              aria-label={`Day ${day}`}
            />

            {/* Tooltip */}
            {hoveredDay === day && (
              <div className="absolute right-5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md bg-[var(--popover)] text-[var(--popover-foreground)] text-xs font-medium whitespace-nowrap shadow-lg border border-[var(--border)]">
                Day {day}
                {count > 0 && <span className="text-zinc-400 ml-1">({count}개)</span>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
