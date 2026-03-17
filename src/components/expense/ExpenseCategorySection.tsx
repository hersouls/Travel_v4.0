// ============================================
// Expense Category Section
// Category-level accordion with Day sub-groups
// ============================================

import { useCallback } from 'react'
import { clsx } from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  Utensils,
  Bus,
  Bed,
  ShoppingBag,
  Camera,
  MoreHorizontal,
} from 'lucide-react'
import type { Expense, ExpenseCategory } from '@/types'
import type { ExpenseCategoryGroup } from '@/hooks/useExpenseView'
import { EXPENSE_CATEGORY_LABELS } from '@/utils/constants'
import { convertToKRW } from '@/services/exchangeRateService'
import { getTripDayDate } from '@/utils/timezone'
import { ExpenseCard } from './ExpenseCard'

interface ExpenseCategorySectionProps {
  group: ExpenseCategoryGroup
  isExpanded: boolean
  onToggleExpand: () => void
  tripStartDate: string
  onEdit: (expense: Expense) => void
  onDelete: (id: number) => void
  exchangeRates?: Record<string, number> | null
  showKRW?: boolean
  thumbnailMap: Record<number, string>
}

const categoryIcons: Record<ExpenseCategory, typeof Utensils> = {
  food: Utensils,
  transport: Bus,
  accommodation: Bed,
  shopping: ShoppingBag,
  attraction: Camera,
  other: MoreHorizontal,
}

const categoryBgColors: Record<ExpenseCategory, string> = {
  food: 'bg-warning-500',
  transport: 'bg-primary-500',
  accommodation: 'bg-purple-500',
  shopping: 'bg-pink-500',
  attraction: 'bg-cyan-500',
  other: 'bg-zinc-400',
}

const categoryTextColors: Record<ExpenseCategory, string> = {
  food: 'text-warning-600 dark:text-warning-400',
  transport: 'text-primary-600 dark:text-primary-400',
  accommodation: 'text-purple-600 dark:text-purple-400',
  shopping: 'text-pink-600 dark:text-pink-400',
  attraction: 'text-cyan-600 dark:text-cyan-400',
  other: 'text-zinc-500 dark:text-zinc-400',
}

function formatCurrencyShort(amount: number): string {
  return `₩${Math.round(amount).toLocaleString()}`
}

export function ExpenseCategorySection({
  group,
  isExpanded,
  onToggleExpand,
  tripStartDate,
  onEdit,
  onDelete,
  exchangeRates,
  thumbnailMap,
}: ExpenseCategorySectionProps) {
  const handleEdit = useCallback((expense: Expense) => onEdit(expense), [onEdit])
  const handleDelete = useCallback((id: number) => onDelete(id), [onDelete])

  const { category, expenseCount, totals, expensesByDay, sortedDays } = group
  const Icon = categoryIcons[category]
  const label = EXPENSE_CATEGORY_LABELS[category]

  // Compute total in KRW
  let totalKRW = 0
  for (const [currency, amount] of Object.entries(totals)) {
    if (exchangeRates) {
      const krw = convertToKRW(amount, currency, exchangeRates)
      if (krw != null) { totalKRW += krw; continue }
    }
    totalKRW += amount
  }

  return (
    <div id={`expense-cat-${category}`} style={{ scrollMarginTop: '7rem' }}>
      {/* Category Header */}
      <button
        type="button"
        onClick={onToggleExpand}
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
          'border border-[var(--border)] bg-[var(--card)]',
          'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
          'active:scale-[0.99] transition-transform',
          isExpanded && 'rounded-b-none border-b-0',
        )}
      >
        {/* Category icon */}
        <div className={clsx('size-8 rounded-full flex items-center justify-center text-white flex-shrink-0', categoryBgColors[category])}>
          <Icon className="size-4" />
        </div>

        {/* Label + count */}
        <div className="flex-1 min-w-0 text-left">
          <span className={clsx('text-sm font-semibold', categoryTextColors[category])}>
            {label}
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-1.5">
            {expenseCount}건
          </span>
        </div>

        {/* Total */}
        {!isExpanded && (
          <div className="flex-shrink-0 text-right">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {formatCurrencyShort(totalKRW)}
            </p>
          </div>
        )}

        {/* Chevron */}
        <div className="flex-shrink-0 text-zinc-400 dark:text-zinc-500">
          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key={`expense-cat-${category}-content`}
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
              {sortedDays.map((day, dayIdx) => {
                const dayExpenses = expensesByDay[day] || []
                if (dayExpenses.length === 0) return null

                const dayDate = getTripDayDate(tripStartDate, day)
                const dateStr = dayDate.toLocaleDateString('ko-KR', {
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })

                return (
                  <div key={day}>
                    {/* Day sub-header */}
                    {dayIdx > 0 && (
                      <div className="border-t border-dashed border-[var(--border)] my-2" />
                    )}
                    <div className="flex items-center gap-2 mb-2 mt-1">
                      <span className="text-xs font-semibold text-[var(--foreground)]">
                        Day {day}
                      </span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        {dateStr}
                      </span>
                    </div>

                    {/* Expense cards */}
                    {dayExpenses.map((expense) => (
                      <ExpenseCard
                        key={expense.id}
                        expense={expense}
                        thumbnailPhoto={expense.id ? thumbnailMap[expense.id] : undefined}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        exchangeRates={exchangeRates}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
