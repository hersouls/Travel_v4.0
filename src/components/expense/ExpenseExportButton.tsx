// ============================================
// Expense Export Button
// CSV export for expenses
// ============================================

import { Download } from 'lucide-react'
import { IconButton } from '@/components/ui/Button'
import type { Expense } from '@/types'
import { generateExpenseCSV } from '@/utils/expenseExport'

interface ExpenseExportButtonProps {
  expenses: Expense[]
  tripTitle: string
}

export function ExpenseExportButton({ expenses, tripTitle }: ExpenseExportButtonProps) {
  const handleExport = () => {
    if (expenses.length === 0) return

    const csv = generateExpenseCSV(expenses)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${tripTitle}_경비_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <IconButton
      plain
      color="secondary"
      onClick={handleExport}
      aria-label="CSV 내보내기"
      disabled={expenses.length === 0}
    >
      <Download className="size-5" />
    </IconButton>
  )
}
