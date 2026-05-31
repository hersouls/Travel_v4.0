// ============================================
// Expense Export Button
// CSV / XLSX export for expenses
// ============================================

import { useState, useRef, useEffect } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import type { Expense } from '@/types'
import { generateExpenseCSV, generateExpenseXLSX } from '@/utils/expenseExport'
import { toast } from '@/stores/uiStore'

interface ExpenseExportButtonProps {
  expenses: Expense[]
  tripTitle: string
}

export function ExpenseExportButton({ expenses, tripTitle }: ExpenseExportButtonProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const dateStr = new Date().toISOString().split('T')[0]

  const handleCSV = () => {
    const csv = generateExpenseCSV(expenses)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    download(blob, `${tripTitle}_경비_${dateStr}.csv`)
    setOpen(false)
  }

  const handleXLSX = async () => {
    try {
      const blob = await generateExpenseXLSX(expenses)
      download(blob, `${tripTitle}_경비_${dateStr}.xlsx`)
    } catch (err) {
      console.error('XLSX export failed', err)
      toast.error('Excel 내보내기에 실패했습니다')
    } finally {
      setOpen(false)
    }
  }

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    // Firefox 등은 anchor가 document에 있어야 click이 동작 / 동기 revoke는 다운로드를 중단시킬 수 있음
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="relative" ref={ref}>
      <IconButton
        plain
        color="secondary"
        onClick={() => setOpen(!open)}
        aria-label="내보내기"
        disabled={expenses.length === 0}
      >
        <Download className="size-5" />
      </IconButton>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg py-1 min-w-[140px]">
          <button
            onClick={handleXLSX}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
          >
            <FileSpreadsheet className="size-4 text-green-600" />
            Excel (.xlsx)
          </button>
          <button
            onClick={handleCSV}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
          >
            <FileText className="size-4 text-blue-600" />
            CSV (.csv)
          </button>
        </div>
      )}
    </div>
  )
}
