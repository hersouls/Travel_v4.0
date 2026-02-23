// ============================================
// Expense Card Component
// Renders a single expense entry
// ============================================

import { Trash2, Edit3 } from 'lucide-react'
import { clsx } from 'clsx'
import type { Expense, ExpenseCategory } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/Button'
import { EXPENSE_CATEGORY_LABELS, EXPENSE_SUBCATEGORY_LABELS, CURRENCY_SYMBOLS } from '@/utils/constants'

interface ExpenseCardProps {
  expense: Expense
  onEdit?: (expense: Expense) => void
  onDelete?: (id: number) => void
}

const categoryColors: Record<ExpenseCategory, 'orange' | 'blue' | 'purple' | 'pink' | 'cyan' | 'zinc'> = {
  food: 'orange',
  transport: 'blue',
  accommodation: 'purple',
  shopping: 'pink',
  attraction: 'cyan',
  other: 'zinc',
}

const categoryBgColors: Record<ExpenseCategory, string> = {
  food: 'bg-warning-500',
  transport: 'bg-primary-500',
  accommodation: 'bg-purple-500',
  shopping: 'bg-pink-500',
  attraction: 'bg-cyan-500',
  other: 'bg-zinc-400',
}

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return ''
  }
}

function formatAmount(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency
  if (['KRW', 'JPY', 'VND'].includes(currency)) {
    return `${symbol}${amount.toLocaleString()}`
  }
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function ExpenseCard({ expense, onEdit, onDelete }: ExpenseCardProps) {
  const time = formatTime(expense.timestamp)

  return (
    <div className="flex gap-2 sm:gap-3 group">
      {/* Timeline connector */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={clsx('size-8 rounded-full flex items-center justify-center text-white', categoryBgColors[expense.category])}>
          <span className="text-xs font-bold">
            {EXPENSE_CATEGORY_LABELS[expense.category]?.charAt(0)}
          </span>
        </div>
        <div className="w-0.5 flex-1 bg-[var(--border)] mt-1" />
      </div>

      {/* Card */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-3 transition-shadow hover:shadow-sm">
          {/* Header: time + actions */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              {time && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{time}</span>
              )}
              <Badge color={categoryColors[expense.category]} size="sm">
                {EXPENSE_CATEGORY_LABELS[expense.category]}
              </Badge>
              {expense.subCategory && (
                <Badge color="zinc" size="sm">
                  {EXPENSE_SUBCATEGORY_LABELS[expense.subCategory] || expense.subCategory}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <IconButton plain color="secondary" onClick={() => onEdit(expense)} aria-label="수정">
                  <Edit3 className="size-3.5" />
                </IconButton>
              )}
              {onDelete && expense.id && (
                <IconButton plain color="danger" onClick={() => onDelete(expense.id!)} aria-label="삭제">
                  <Trash2 className="size-3.5" />
                </IconButton>
              )}
            </div>
          </div>

          {/* Store name + amount */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--foreground)] truncate">
              {expense.storeName}
            </p>
            <span className="text-sm font-bold text-[var(--foreground)] flex-shrink-0 ml-2">
              {formatAmount(expense.totalAmount, expense.currency)}
            </span>
          </div>

          {/* Items preview */}
          {expense.items.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {expense.items.slice(0, 3).map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="truncate">{item.name}</span>
                  <span className="flex-shrink-0 ml-2">
                    {formatAmount(item.amount, expense.currency)}
                  </span>
                </div>
              ))}
              {expense.items.length > 3 && (
                <p className="text-xs text-zinc-400">+{expense.items.length - 3}개 더</p>
              )}
            </div>
          )}

          {/* Memo */}
          {expense.memo && (
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
              {expense.memo}
            </p>
          )}

          {/* Address */}
          {expense.address && (
            <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
              {expense.address}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
