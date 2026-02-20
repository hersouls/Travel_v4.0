// ============================================
// Expense Summary Component
// Category-based and currency-based totals
// ============================================

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Utensils, Bus, Bed, ShoppingBag, Camera, MoreHorizontal, MapPin, Route } from 'lucide-react'
import { clsx } from 'clsx'
import type { TravelLog, ExpenseCategory } from '@/types'
import { EXPENSE_CATEGORY_LABELS, CURRENCY_SYMBOLS } from '@/utils/constants'

interface ExpenseSummaryProps {
  logs: TravelLog[]
  className?: string
  defaultOpen?: boolean
  totalTripDistance?: number
  uniqueLocationCount?: number
  dayCount?: number
}

const categoryIcons: Record<ExpenseCategory, typeof Utensils> = {
  food: Utensils,
  transport: Bus,
  accommodation: Bed,
  shopping: ShoppingBag,
  attraction: Camera,
  other: MoreHorizontal,
}

const categoryColorClasses: Record<ExpenseCategory, string> = {
  food: 'text-warning-600 bg-warning-50 dark:bg-warning-900/20',
  transport: 'text-primary-600 bg-primary-50 dark:bg-primary-900/20',
  accommodation: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
  shopping: 'text-pink-600 bg-pink-50 dark:bg-pink-900/20',
  attraction: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20',
  other: 'text-[var(--muted-foreground)] bg-[var(--muted)]',
}

const categoryBarColors: Record<ExpenseCategory, string> = {
  food: 'bg-warning-500',
  transport: 'bg-primary-500',
  accommodation: 'bg-purple-500',
  shopping: 'bg-pink-500',
  attraction: 'bg-cyan-500',
  other: 'bg-zinc-400',
}

interface CategoryTotal {
  category: ExpenseCategory
  totals: Record<string, number>
  count: number
}

interface CurrencyTotal {
  currency: string
  total: number
}

function formatAmount(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency
  if (['KRW', 'JPY', 'VND'].includes(currency)) {
    return `${symbol}${amount.toLocaleString()}`
  }
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ExpenseSummary({ logs, className, defaultOpen = false, totalTripDistance, uniqueLocationCount, dayCount }: ExpenseSummaryProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const { categoryTotals, currencyTotals, totalCount, maxCategoryAmount } = useMemo(() => {
    const catMap = new Map<ExpenseCategory, { totals: Record<string, number>; count: number }>()
    const curMap = new Map<string, number>()

    let count = 0
    for (const log of logs) {
      if (log.type !== 'receipt' || !log.expense) continue
      count++
      const { category, totalAmount, currency } = log.expense

      // Category totals
      const cat = catMap.get(category) || { totals: {}, count: 0 }
      cat.totals[currency] = (cat.totals[currency] || 0) + totalAmount
      cat.count++
      catMap.set(category, cat)

      // Currency totals
      curMap.set(currency, (curMap.get(currency) || 0) + totalAmount)
    }

    const categoryTotals: CategoryTotal[] = Array.from(catMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => {
        const aTotal = Object.values(a.totals).reduce((s, v) => s + v, 0)
        const bTotal = Object.values(b.totals).reduce((s, v) => s + v, 0)
        return bTotal - aTotal
      })

    const currencyTotals: CurrencyTotal[] = Array.from(curMap.entries())
      .map(([currency, total]) => ({ currency, total }))
      .sort((a, b) => b.total - a.total)

    // Max category amount for bar chart scaling
    const maxCategoryAmount = categoryTotals.length > 0
      ? Math.max(...categoryTotals.map((c) => Object.values(c.totals).reduce((s, v) => s + v, 0)))
      : 0

    return { categoryTotals, currencyTotals, totalCount: count, maxCategoryAmount }
  }, [logs])

  const hasMovementStats = totalTripDistance != null && totalTripDistance > 0

  if (totalCount === 0 && !hasMovementStats) return null

  return (
    <div className={clsx('rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden', className)}>
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--muted)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">경비 요약</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{totalCount}건</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Show main currency total inline */}
          {currencyTotals.length > 0 && (
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {formatAmount(currencyTotals[0].total, currencyTotals[0].currency)}
            </span>
          )}
          {isOpen ? <ChevronUp className="size-4 text-zinc-400" /> : <ChevronDown className="size-4 text-zinc-400" />}
        </div>
      </button>

      {/* Expandable body */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-100 dark:border-zinc-700/50">
          {/* Currency totals (if multiple currencies) */}
          {currencyTotals.length > 1 && (
            <div className="pt-3 space-y-1.5">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">통화별 합계</span>
              {currencyTotals.map(({ currency, total }) => (
                <div key={currency} className="flex justify-between">
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">{currency}</span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatAmount(total, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Movement statistics */}
          {hasMovementStats && (
            <div className={clsx(currencyTotals.length <= 1 && totalCount > 0 && 'pt-3', currencyTotals.length > 1 && '', totalCount === 0 && 'pt-3', 'space-y-1.5')}>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">이동 통계</span>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <Route className="size-4 mx-auto text-primary-500 mb-1" />
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {(totalTripDistance! / 1000).toFixed(1)}km
                  </p>
                  <p className="text-[10px] text-zinc-500">총 이동거리</p>
                </div>
                {uniqueLocationCount != null && uniqueLocationCount > 0 && (
                  <div className="text-center p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                    <MapPin className="size-4 mx-auto text-violet-500 mb-1" />
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {uniqueLocationCount}곳
                    </p>
                    <p className="text-[10px] text-zinc-500">방문 장소</p>
                  </div>
                )}
                {dayCount != null && dayCount > 0 && (
                  <div className="text-center p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                    <Route className="size-4 mx-auto text-emerald-500 mb-1" />
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {(totalTripDistance! / 1000 / dayCount).toFixed(1)}km
                    </p>
                    <p className="text-[10px] text-zinc-500">일평균</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Category breakdown with bar chart */}
          <div className={clsx(currencyTotals.length <= 1 && 'pt-3', 'space-y-2')}>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">카테고리별</span>
            {categoryTotals.map(({ category, totals, count }) => {
              const Icon = categoryIcons[category]
              const catTotal = Object.values(totals).reduce((s, v) => s + v, 0)
              const pct = maxCategoryAmount > 0 ? (catTotal / maxCategoryAmount) * 100 : 0
              return (
                <div key={category} className="flex items-center gap-3">
                  <div className={clsx('size-8 rounded-lg flex items-center justify-center flex-shrink-0', categoryColorClasses[category])}>
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {EXPENSE_CATEGORY_LABELS[category]}
                      </span>
                      <span className="text-xs text-zinc-400">{count}건</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(totals).map(([cur, amt]) => (
                        <span key={cur} className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {formatAmount(amt, cur)}
                        </span>
                      ))}
                    </div>
                    {/* Bar chart */}
                    <div className="mt-1 h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full transition-all', categoryBarColors[category])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
