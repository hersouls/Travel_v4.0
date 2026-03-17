// ============================================
// Expense Entry Modal
// Manual expense input form with quick-entry UX
// ============================================

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Plus, Trash2, Banknote, CreditCard, Coins, ListChecks } from 'lucide-react'
import { clsx } from 'clsx'
import type { Expense, ExpenseCategory, ExpenseItem, ExpenseSubCategory, PaymentMethod } from '@/types'
import { Dialog, DialogTitle, DialogBody, DialogActions } from '@/components/ui/Dialog'
import { Button, IconButton } from '@/components/ui/Button'
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_SUBCATEGORY_LABELS,
  EXPENSE_SUBCATEGORIES,
  CURRENCY_SYMBOLS,
  PAYMENT_METHOD_LABELS,
} from '@/utils/constants'
import { expenseSchema } from '@/lib/validations'

interface ExpenseEntryModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    category: ExpenseCategory
    subCategory?: ExpenseSubCategory
    storeName: string
    memo?: string
    items: ExpenseItem[]
    totalAmount: number
    currency: string
    receiptDate?: string
    paymentMethod?: PaymentMethod
  }) => void
  defaultCurrency?: string
  defaultDay?: number
  /** Existing expenses for auto-suggest */
  expenses?: Expense[]
}

const CATEGORIES: ExpenseCategory[] = ['food', 'transport', 'accommodation', 'shopping', 'attraction', 'other']
const CURRENCIES = Object.keys(CURRENCY_SYMBOLS)
const PAYMENT_METHODS: { key: PaymentMethod; icon: typeof Banknote }[] = [
  { key: 'cash', icon: Banknote },
  { key: 'card', icon: CreditCard },
  { key: 'other', icon: Coins },
]

// ---- Last-used preferences (localStorage) ----
const PREFS_KEY = 'moonwave_expense_prefs'

interface ExpensePrefs {
  category: ExpenseCategory
  currency: string
  paymentMethod: PaymentMethod | ''
}

function loadPrefs(): Partial<ExpensePrefs> {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePrefs(prefs: ExpensePrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch { /* ignore */ }
}

export function ExpenseEntryModal({
  isOpen,
  onClose,
  onSubmit,
  defaultCurrency = 'KRW',
  expenses,
}: ExpenseEntryModalProps) {
  const prefs = useMemo(loadPrefs, [])
  const [category, setCategory] = useState<ExpenseCategory>(prefs.category || 'food')
  const [subCategory, setSubCategory] = useState<ExpenseSubCategory | ''>('')
  const [storeName, setStoreName] = useState('')
  const [memo, setMemo] = useState('')
  const [currency, setCurrency] = useState(prefs.currency || defaultCurrency)
  const [receiptDate, setReceiptDate] = useState('')
  const [items, setItems] = useState<ExpenseItem[]>([{ name: '', amount: 0 }])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(prefs.paymentMethod || '')
  const [detailMode, setDetailMode] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const storeInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Recent store names (deduplicated, max 10, most recent first)
  const recentStores = useMemo(() => {
    if (!expenses?.length) return []
    const seen = new Set<string>()
    const result: string[] = []
    // Sort by timestamp descending
    const sorted = [...expenses].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    for (const e of sorted) {
      const name = e.storeName.trim()
      if (name && !seen.has(name)) {
        seen.add(name)
        result.push(name)
        if (result.length >= 10) break
      }
    }
    return result
  }, [expenses])

  // Filtered suggestions based on current input
  const filteredSuggestions = useMemo(() => {
    if (!storeName.trim()) return recentStores.slice(0, 5)
    const q = storeName.trim().toLowerCase()
    return recentStores.filter(s => s.toLowerCase().includes(q)).slice(0, 5)
  }, [storeName, recentStores])

  // Close suggestions on outside click
  useEffect(() => {
    if (!showSuggestions) return
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        storeInputRef.current && !storeInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSuggestions])

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
      prev.map((item, i) => {
        if (i !== index) return item
        const updated = { ...item }
        if (field === 'name') {
          updated.name = value as string
        } else if (field === 'quantity') {
          updated.quantity = Number(value) || 0
          if (updated.unitPrice) {
            updated.amount = (updated.quantity || 1) * updated.unitPrice
          }
        } else if (field === 'unitPrice') {
          updated.unitPrice = Number(value) || 0
          updated.amount = (updated.quantity || 1) * updated.unitPrice
        } else if (field === 'amount') {
          updated.amount = Number(value) || 0
        }
        return updated
      }),
    )
  }, [])

  const handleSubmit = useCallback(() => {
    if (!storeName.trim() || !isFinite(totalAmount) || totalAmount <= 0) return

    const validItems = items.filter((item) => item.name.trim() && item.amount > 0)
    const finalTotal = validItems.length > 0
      ? validItems.reduce((sum, item) => sum + item.amount, 0)
      : totalAmount

    const finalItems = validItems.length > 0 ? validItems : [{ name: storeName.trim(), amount: finalTotal }]

    // BUG-06: Validate with Zod schema before submitting
    const result = expenseSchema.safeParse({
      category,
      storeName: storeName.trim(),
      totalAmount: finalTotal,
      currency,
      items: finalItems,
      receiptDate: receiptDate || undefined,
      paymentMethod: paymentMethod || undefined,
    })
    if (!result.success) {
      console.warn('[ExpenseEntryModal] Validation failed:', result.error.flatten())
      return
    }

    // Save preferences for next time
    savePrefs({ category, currency, paymentMethod })

    onSubmit({
      category,
      subCategory: subCategory || undefined,
      storeName: storeName.trim(),
      memo: memo.trim() || undefined,
      items: finalItems,
      totalAmount: finalTotal,
      currency,
      receiptDate: receiptDate || undefined,
      paymentMethod: paymentMethod || undefined,
    })

    // Reset form (keep remembered prefs)
    setSubCategory('')
    setStoreName('')
    setMemo('')
    setItems([{ name: '', amount: 0 }])
    setReceiptDate('')
    setDetailMode(false)
    setShowSuggestions(false)
    onClose()
  }, [category, subCategory, storeName, memo, items, totalAmount, currency, receiptDate, paymentMethod, onSubmit, onClose])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleSelectSuggestion = useCallback((name: string) => {
    setStoreName(name)
    setShowSuggestions(false)
    // Auto-fill category from the most recent expense with this store
    if (expenses) {
      const match = expenses.find(e => e.storeName === name)
      if (match) {
        setCategory(match.category)
        if (match.subCategory) setSubCategory(match.subCategory)
        if (match.paymentMethod) setPaymentMethod(match.paymentMethod)
        setCurrency(match.currency)
      }
    }
  }, [expenses])

  const inputClass = clsx(
    'bg-zinc-100 dark:bg-zinc-800 text-[var(--foreground)]',
    'border border-transparent focus:border-primary-500 outline-none',
  )

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>경비 추가</DialogTitle>
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

          {/* Store name with auto-suggest */}
          <div className="relative">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">상점명</label>
            <input
              ref={storeInputRef}
              type="text"
              value={storeName}
              onChange={(e) => { setStoreName(e.target.value); setShowSuggestions(true) }}
              onFocus={() => { if (recentStores.length > 0) setShowSuggestions(true) }}
              placeholder="상점 또는 결제처"
              className={clsx(
                'w-full px-3 py-2 text-sm rounded-lg',
                inputClass,
                'focus:ring-1 focus:ring-primary-500',
              )}
              autoComplete="off"
            />
            {/* Suggestions dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden"
              >
                {filteredSuggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleSelectSuggestion(name)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 text-[var(--foreground)] transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Currency + Date row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">통화</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={clsx('w-full px-3 py-2 text-sm rounded-lg', inputClass)}
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
                className={clsx('w-full px-3 py-2 text-sm rounded-lg', inputClass)}
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">결제 수단</label>
            <div className="flex gap-1.5">
              {PAYMENT_METHODS.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPaymentMethod(paymentMethod === key ? '' : key)}
                  className={clsx(
                    'flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
                    paymentMethod === key
                      ? key === 'cash'
                        ? 'bg-emerald-500 text-white'
                        : key === 'card'
                          ? 'bg-blue-500 text-white'
                          : 'bg-zinc-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
                  )}
                >
                  <Icon className="size-3" />
                  {PAYMENT_METHOD_LABELS[key]}
                </button>
              ))}
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">항목</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailMode(!detailMode)}
                  className={clsx(
                    'flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors',
                    detailMode
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300',
                  )}
                >
                  <ListChecks className="size-3" />
                  상세
                </button>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-0.5 text-xs text-primary-600 dark:text-primary-400 hover:underline flex-shrink-0"
                >
                  <Plus className="size-3" />추가
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                    placeholder="항목명"
                    className={clsx(
                      'flex-1 min-w-0 px-2.5 py-1.5 text-sm rounded-lg',
                      inputClass,
                    )}
                  />
                  {detailMode ? (
                    <>
                      <input
                        type="number"
                        value={item.quantity || ''}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        placeholder="수량"
                        min="1"
                        className={clsx(
                          'w-14 flex-shrink-0 px-1.5 py-1.5 text-sm rounded-lg text-center',
                          inputClass,
                        )}
                      />
                      <span className="text-xs text-zinc-400 flex-shrink-0">&times;</span>
                      <input
                        type="number"
                        value={item.unitPrice || ''}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                        placeholder="단가"
                        className={clsx(
                          'w-20 flex-shrink-0 px-1.5 py-1.5 text-sm rounded-lg text-right',
                          inputClass,
                        )}
                      />
                      <span className="text-xs text-zinc-400 flex-shrink-0">=</span>
                      <span className="w-16 flex-shrink-0 text-sm text-right font-medium text-[var(--foreground)]">
                        {(item.amount || 0).toLocaleString()}
                      </span>
                    </>
                  ) : (
                    <input
                      type="number"
                      value={item.amount || ''}
                      onChange={(e) => handleItemChange(idx, 'amount', e.target.value)}
                      placeholder="금액"
                      className={clsx(
                        'w-20 sm:w-24 flex-shrink-0 px-2 py-1.5 text-sm rounded-lg text-right',
                        inputClass,
                      )}
                    />
                  )}
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
              {CURRENCY_SYMBOLS[currency] || ''}{Math.round(totalAmount).toLocaleString()}
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
                inputClass,
              )}
            />
          </div>
        </div>
      </DialogBody>
      <DialogActions>
        <Button color="secondary" onClick={handleClose}>취소</Button>
        <Button
          color="primary"
          onClick={handleSubmit}
          disabled={!storeName.trim() || totalAmount <= 0}
        >
          추가
        </Button>
      </DialogActions>
    </Dialog>
  )
}
