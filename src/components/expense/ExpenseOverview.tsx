// ============================================
// Expense Overview
// Trip-wide expense summary with category breakdown
// ============================================

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Utensils, Bus, Bed, ShoppingBag, Camera, MoreHorizontal } from 'lucide-react'
import { clsx } from 'clsx'
import type { ExpenseCategory } from '@/types'
import type { ExpenseTripTotals } from '@/hooks/useExpenseView'
import { EXPENSE_CATEGORY_LABELS } from '@/utils/constants'
import { convertToKRW } from '@/services/exchangeRateService'

interface ExpenseOverviewProps {
  tripTotals: ExpenseTripTotals
  className?: string
  exchangeRates?: Record<string, number> | null
  showKRW?: boolean
}

const categoryIcons: Record<ExpenseCategory, typeof Utensils> = {
  food: Utensils, transport: Bus, accommodation: Bed,
  shopping: ShoppingBag, attraction: Camera, other: MoreHorizontal,
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
  food: 'bg-warning-500', transport: 'bg-primary-500', accommodation: 'bg-purple-500',
  shopping: 'bg-pink-500', attraction: 'bg-cyan-500', other: 'bg-zinc-400',
}

function formatAmount(amount: number): string {
  return `₩${Math.round(amount).toLocaleString()}`
}

export function ExpenseOverview({ tripTotals, className, exchangeRates, showKRW }: ExpenseOverviewProps) {
  const [isOpen, setIsOpen] = useState(true)
  const { currencyTotals, categoryTotals, totalCount } = tripTotals

  const maxCategoryKRW = useMemo(() => {
    if (categoryTotals.length === 0) return 0
    return Math.max(...categoryTotals.map((c) => {
      let krwTotal = 0
      for (const [cur, amt] of Object.entries(c.totals)) {
        const krw = exchangeRates ? convertToKRW(amt, cur, exchangeRates) : null
        krwTotal += krw ?? amt
      }
      return krwTotal
    }))
  }, [categoryTotals, exchangeRates])

  if (totalCount === 0) return null

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
        <div className="flex items-center gap-2 sm:gap-3">
          {currencyTotals.length > 0 && (
            <div className="text-right">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {(() => {
                  let totalKRW = 0
                  for (const { currency, total } of currencyTotals) {
                    if (exchangeRates) {
                      const krw = convertToKRW(total, currency, exchangeRates)
                      totalKRW += krw ?? total
                    } else {
                      totalKRW += total
                    }
                  }
                  return formatAmount(totalKRW)
                })()}
              </span>
            </div>
          )}
          {isOpen ? <ChevronUp className="size-4 text-zinc-400" /> : <ChevronDown className="size-4 text-zinc-400" />}
        </div>
      </button>

      {/* Body */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-100 dark:border-zinc-700/50">
          {/* Currency totals */}
          {currencyTotals.length > 1 && (
            <div className="pt-3 space-y-1.5">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">통화별 합계</span>
              {currencyTotals.map(({ currency, total }) => {
                const krw = exchangeRates ? convertToKRW(total, currency, exchangeRates) : null
                return (
                  <div key={currency} className="flex justify-between items-center">
                    <span className="text-sm text-zinc-600 dark:text-zinc-300">{currency}</span>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatAmount(krw ?? total)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Category breakdown */}
          <div className={clsx(currencyTotals.length <= 1 && 'pt-3', 'space-y-2')}>
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">카테고리별</span>
            {categoryTotals.map(({ category, totals, count }) => {
              const Icon = categoryIcons[category]
              let catKRW = 0
              for (const [cur, amt] of Object.entries(totals)) {
                const krw = exchangeRates ? convertToKRW(amt, cur, exchangeRates) : null
                catKRW += krw ?? amt
              }
              const pct = maxCategoryKRW > 0 ? (catKRW / maxCategoryKRW) * 100 : 0
              return (
                <div key={category} className="flex items-center gap-2 sm:gap-3">
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
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {formatAmount(catKRW)}
                    </span>
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
