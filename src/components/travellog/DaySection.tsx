// ============================================
// Day Section Component
// Wraps DaySectionHeader + cards with accordion
// ============================================

import type { DayCategoryExpenses, DaySummary } from '@/hooks/useTravelLogView'
import { convertToKRW } from '@/services/exchangeRateService'
import type { TravelLog } from '@/types'
import type { ExpenseCategory } from '@/types'
import { EXPENSE_CATEGORY_LABELS } from '@/utils/constants'
import { clsx } from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { Utensils, Bus, Bed, ShoppingBag, Camera, MoreHorizontal } from 'lucide-react'
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
  categoryExpenses?: DayCategoryExpenses
  isExpanded: boolean
  onToggleExpand: () => void
  summary?: DaySummary
  onEdit: (log: TravelLog) => void
  onDelete: (id: number) => void
  onPhotoClick: (photo: string) => void
  viewMode: 'timeline' | 'grid' | 'compact'
  distanceKm?: number
  exchangeRates?: Record<string, number> | null
  showKRW?: boolean
}

const categoryIcons: Record<ExpenseCategory, typeof Utensils> = {
  food: Utensils, transport: Bus, accommodation: Bed,
  shopping: ShoppingBag, attraction: Camera, other: MoreHorizontal,
}

const categoryColors: Record<ExpenseCategory, string> = {
  food: 'text-warning-600 dark:text-warning-400',
  transport: 'text-primary-600 dark:text-primary-400',
  accommodation: 'text-purple-600 dark:text-purple-400',
  shopping: 'text-pink-600 dark:text-pink-400',
  attraction: 'text-cyan-600 dark:text-cyan-400',
  other: 'text-zinc-500 dark:text-zinc-400',
}

function formatCurrencyShort(amount: number, currency: string): string {
  const symbol =
    currency === 'KRW' ? '₩' : currency === 'JPY' ? '¥' : currency === 'USD' ? '$'
      : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'THB' ? '฿' : currency
  if (['KRW', 'JPY', 'VND'].includes(currency)) {
    return `${symbol}${amount.toLocaleString()}`
  }
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

function sumToKRW(
  currencyAmounts: Record<string, number>,
  rates: Record<string, number>,
): number | null {
  let total = 0
  for (const [currency, amount] of Object.entries(currencyAmounts)) {
    const krw = convertToKRW(amount, currency, rates)
    if (krw == null) return null
    total += krw
  }
  return total
}

function KRWBadge({ amounts, rates }: { amounts: Record<string, number>; rates: Record<string, number> }) {
  const hasNonKRW = Object.keys(amounts).some((c) => c !== 'KRW')
  if (!hasNonKRW) return null
  const krw = sumToKRW(amounts, rates)
  if (krw == null) return null
  return <span className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-1">(≈₩{krw.toLocaleString()})</span>
}

function DayExpenseBreakdown({
  expenses,
  categoryExpenses,
  exchangeRates,
  showKRW,
}: {
  expenses: Record<string, number>
  categoryExpenses?: DayCategoryExpenses
  exchangeRates?: Record<string, number> | null
  showKRW?: boolean
}) {
  const categories = categoryExpenses
    ? (Object.entries(categoryExpenses) as [ExpenseCategory, Record<string, number>][])
        .sort((a, b) => {
          const aTotal = Object.values(a[1]).reduce((s, v) => s + v, 0)
          const bTotal = Object.values(b[1]).reduce((s, v) => s + v, 0)
          return bTotal - aTotal
        })
    : []

  return (
    <div className="mb-3 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
      {/* Total */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">경비 합계</span>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {Object.entries(expenses).map(([currency, amount]) => (
            <span key={currency} className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {formatCurrencyShort(amount, currency)}
            </span>
          ))}
          {showKRW && exchangeRates && (
            <KRWBadge amounts={expenses} rates={exchangeRates} />
          )}
        </div>
      </div>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/50 space-y-1">
          {categories.map(([category, totals]) => {
            const Icon = categoryIcons[category]
            return (
              <div key={category} className="flex items-center justify-between">
                <span className={clsx('flex items-center gap-1.5 text-xs', categoryColors[category])}>
                  <Icon className="size-3" />
                  {EXPENSE_CATEGORY_LABELS[category]}
                </span>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {Object.entries(totals).map(([currency, amount]) => (
                    <span key={currency} className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                      {formatCurrencyShort(amount, currency)}
                    </span>
                  ))}
                  {showKRW && exchangeRates && (
                    <KRWBadge amounts={totals} rates={exchangeRates} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function DaySection({
  day,
  date,
  logs,
  allDayLogs,
  expenses,
  categoryExpenses,
  isExpanded,
  onToggleExpand,
  summary,
  onEdit,
  onDelete,
  onPhotoClick,
  viewMode,
  distanceKm,
  exchangeRates,
  showKRW,
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
        exchangeRates={exchangeRates}
        showKRW={showKRW}
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
              {/* Expanded header with expenses: total + category breakdown */}
              {expenses && (
                <DayExpenseBreakdown expenses={expenses} categoryExpenses={categoryExpenses} exchangeRates={exchangeRates} showKRW={showKRW} />
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
