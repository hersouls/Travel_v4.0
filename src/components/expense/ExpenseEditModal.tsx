// ============================================
// Expense Edit Modal
// Edit an existing expense
// ============================================

import { useState, useCallback, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { Expense, ExpenseCategory, ExpenseItem, ExpenseSubCategory } from '@/types'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button, IconButton } from '@/components/ui/Button'
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_SUBCATEGORY_LABELS,
  EXPENSE_SUBCATEGORIES,
  CURRENCY_SYMBOLS,
} from '@/utils/constants'

interface ExpenseEditModalProps {
  expense: Expense | null
  isOpen: boolean
  onClose: () => void
  onSave: (id: number, updates: Partial<Expense>) => void
}

const CATEGORIES: ExpenseCategory[] = ['food', 'transport', 'accommodation', 'shopping', 'attraction', 'other']
const CURRENCIES = Object.keys(CURRENCY_SYMBOLS)

export function ExpenseEditModal({ expense, isOpen, onClose, onSave }: ExpenseEditModalProps) {
  const [category, setCategory] = useState<ExpenseCategory>('food')
  const [subCategory, setSubCategory] = useState<ExpenseSubCategory | ''>('')
  const [storeName, setStoreName] = useState('')
  const [memo, setMemo] = useState('')
  const [currency, setCurrency] = useState('KRW')
  const [receiptDate, setReceiptDate] = useState('')
  const [items, setItems] = useState<ExpenseItem[]>([{ name: '', amount: 0 }])

  // Populate form when expense changes or modal opens
  useEffect(() => {
    if (expense && isOpen) {
      setCategory(expense.category)
      setSubCategory(expense.subCategory || '')
      setStoreName(expense.storeName)
      setMemo(expense.memo || '')
      setCurrency(expense.currency)

      // 날짜: receiptDate가 없으면 timestamp에서 추출
      const date = expense.receiptDate
        || (expense.timestamp ? new Date(expense.timestamp).toISOString().split('T')[0] : '')
      setReceiptDate(date)

      // 항목: items가 비었거나 금액 합이 0이면 totalAmount로 단일 항목 생성
      if (expense.items.length > 0 && expense.items.some(i => i.amount > 0)) {
        setItems([...expense.items])
      } else {
        setItems([{ name: expense.storeName || '합계', amount: expense.totalAmount }])
      }
    }
  }, [expense, isOpen])

  const subCategories = (EXPENSE_SUBCATEGORIES[category] || []) as string[]
  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0)

  const handleAddItem = useCallback(() => {
    setItems((prev) => [...prev, { name: '', amount: 0 }])
  }, [])

  const handleRemoveItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleItemChange = useCallback((index: number, field: keyof ExpenseItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: field === 'amount' ? Number(value) || 0 : value } : item,
      ),
    )
  }, [])

  const handleSave = useCallback(() => {
    if (!expense?.id || !storeName.trim() || !isFinite(totalAmount) || totalAmount <= 0) return

    const validItems = items.filter((item) => item.name.trim() && item.amount > 0)
    const finalTotal = validItems.length > 0
      ? validItems.reduce((sum, item) => sum + item.amount, 0)
      : totalAmount

    onSave(expense.id, {
      category,
      subCategory: subCategory || undefined,
      storeName: storeName.trim(),
      memo: memo.trim() || undefined,
      items: validItems.length > 0 ? validItems : [{ name: storeName.trim(), amount: finalTotal }],
      totalAmount: finalTotal,
      currency,
      receiptDate: receiptDate || undefined,
    })
    onClose()
  }, [expense, category, subCategory, storeName, memo, items, totalAmount, currency, receiptDate, onSave, onClose])

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>경비 수정</DialogTitle>
      <DialogBody>
        <div className="space-y-4">
          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">카테고리</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => { setCategory(cat); setSubCategory('') }}
                  className={clsx(
                    'px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
                    category === cat
                      ? 'bg-primary-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
                  )}
                >
                  {EXPENSE_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Subcategory */}
          {subCategories.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">세부 카테고리</label>
              <div className="flex flex-wrap gap-1">
                {subCategories.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSubCategory(subCategory === sub ? '' : sub as ExpenseSubCategory)}
                    className={clsx(
                      'px-2 py-0.5 text-[11px] font-medium rounded-full transition-colors',
                      subCategory === sub
                        ? 'bg-primary-400 text-white'
                        : 'bg-zinc-50 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400',
                    )}
                  >
                    {EXPENSE_SUBCATEGORY_LABELS[sub] || sub}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Store name */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">상점명</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="상점 또는 결제처"
              className={clsx(
                'w-full px-3 py-2 text-sm rounded-lg',
                'bg-zinc-100 dark:bg-zinc-800 text-[var(--foreground)]',
                'border border-transparent focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none',
              )}
            />
          </div>

          {/* Currency + Date */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">통화</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={clsx(
                  'w-full px-3 py-2 text-sm rounded-lg',
                  'bg-zinc-100 dark:bg-zinc-800 text-[var(--foreground)]',
                  'border border-transparent focus:border-primary-500 outline-none',
                )}
              >
                {CURRENCIES.map((cur) => (
                  <option key={cur} value={cur}>
                    {CURRENCY_SYMBOLS[cur]} {cur}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">날짜</label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className={clsx(
                  'w-full px-3 py-2 text-sm rounded-lg',
                  'bg-zinc-100 dark:bg-zinc-800 text-[var(--foreground)]',
                  'border border-transparent focus:border-primary-500 outline-none',
                )}
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">항목</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                <Plus className="size-3" /> 추가
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                    placeholder="항목명"
                    className={clsx(
                      'flex-1 px-3 py-1.5 text-sm rounded-lg',
                      'bg-zinc-100 dark:bg-zinc-800 text-[var(--foreground)]',
                      'border border-transparent focus:border-primary-500 outline-none',
                    )}
                  />
                  <input
                    type="number"
                    value={item.amount || ''}
                    onChange={(e) => handleItemChange(idx, 'amount', e.target.value)}
                    placeholder="금액"
                    className={clsx(
                      'w-24 px-3 py-1.5 text-sm rounded-lg text-right',
                      'bg-zinc-100 dark:bg-zinc-800 text-[var(--foreground)]',
                      'border border-transparent focus:border-primary-500 outline-none',
                    )}
                  />
                  {items.length > 1 && (
                    <IconButton plain color="danger" onClick={() => handleRemoveItem(idx)} aria-label="항목 삭제">
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex justify-between items-center px-1 pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">합계</span>
            <span className="text-base font-bold text-[var(--foreground)]">
              {CURRENCY_SYMBOLS[currency] || currency}
              {totalAmount.toLocaleString()}
            </span>
          </div>

          {/* Memo */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">메모</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="메모 (선택)"
              rows={2}
              className={clsx(
                'w-full px-3 py-2 text-sm rounded-lg resize-none',
                'bg-zinc-100 dark:bg-zinc-800 text-[var(--foreground)]',
                'border border-transparent focus:border-primary-500 outline-none',
              )}
            />
          </div>
        </div>
      </DialogBody>
      <DialogActions>
        <Button color="secondary" onClick={onClose}>취소</Button>
        <Button
          color="primary"
          onClick={handleSave}
          disabled={!storeName.trim() || totalAmount <= 0}
        >
          저장
        </Button>
      </DialogActions>
    </Dialog>
  )
}
