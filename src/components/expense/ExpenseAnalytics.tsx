// ============================================
// Expense Analytics Dashboard
// CSS-based charts for expense analysis
// ============================================

import { useCallback, useMemo } from 'react'
import {
  Utensils, Bus, Bed, ShoppingBag, Camera, MoreHorizontal,
  Banknote, CreditCard, Coins, Trophy, TrendingUp, Clock,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { Expense, ExpenseCategory } from '@/types'
import { Dialog, DialogTitle, DialogBody } from '@/components/ui/Dialog'
import { Badge } from '@/components/ui/Badge'
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_SUBCATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/utils/constants'
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

const categoryBadgeColors: Record<ExpenseCategory, 'orange' | 'blue' | 'purple' | 'pink' | 'cyan' | 'zinc'> = {
  food: 'orange', transport: 'blue', accommodation: 'purple',
  shopping: 'pink', attraction: 'cyan', other: 'zinc',
}

const paymentMethodIcons: Record<string, typeof Banknote> = {
  cash: Banknote, card: CreditCard, other: Coins,
}

const paymentMethodColors: Record<string, string> = {
  cash: '#10b981', card: '#3b82f6', other: '#a1a1aa', unknown: '#d4d4d8',
}

const TIME_SLOTS = [
  { key: 'morning', label: '오전 (6-12)', range: [6, 12] },
  { key: 'afternoon', label: '오후 (12-18)', range: [12, 18] },
  { key: 'evening', label: '저녁 (18-24)', range: [18, 24] },
  { key: 'night', label: '심야 (0-6)', range: [0, 6] },
] as const

function formatAmount(amount: number): string {
  return `₩${Math.round(amount).toLocaleString()}`
}

export function ExpenseAnalytics({ isOpen, onClose, expenses, totalDays, exchangeRates }: ExpenseAnalyticsProps) {
  // Convert amount to KRW for unified comparison
  const toKRW = useCallback((amount: number, currency: string): number => {
    if (!exchangeRates) return amount
    return convertToKRW(amount, currency, exchangeRates) ?? amount
  }, [exchangeRates])

  // Grand total KRW
  const grandTotalKRW = useMemo(() => {
    return expenses.reduce((sum, e) => sum + toKRW(e.totalAmount, e.currency), 0)
  }, [expenses, toKRW])

  // Category breakdown (using KRW-normalized totals for percentages)
  const categoryData = useMemo(() => {
    const catMap = new Map<ExpenseCategory, { krwTotal: number; count: number; currencies: Record<string, number> }>()

    for (const e of expenses) {
      const cat = catMap.get(e.category) || { krwTotal: 0, count: 0, currencies: {} }
      const krw = toKRW(e.totalAmount, e.currency)
      cat.krwTotal += krw
      cat.count++
      cat.currencies[e.currency] = (cat.currencies[e.currency] || 0) + e.totalAmount
      catMap.set(e.category, cat)
    }

    return {
      items: Array.from(catMap.entries())
        .map(([category, data]) => ({
          category,
          ...data,
          percentage: grandTotalKRW > 0 ? (data.krwTotal / grandTotalKRW) * 100 : 0,
          avgPerTx: data.count > 0 ? data.krwTotal / data.count : 0,
        }))
        .sort((a, b) => b.krwTotal - a.krwTotal),
      grandTotalKRW,
    }
  }, [expenses, toKRW, grandTotalKRW])

  // Subcategory breakdown
  const subCategoryData = useMemo(() => {
    const subMap = new Map<string, { krwTotal: number; count: number; parentCategory: ExpenseCategory }>()

    for (const e of expenses) {
      const key = e.subCategory || `${e.category}_none`
      const sub = subMap.get(key) || { krwTotal: 0, count: 0, parentCategory: e.category }
      sub.krwTotal += toKRW(e.totalAmount, e.currency)
      sub.count++
      subMap.set(key, sub)
    }

    return Array.from(subMap.entries())
      .map(([subCategory, data]) => ({ subCategory, ...data }))
      .sort((a, b) => b.krwTotal - a.krwTotal)
  }, [expenses, toKRW])

  // Daily spending trend (KRW-normalized) + cumulative
  const dailyTrend = useMemo(() => {
    const dayMap = new Map<number, number>()
    for (const e of expenses) {
      const krw = toKRW(e.totalAmount, e.currency)
      dayMap.set(e.day, (dayMap.get(e.day) || 0) + krw)
    }
    const entries = Array.from(dayMap.entries()).sort((a, b) => a[0] - b[0])
    const maxDaily = entries.length > 0 ? Math.max(...entries.map(([, v]) => v)) : 0

    // Build cumulative data for all days
    let cumulative = 0
    const cumulativeByDay = new Map<number, number>()
    for (let day = 1; day <= totalDays; day++) {
      cumulative += dayMap.get(day) || 0
      cumulativeByDay.set(day, cumulative)
    }

    return { entries, maxDaily, cumulativeByDay, cumulativeMax: cumulative }
  }, [expenses, toKRW, totalDays])

  // Average per day (KRW-normalized)
  const avgPerDay = useMemo(() => {
    if (expenses.length === 0 || totalDays === 0) return 0
    return grandTotalKRW / totalDays
  }, [expenses.length, totalDays, grandTotalKRW])

  // Max spending day
  const maxSpendingDay = useMemo(() => {
    if (dailyTrend.entries.length === 0) return null
    const [day, amount] = dailyTrend.entries.reduce((max, cur) => cur[1] > max[1] ? cur : max)
    return { day, amount }
  }, [dailyTrend.entries])

  // Top 5 expenses
  const topExpenses = useMemo(() => {
    return [...expenses]
      .sort((a, b) => toKRW(b.totalAmount, b.currency) - toKRW(a.totalAmount, a.currency))
      .slice(0, 5)
  }, [expenses, toKRW])

  // Payment method distribution
  const paymentMethodData = useMemo(() => {
    const methodMap = new Map<string, { krwTotal: number; count: number }>()

    for (const e of expenses) {
      const method = e.paymentMethod || 'unknown'
      const data = methodMap.get(method) || { krwTotal: 0, count: 0 }
      data.krwTotal += toKRW(e.totalAmount, e.currency)
      data.count++
      methodMap.set(method, data)
    }

    return Array.from(methodMap.entries())
      .map(([method, data]) => ({
        method,
        ...data,
        percentage: grandTotalKRW > 0 ? (data.krwTotal / grandTotalKRW) * 100 : 0,
      }))
      .sort((a, b) => b.krwTotal - a.krwTotal)
  }, [expenses, toKRW, grandTotalKRW])

  // Time-of-day spending pattern
  const timeOfDayData = useMemo(() => {
    const slotMap = new Map<string, { krwTotal: number; count: number }>()
    for (const slot of TIME_SLOTS) slotMap.set(slot.key, { krwTotal: 0, count: 0 })

    for (const e of expenses) {
      let hour = -1
      try {
        const ts = new Date(e.timestamp)
        hour = ts.getHours()
      } catch { /* ignore */ }
      if (hour < 0) continue

      const slot = TIME_SLOTS.find(s => hour >= s.range[0] && hour < s.range[1])
      if (slot) {
        const data = slotMap.get(slot.key)!
        data.krwTotal += toKRW(e.totalAmount, e.currency)
        data.count++
      }
    }

    const items = TIME_SLOTS.map(slot => ({
      ...slot,
      ...slotMap.get(slot.key)!,
    }))
    const maxSlotKRW = Math.max(...items.map(i => i.krwTotal), 1)
    return { items, maxSlotKRW }
  }, [expenses, toKRW])

  // Check if any payment method data exists (excluding 'unknown')
  const hasPaymentMethodData = paymentMethodData.some(d => d.method !== 'unknown')
  const hasTimeData = timeOfDayData.items.some(d => d.count > 0)

  return (
    <Dialog open={isOpen} onClose={onClose} size="lg">
      <DialogTitle>경비 분석</DialogTitle>
      <DialogBody>
        <div className="space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-2">
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
              <p className="text-[10px] text-zinc-500">일평균(₩)</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
              <p className="text-lg font-bold text-[var(--foreground)]">
                {maxSpendingDay ? `D${maxSpendingDay.day}` : '-'}
              </p>
              <p className="text-[10px] text-zinc-500">최대 지출일</p>
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

              {/* Legend with avg per tx */}
              <div className="space-y-2">
                {categoryData.items.map(({ category, count, percentage, krwTotal, avgPerTx }) => {
                  const Icon = categoryIcons[category]
                  return (
                    <div key={category} className="flex items-center gap-2">
                      <div
                        className="size-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: categoryColors[category] }}
                      />
                      <Icon className="size-4 flex-shrink-0 text-zinc-500" />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">
                        {EXPENSE_CATEGORY_LABELS[category]}
                      </span>
                      <span className="text-[10px] text-zinc-400">{count}건</span>
                      <span className="text-[10px] text-zinc-400">
                        평균 {formatAmount(avgPerTx)}
                      </span>
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        {percentage.toFixed(1)}%
                      </span>
                      <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                        {formatAmount(krwTotal)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Subcategory breakdown — only show if meaningful subcategories exist */}
          {subCategoryData.some(d => !d.subCategory.endsWith('_none')) && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">세부 카테고리별 비중</h3>
              <div className="space-y-1.5">
                {subCategoryData.slice(0, 10).map(({ subCategory, krwTotal, count, parentCategory }) => {
                  const isUnset = subCategory.endsWith('_none')
                  const label = isUnset
                    ? `${EXPENSE_CATEGORY_LABELS[parentCategory]} (미분류)`
                    : (EXPENSE_SUBCATEGORY_LABELS[subCategory] || subCategory)
                  const pct = grandTotalKRW > 0 ? (krwTotal / grandTotalKRW) * 100 : 0
                  return (
                    <div key={subCategory}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="size-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: categoryColors[parentCategory] }}
                          />
                          <span className="text-xs text-zinc-700 dark:text-zinc-300">{label}</span>
                          <span className="text-[10px] text-zinc-400">{count}건</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400">{pct.toFixed(1)}%</span>
                          <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{formatAmount(krwTotal)}</span>
                        </div>
                      </div>
                      <div className="h-1 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.max(pct, 0.5)}%`,
                            backgroundColor: categoryColors[parentCategory],
                            opacity: 0.7,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top 5 expenses */}
          {topExpenses.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                <Trophy className="size-4 inline mr-1 text-warning-500" />
                최대 지출 Top 5
              </h3>
              <div className="space-y-2">
                {topExpenses.map((expense, idx) => (
                  <div key={expense.id || idx} className="flex items-center gap-2">
                    <span className={clsx(
                      'size-5 flex items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0',
                      idx === 0 ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500',
                    )}>
                      {idx + 1}
                    </span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1 truncate">
                      {expense.storeName}
                    </span>
                    <Badge color={categoryBadgeColors[expense.category]} size="sm">
                      {EXPENSE_CATEGORY_LABELS[expense.category]}
                    </Badge>
                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex-shrink-0">
                      {formatAmount(toKRW(expense.totalAmount, expense.currency))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment method distribution */}
          {hasPaymentMethodData && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">결제수단별 분포</h3>
              {/* Stacked bar */}
              <div className="h-5 flex rounded-full overflow-hidden mb-3">
                {paymentMethodData.map(({ method, percentage }) => (
                  <div
                    key={method}
                    className="h-full transition-all"
                    style={{
                      width: `${Math.max(percentage, 2)}%`,
                      backgroundColor: paymentMethodColors[method] || paymentMethodColors.unknown,
                    }}
                    title={`${PAYMENT_METHOD_LABELS[method] || '미지정'} ${percentage.toFixed(1)}%`}
                  />
                ))}
              </div>
              {/* Legend */}
              <div className="space-y-1.5">
                {paymentMethodData.map(({ method, count, percentage, krwTotal }) => {
                  const Icon = paymentMethodIcons[method]
                  const label = PAYMENT_METHOD_LABELS[method] || '미지정'
                  return (
                    <div key={method} className="flex items-center gap-3">
                      <div
                        className="size-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: paymentMethodColors[method] || paymentMethodColors.unknown }}
                      />
                      {Icon ? <Icon className="size-3.5 flex-shrink-0 text-zinc-500" /> : <Coins className="size-3.5 flex-shrink-0 text-zinc-400" />}
                      <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">{label}</span>
                      <span className="text-xs text-zinc-400">{count}건</span>
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{percentage.toFixed(1)}%</span>
                      <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{formatAmount(krwTotal)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Time-of-day spending pattern */}
          {hasTimeData && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                <Clock className="size-4 inline mr-1 text-primary-500" />
                시간대별 지출 패턴
              </h3>
              <div className="space-y-2">
                {timeOfDayData.items.map(({ key, label, krwTotal, count }) => {
                  const pct = timeOfDayData.maxSlotKRW > 0 ? (krwTotal / timeOfDayData.maxSlotKRW) * 100 : 0
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-zinc-700 dark:text-zinc-300">{label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400">{count}건</span>
                          <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                            {count > 0 ? formatAmount(krwTotal) : '-'}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary-400 dark:bg-primary-500 transition-all"
                          style={{ width: `${Math.max(pct, count > 0 ? 2 : 0)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Daily trend bar chart with cumulative line */}
          {dailyTrend.entries.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                <TrendingUp className="size-4 inline mr-1 text-emerald-500" />
                일별 지출 추이
              </h3>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1">
                  <div className="size-2 rounded-full bg-primary-500" />
                  <span className="text-[10px] text-zinc-400">일별</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-zinc-400">누적</span>
                </div>
                {avgPerDay > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 border-t border-dashed border-warning-400" />
                    <span className="text-[10px] text-zinc-400">평균</span>
                  </div>
                )}
              </div>
              <div className="relative">
                {/* Average line */}
                {avgPerDay > 0 && dailyTrend.maxDaily > 0 && (
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-warning-400/50 z-10 pointer-events-none"
                    style={{ bottom: `${(avgPerDay / dailyTrend.maxDaily) * 128 + 16}px` }}
                  />
                )}
                <div className="flex gap-1 h-32">
                  {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                    const amount = dailyTrend.entries.find(([d]) => d === day)?.[1] || 0
                    const heightPct = dailyTrend.maxDaily > 0 ? (amount / dailyTrend.maxDaily) * 100 : 0
                    const cumPct = dailyTrend.cumulativeMax > 0
                      ? ((dailyTrend.cumulativeByDay.get(day) || 0) / dailyTrend.cumulativeMax) * 100
                      : 0
                    return (
                      <div
                        key={day}
                        className="flex-1 flex flex-col items-center justify-end relative"
                        title={`Day ${day}: ${formatAmount(amount)} (누적 ${formatAmount(dailyTrend.cumulativeByDay.get(day) || 0)})`}
                      >
                        {/* Cumulative dot */}
                        <div
                          className="absolute size-1.5 rounded-full bg-emerald-500 z-10"
                          style={{ bottom: `${Math.max(cumPct, 2) * 1.28 + 16}px` }}
                        />
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
            </div>
          )}
        </div>
      </DialogBody>
    </Dialog>
  )
}
