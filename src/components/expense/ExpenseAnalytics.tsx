// ============================================
// Expense Analytics Dashboard
// CSS-based charts for expense analysis
// ============================================

import { useCallback, useMemo } from 'react'
import { Utensils, Bus, Bed, ShoppingBag, Camera, MoreHorizontal } from 'lucide-react'
import { clsx } from 'clsx'
import type { Expense, ExpenseCategory } from '@/types'
import { Dialog, DialogTitle, DialogBody } from '@/components/ui/Dialog'
import { EXPENSE_CATEGORY_LABELS, CURRENCY_SYMBOLS } from '@/utils/constants'
import { convertToKRW } from '@/services/exchangeRateService'

interface ExpenseAnalyticsProps {
  isOpen: boolean
  onClose: () => void
  expenses: Expense[]
  totalDays: number
  exchangeRates?: Record<string, number> | null
}

const categoryIcons: Record<ExpenseCategory, typeof Utensils> = {
  food: Utensils, transport: Bus, accommodation: Bed,
  shopping: ShoppingBag, attraction: Camera, other: MoreHorizontal,
}

const categoryColors: Record<ExpenseCategory, string> = {
  food: '#f59e0b', transport: '#3b82f6', accommodation: '#a855f7',
  shopping: '#ec4899', attraction: '#06b6d4', other: '#a1a1aa',
}

function formatAmount(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency
  if (['KRW', 'JPY', 'VND'].includes(currency)) {
    return `${symbol}${amount.toLocaleString()}`
  }
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
}

export function ExpenseAnalytics({ isOpen, onClose, expenses, totalDays, exchangeRates }: ExpenseAnalyticsProps) {
  // Convert amount to KRW for unified comparison
  const toKRW = useCallback((amount: number, currency: string): number => {
    if (!exchangeRates) return amount
    return convertToKRW(amount, currency, exchangeRates) ?? amount
  }, [exchangeRates])

  // Category breakdown (using KRW-normalized totals for percentages)
  const categoryData = useMemo(() => {
    const catMap = new Map<ExpenseCategory, { krwTotal: number; count: number; currencies: Record<string, number> }>()
    let grandTotalKRW = 0

    for (const e of expenses) {
      const cat = catMap.get(e.category) || { krwTotal: 0, count: 0, currencies: {} }
      const krw = toKRW(e.totalAmount, e.currency)
      cat.krwTotal += krw
      cat.count++
      cat.currencies[e.currency] = (cat.currencies[e.currency] || 0) + e.totalAmount
      catMap.set(e.category, cat)
      grandTotalKRW += krw
    }

    return {
      items: Array.from(catMap.entries())
        .map(([category, data]) => ({
          category,
          ...data,
          percentage: grandTotalKRW > 0 ? (data.krwTotal / grandTotalKRW) * 100 : 0,
        }))
        .sort((a, b) => b.krwTotal - a.krwTotal),
      grandTotalKRW,
    }
  }, [expenses, toKRW])

  // Daily spending trend (KRW-normalized)
  const dailyTrend = useMemo(() => {
    const dayMap = new Map<number, number>()
    for (const e of expenses) {
      const krw = toKRW(e.totalAmount, e.currency)
      dayMap.set(e.day, (dayMap.get(e.day) || 0) + krw)
    }
    const entries = Array.from(dayMap.entries()).sort((a, b) => a[0] - b[0])
    const maxDaily = entries.length > 0 ? Math.max(...entries.map(([, v]) => v)) : 0
    return { entries, maxDaily }
  }, [expenses, toKRW])

  // Average per day (KRW-normalized)
  const avgPerDay = useMemo(() => {
    if (expenses.length === 0 || totalDays === 0) return 0
    return categoryData.grandTotalKRW / totalDays
  }, [expenses.length, totalDays, categoryData.grandTotalKRW])

  return (
    <Dialog open={isOpen} onClose={onClose} size="lg">
      <DialogTitle>경비 분석</DialogTitle>
      <DialogBody>
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
              <p className="text-lg font-bold text-[var(--foreground)]">{expenses.length}</p>
              <p className="text-[10px] text-zinc-500">총 건수</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
              <p className="text-lg font-bold text-[var(--foreground)]">
                {categoryData.items.length}
              </p>
              <p className="text-[10px] text-zinc-500">카테고리</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
              <p className="text-lg font-bold text-[var(--foreground)]">
                {avgPerDay > 0 ? Math.round(avgPerDay).toLocaleString() : '-'}
              </p>
              <p className="text-[10px] text-zinc-500">일평균</p>
            </div>
          </div>

          {/* Category pie chart (CSS-based bar) */}
          {categoryData.items.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">카테고리별 비중</h3>
              {/* Stacked bar */}
              <div className="h-6 flex rounded-full overflow-hidden mb-3">
                {categoryData.items.map(({ category, percentage }) => (
                  <div
                    key={category}
                    className="h-full transition-all"
                    style={{
                      width: `${Math.max(percentage, 2)}%`,
                      backgroundColor: categoryColors[category],
                    }}
                    title={`${EXPENSE_CATEGORY_LABELS[category]} ${percentage.toFixed(1)}%`}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="space-y-2">
                {categoryData.items.map(({ category, currencies, count, percentage }) => {
                  const Icon = categoryIcons[category]
                  return (
                    <div key={category} className="flex items-center gap-3">
                      <div
                        className="size-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: categoryColors[category] }}
                      />
                      <Icon className="size-4 flex-shrink-0 text-zinc-500" />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">
                        {EXPENSE_CATEGORY_LABELS[category]}
                      </span>
                      <span className="text-xs text-zinc-400">{count}건</span>
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        {percentage.toFixed(1)}%
                      </span>
                      <div className="text-right">
                        {Object.entries(currencies).map(([cur, amt]) => (
                          <p key={cur} className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            {formatAmount(amt, cur)}
                          </p>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Daily trend bar chart */}
          {dailyTrend.entries.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">일별 지출 추이</h3>
              <div className="flex items-end gap-1 h-32">
                {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                  const amount = dailyTrend.entries.find(([d]) => d === day)?.[1] || 0
                  const heightPct = dailyTrend.maxDaily > 0 ? (amount / dailyTrend.maxDaily) * 100 : 0
                  return (
                    <div
                      key={day}
                      className="flex-1 flex flex-col items-center justify-end"
                      title={`Day ${day}: ${amount.toLocaleString()}`}
                    >
                      <div
                        className={clsx(
                          'w-full rounded-t transition-all',
                          amount > 0 ? 'bg-primary-500' : 'bg-zinc-200 dark:bg-zinc-700',
                        )}
                        style={{
                          height: `${Math.max(heightPct, amount > 0 ? 4 : 1)}%`,
                          minHeight: amount > 0 ? '4px' : '1px',
                        }}
                      />
                      <span className="text-[9px] text-zinc-400 mt-1">{day}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </DialogBody>
    </Dialog>
  )
}
