// ============================================
// Expense Day Section
// Wraps header + cards with accordion animation
// ============================================

import type { ExpenseDaySummary } from '@/hooks/useExpenseView'
import type { Expense } from '@/types'
import { clsx } from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback } from 'react'
import { ExpenseCard } from './ExpenseCard'
import { ExpenseDaySectionHeader } from './ExpenseDaySectionHeader'

interface ExpenseDaySectionProps {
  day: number
  date: Date
  expenses: Expense[]
  allDayExpenses: Expense[]
  isExpanded: boolean
  onToggleExpand: () => void
  summary?: ExpenseDaySummary
  onEdit: (expense: Expense) => void
  onDelete: (id: number) => void
  exchangeRates?: Record<string, number> | null
  showKRW?: boolean
}

export function ExpenseDaySection({
  day,
  date,
  expenses,
  allDayExpenses,
  isExpanded,
  onToggleExpand,
  summary,
  onEdit,
  onDelete,
  exchangeRates,
  showKRW,
}: ExpenseDaySectionProps) {
  const handleEdit = useCallback((expense: Expense) => onEdit(expense), [onEdit])
  const handleDelete = useCallback((id: number) => onDelete(id), [onDelete])

  if (allDayExpenses.length === 0) return null

  return (
    <div id={`expense-day-${day}`} style={{ scrollMarginTop: '7rem' }}>
      <ExpenseDaySectionHeader
        day={day}
        date={date}
        isExpanded={isExpanded}
        onToggle={onToggleExpand}
        summary={summary}
        exchangeRates={exchangeRates}
        showKRW={showKRW}
      />

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key={`expense-day-${day}-content`}
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
              {expenses.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-4">
                  필터 조건에 맞는 경비가 없습니다
                </p>
              ) : (
                <div>
                  {expenses.map((expense) => (
                    <ExpenseCard
                      key={expense.id}
                      expense={expense}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      exchangeRates={exchangeRates}
                    />
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
