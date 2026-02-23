// ============================================
// Expense CSV Export Utility
// ============================================

import type { Expense } from '@/types'
import { EXPENSE_CATEGORY_LABELS, EXPENSE_SUBCATEGORY_LABELS } from '@/utils/constants'

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function generateExpenseCSV(expenses: Expense[]): string {
  const headers = [
    'Day',
    '날짜',
    '시간',
    '카테고리',
    '세부카테고리',
    '상점명',
    '항목',
    '금액',
    '통화',
    '메모',
    '주소',
  ]

  const rows = expenses
    .sort((a, b) => a.day - b.day || new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((e) => {
      const date = new Date(e.timestamp)
      const dateStr = e.receiptDate || date.toISOString().split('T')[0]
      const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
      const itemsStr = e.items.map((i) => `${i.name}(${i.amount})`).join('; ')

      return [
        String(e.day),
        dateStr,
        timeStr,
        EXPENSE_CATEGORY_LABELS[e.category] || e.category,
        e.subCategory ? (EXPENSE_SUBCATEGORY_LABELS[e.subCategory] || e.subCategory) : '',
        escapeCSV(e.storeName),
        escapeCSV(itemsStr),
        String(e.totalAmount),
        e.currency,
        escapeCSV(e.memo || ''),
        escapeCSV(e.address || ''),
      ].join(',')
    })

  return [headers.join(','), ...rows].join('\n')
}
