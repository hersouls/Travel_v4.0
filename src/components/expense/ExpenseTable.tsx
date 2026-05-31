// ============================================
// ExpenseTable — PC 와이드(xl+) 밀집 경비 테이블
// 정렬 가능 컬럼 + sticky thead/합계 + ₩ 환산 + tabular-nums. 다건 비교에 최적.
// (대용량 가상화는 react-virtual로 후속 최적화 여지)
// ============================================

import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { ArrowUpDown } from 'lucide-react'
import type { Expense } from '@/types'
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/utils/constants'
import { convertToKRW } from '@/services/exchangeRateService'

type SortKey = 'day' | 'date' | 'category' | 'store' | 'amount' | 'krw'

// 환율 있음: convertToKRW(KRW는 항상 환산, 외화 누락 시 null) — null은 ₩ 합계에서 제외해야 통화 혼합 방지
// 환율 없음(오프라인): 원시 금액 그대로(KRW 환산 자체가 불가한 상태)
function krwOf(e: Expense, rates?: Record<string, number> | null): number | null {
  return rates ? convertToKRW(e.totalAmount, e.currency, rates) : e.totalAmount
}

interface ExpenseTableProps {
  expenses: Expense[]
  exchangeRates?: Record<string, number> | null
  onRowClick?: (e: Expense) => void
}

export function ExpenseTable({ expenses, exchangeRates, onRowClick }: ExpenseTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('day')
  const [asc, setAsc] = useState(true)

  const sorted = useMemo(() => {
    const arr = [...expenses]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'day':
          cmp = a.day - b.day || new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          break
        case 'date':
          cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          break
        case 'category':
          cmp = (EXPENSE_CATEGORY_LABELS[a.category] || a.category).localeCompare(
            EXPENSE_CATEGORY_LABELS[b.category] || b.category,
            'ko',
          )
          break
        case 'store':
          cmp = a.storeName.localeCompare(b.storeName, 'ko')
          break
        case 'amount':
          cmp = a.totalAmount - b.totalAmount
          break
        case 'krw':
          cmp = (krwOf(a, exchangeRates) ?? 0) - (krwOf(b, exchangeRates) ?? 0)
          break
      }
      return asc ? cmp : -cmp
    })
    return arr
  }, [expenses, sortKey, asc, exchangeRates])

  const totalKRW = useMemo(() => sorted.reduce((s, e) => s + (krwOf(e, exchangeRates) ?? 0), 0), [sorted, exchangeRates])

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setAsc((v) => !v)
    else {
      setSortKey(k)
      setAsc(true)
    }
  }

  const fmtKRW = (n: number) => `₩${Math.round(n).toLocaleString()}`
  const fmtDate = (e: Expense) => e.receiptDate || new Date(e.timestamp).toISOString().split('T')[0]

  const thBase = 'sticky top-0 z-10 bg-[var(--card)] px-3 py-2 text-xs font-semibold text-zinc-500 border-b border-[var(--border)]'
  const SortTh = ({ k, label, align = 'left' }: { k: SortKey; label: string; align?: 'left' | 'right' }) => (
    <th className={clsx(thBase, align === 'right' ? 'text-right' : 'text-left')}>
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={clsx('inline-flex items-center gap-1 hover:text-[var(--foreground)]', align === 'right' && 'flex-row-reverse')}
      >
        {label}
        <ArrowUpDown className={clsx('size-3', sortKey === k ? 'text-primary-500' : 'text-zinc-300 dark:text-zinc-600')} />
      </button>
    </th>
  )

  return (
    <div className="overflow-auto rounded-xl ring-1 ring-[var(--border)]">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <SortTh k="day" label="Day" />
            <SortTh k="date" label="날짜" />
            <SortTh k="category" label="카테고리" />
            <SortTh k="store" label="상점" />
            <th className={clsx(thBase, 'text-left')}>결제</th>
            <SortTh k="amount" label="금액" align="right" />
            <SortTh k="krw" label="₩ 환산" align="right" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => (
            <tr
              key={e.id}
              onClick={() => onRowClick?.(e)}
              className="cursor-pointer border-b border-[var(--border)]/60 hover:bg-[var(--muted)]/50"
            >
              <td className="px-3 py-2 tabular-nums text-zinc-500">{e.day}</td>
              <td className="px-3 py-2 tabular-nums text-zinc-500">{fmtDate(e)}</td>
              <td className="px-3 py-2">{EXPENSE_CATEGORY_LABELS[e.category] || e.category}</td>
              <td className="max-w-[260px] truncate px-3 py-2 font-medium text-[var(--foreground)]">{e.storeName}</td>
              <td className="px-3 py-2 text-zinc-500">
                {e.paymentMethod ? PAYMENT_METHOD_LABELS[e.paymentMethod] || e.paymentMethod : '-'}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {e.totalAmount.toLocaleString()} {e.currency}
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                {(() => {
                  const k = krwOf(e, exchangeRates)
                  // 환산 불가(환율 누락): ₩로 위장하지 않고 원화폐 그대로 표기
                  return k != null ? fmtKRW(k) : `${e.totalAmount.toLocaleString()} ${e.currency}`
                })()}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="sticky bottom-0 bg-[var(--card)]">
            <td colSpan={6} className="border-t border-[var(--border)] px-3 py-2 text-right text-xs font-semibold text-zinc-500">
              합계 (₩ 환산)
            </td>
            <td className="border-t border-[var(--border)] px-3 py-2 text-right font-bold tabular-nums text-[var(--foreground)]">
              {fmtKRW(totalKRW)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
