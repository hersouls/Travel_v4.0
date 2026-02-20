// ============================================
// Day Section Component
// Wraps DaySectionHeader + cards with accordion
// ============================================

import type { DaySummary } from '@/hooks/useTravelLogView'
import type { TravelLog } from '@/types'
import { clsx } from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback } from 'react'
import { CompactView } from './CompactView'
import { DaySectionHeader } from './DaySectionHeader'
import { GridView } from './GridView'
import { MovementIndicator } from './MovementIndicator'
import { TimelineCard } from './TimelineCard'

interface DaySectionProps {
  day: number
  date: Date
  logs: TravelLog[]
  allDayLogs: TravelLog[]
  expenses?: Record<string, number>
  isExpanded: boolean
  onToggleExpand: () => void
  summary?: DaySummary
  onEdit: (log: TravelLog) => void
  onDelete: (id: number) => void
  onPhotoClick: (photo: string) => void
  viewMode: 'timeline' | 'grid' | 'compact'
  distanceKm?: number
}

export function DaySection({
  day,
  date,
  logs,
  allDayLogs,
  expenses,
  isExpanded,
  onToggleExpand,
  summary,
  onEdit,
  onDelete,
  onPhotoClick,
  viewMode,
  distanceKm,
}: DaySectionProps) {
  const handleEdit = useCallback((log: TravelLog) => onEdit(log), [onEdit])
  const handleDelete = useCallback((id: number) => onDelete(id), [onDelete])

  // Show nothing if no logs at all for this day (including unfiltered)
  if (allDayLogs.length === 0) return null

  return (
    <div id={`log-day-${day}`} style={{ scrollMarginTop: '7rem' }}>
      <DaySectionHeader
        day={day}
        date={date}
        isExpanded={isExpanded}
        onToggle={onToggleExpand}
        summary={summary}
        expenses={expenses}
        distanceKm={distanceKm}
      />

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key={`day-${day}-content`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className={clsx(
                'border border-t-0 border-[var(--border)] rounded-b-xl',
                'bg-[var(--card)] px-3 py-3',
              )}
            >
              {/* Expanded header with expenses */}
              {expenses && (
                <div className="flex justify-end mb-3">
                  <div className="text-right">
                    {Object.entries(expenses).map(([currency, amount]) => {
                      const symbol =
                        currency === 'KRW'
                          ? '₩'
                          : currency === 'JPY'
                            ? '¥'
                            : currency === 'USD'
                              ? '$'
                              : currency
                      return (
                        <p
                          key={currency}
                          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
                        >
                          {['KRW', 'JPY', 'VND'].includes(currency)
                            ? `${symbol}${amount.toLocaleString()}`
                            : `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        </p>
                      )
                    })}
                  </div>
                </div>
              )}

              {logs.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-4">
                  필터 조건에 맞는 기록이 없습니다
                </p>
              ) : viewMode === 'grid' ? (
                <GridView
                  logs={logs}
                  onPhotoClick={onPhotoClick}
                  onEdit={onEdit}
                />
              ) : viewMode === 'compact' ? (
                <CompactView
                  logs={logs}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onPhotoClick={onPhotoClick}
                />
              ) : (
                <div>
                  {logs.map((log, idx) => (
                    <div key={log.id}>
                      {idx > 0 && (
                        <MovementIndicator fromLog={logs[idx - 1]} toLog={log} />
                      )}
                      <TimelineCard
                        log={log}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onPhotoClick={onPhotoClick}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
