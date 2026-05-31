// ============================================
// Expense Export Utility (CSV + XLSX)
// ============================================

import type { Expense } from '@/types'
import { EXPENSE_CATEGORY_LABELS, EXPENSE_SUBCATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/utils/constants'

// CSV/Excel 수식 인젝션(CWE-1236) 방지: 수식 트리거 문자로 시작하는 셀을
// 작은따옴표로 무력화하여 스프레드시트가 텍스트로 처리하게 한다.
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/
function sanitizeCell(value: string): string {
  return FORMULA_TRIGGERS.test(value) ? `'${value}` : value
}

function escapeCSV(value: string): string {
  const v = sanitizeCell(value)
  if (v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
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
    '결제수단',
    '메모',
    '주소',
  ]

  const rows = expenses
    .sort((a, b) => a.day - b.day || new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((e) => {
      const date = new Date(e.timestamp)
      const dateStr = e.receiptDate || date.toISOString().split('T')[0]
      const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
      const itemsStr = e.items.map((i) => `${i.name}(${Math.round(i.amount)})`).join('; ')

      return [
        String(e.day),
        dateStr,
        timeStr,
        escapeCSV(EXPENSE_CATEGORY_LABELS[e.category] || e.category),
        escapeCSV(e.subCategory ? (EXPENSE_SUBCATEGORY_LABELS[e.subCategory] || e.subCategory) : ''),
        escapeCSV(e.storeName),
        escapeCSV(itemsStr),
        String(e.totalAmount),
        escapeCSV(e.currency),
        escapeCSV(e.paymentMethod ? (PAYMENT_METHOD_LABELS[e.paymentMethod] || e.paymentMethod) : ''),
        escapeCSV(e.memo || ''),
        escapeCSV(e.address || ''),
      ].join(',')
    })

  // FIX-05: UTF-8 BOM for Excel Korean character support
  return '\ufeff' + [headers.join(','), ...rows].join('\n')
}

function expenseToRow(e: Expense) {
  const date = new Date(e.timestamp)
  return {
    'Day': e.day,
    '날짜': e.receiptDate || date.toISOString().split('T')[0],
    '시간': date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
    '카테고리': sanitizeCell(EXPENSE_CATEGORY_LABELS[e.category] || e.category),
    '세부카테고리': sanitizeCell(e.subCategory ? (EXPENSE_SUBCATEGORY_LABELS[e.subCategory] || e.subCategory) : ''),
    '상점명': sanitizeCell(e.storeName),
    '항목': sanitizeCell(e.items.map((i) => `${i.name}(${i.amount})`).join('; ')),
    '금액': e.totalAmount,
    '통화': sanitizeCell(e.currency),
    '결제수단': sanitizeCell(e.paymentMethod ? (PAYMENT_METHOD_LABELS[e.paymentMethod] || e.paymentMethod) : ''),
    '메모': sanitizeCell(e.memo || ''),
    '주소': sanitizeCell(e.address || ''),
  }
}

export async function generateExpenseXLSX(expenses: Expense[]): Promise<Blob> {
  const XLSX = await import('xlsx')
  const sorted = [...expenses].sort(
    (a, b) => a.day - b.day || new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )
  const rows = sorted.map(expenseToRow)

  const ws = XLSX.utils.json_to_sheet(rows)

  // Column widths for readability
  ws['!cols'] = [
    { wch: 5 },   // Day
    { wch: 12 },  // 날짜
    { wch: 8 },   // 시간
    { wch: 10 },  // 카테고리
    { wch: 12 },  // 세부카테고리
    { wch: 20 },  // 상점명
    { wch: 30 },  // 항목
    { wch: 12 },  // 금액
    { wch: 6 },   // 통화
    { wch: 10 },  // 결제수단
    { wch: 20 },  // 메모
    { wch: 30 },  // 주소
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '경비 내역')

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
