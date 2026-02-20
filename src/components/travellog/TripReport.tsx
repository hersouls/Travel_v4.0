// ============================================
// Trip Report Component
// Full summary report with stats, highlights,
// and image export capability
// ============================================

import { Button, IconButton } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { toast } from '@/stores/uiStore'
import type { ExpenseCategory, TravelLog } from '@/types'
import { CURRENCY_SYMBOLS, EXPENSE_CATEGORY_LABELS } from '@/utils/constants'
import {
  calculateTripDistance,
  countUniqueLocations,
  formatDistance,
} from '@/utils/distanceCalculation'
import { BarChart3, Camera, Copy, Download, MapPin, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

interface TripReportProps {
  logs: TravelLog[]
  tripTitle: string
  totalDays: number
  startDate: string
}

export function TripReport({ logs, tripTitle, totalDays, startDate }: TripReportProps) {
  const [open, setOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  // Stats calculations
  const photoCount = logs.filter((l) => l.type === 'photo').length
  const receiptCount = logs.filter((l) => l.type === 'receipt').length
  const memoCount = logs.filter((l) => l.type === 'memo').length
  const { totalMeters, dayDistances } = calculateTripDistance(logs)
  const uniqueLocations = countUniqueLocations(logs)

  // Expense summary
  const expenseByCurrency = new Map<string, number>()
  const expenseByCategory = new Map<ExpenseCategory, number>()
  for (const log of logs) {
    if (log.expense) {
      const curr = log.expense.currency
      expenseByCurrency.set(curr, (expenseByCurrency.get(curr) || 0) + log.expense.totalAmount)
      expenseByCategory.set(
        log.expense.category,
        (expenseByCategory.get(log.expense.category) || 0) + log.expense.totalAmount,
      )
    }
  }

  // Day highlights (representative photo + top place per day)
  const dayHighlights: Array<{
    day: number
    photo?: string
    placeName?: string
    logCount: number
  }> = []
  for (let d = 1; d <= totalDays; d++) {
    const dayLogs = logs.filter((l) => l.day === d)
    if (dayLogs.length === 0) continue
    const firstPhoto = dayLogs.find((l) => l.type === 'photo' && l.photo)
    const placeName = dayLogs.find((l) => l.placeName)?.placeName
    dayHighlights.push({
      day: d,
      photo: firstPhoto?.thumbnailPhoto || firstPhoto?.photo,
      placeName,
      logCount: dayLogs.length,
    })
  }

  const handleExportImage = useCallback(async () => {
    if (!reportRef.current) return
    setIsExporting(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      })
      const link = document.createElement('a')
      link.download = `${tripTitle || 'trip-report'}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      toast.success('리포트 이미지가 저장되었습니다')
    } catch (err) {
      console.error('[TripReport] Export failed:', err)
      toast.error('이미지 저장에 실패했습니다')
    } finally {
      setIsExporting(false)
    }
  }, [tripTitle])

  const handleCopyText = useCallback(() => {
    const lines = [
      `📍 ${tripTitle} 여행 리포트`,
      `📅 ${startDate} | ${totalDays}일`,
      '',
      '📊 기록 요약',
      `  총 기록: ${logs.length}개 (사진 ${photoCount} / 영수증 ${receiptCount} / 메모 ${memoCount})`,
      `  방문 장소: ${uniqueLocations}곳`,
      `  총 이동거리: ${formatDistance(totalMeters)}`,
    ]

    if (expenseByCurrency.size > 0) {
      lines.push('', '💰 소비 요약')
      for (const [currency, amount] of expenseByCurrency) {
        const symbol = CURRENCY_SYMBOLS[currency] || currency
        lines.push(`  ${symbol}${amount.toLocaleString()}`)
      }
    }

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      toast.success('리포트가 클립보드에 복사되었습니다')
    })
  }, [
    tripTitle,
    startDate,
    totalDays,
    logs.length,
    photoCount,
    receiptCount,
    memoCount,
    uniqueLocations,
    totalMeters,
    expenseByCurrency,
  ])

  return (
    <>
      <IconButton
        plain
        color="secondary"
        onClick={() => setOpen(true)}
        aria-label="여행 리포트"
        title="여행 리포트"
      >
        <BarChart3 className="size-5" />
      </IconButton>

      <Dialog open={open} onClose={() => setOpen(false)} size="lg">
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--foreground)]">여행 리포트</h2>
            <div className="flex items-center gap-1">
              <IconButton
                plain
                color="secondary"
                onClick={handleCopyText}
                aria-label="텍스트 복사"
                title="텍스트 복사"
              >
                <Copy className="size-4" />
              </IconButton>
              <Button
                size="sm"
                color="primary"
                onClick={handleExportImage}
                disabled={isExporting}
                leftIcon={<Download className="size-3.5" />}
              >
                {isExporting ? '저장 중...' : '이미지 저장'}
              </Button>
              <IconButton plain color="secondary" onClick={() => setOpen(false)} aria-label="닫기">
                <X className="size-5" />
              </IconButton>
            </div>
          </div>

          {/* Report content (capturable) */}
          <div ref={reportRef} className="space-y-4 bg-white dark:bg-zinc-900 rounded-xl p-4">
            {/* Title card */}
            <div className="text-center pb-3 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{tripTitle}</h3>
              <p className="text-sm text-zinc-500 mt-1">
                {startDate} | {totalDays}일간의 여행
              </p>
            </div>

            {/* Summary stats grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {logs.length}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">총 기록</div>
              </div>
              <div className="text-center p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                  {uniqueLocations}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">방문 장소</div>
              </div>
              <div className="text-center p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatDistance(totalMeters)}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">총 이동</div>
              </div>
            </div>

            {/* Type breakdown */}
            <div className="flex justify-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-primary-600 dark:text-primary-400">
                <Camera className="size-3.5" /> 사진 {photoCount}
              </span>
              <span className="flex items-center gap-1 text-warning-600 dark:text-warning-400">
                📄 영수증 {receiptCount}
              </span>
              <span className="flex items-center gap-1 text-success-600 dark:text-success-400">
                📝 메모 {memoCount}
              </span>
            </div>

            {/* Expense summary */}
            {expenseByCurrency.size > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  소비 요약
                </h4>
                <div className="flex flex-wrap gap-2">
                  {[...expenseByCurrency.entries()].map(([currency, amount]) => {
                    const symbol = CURRENCY_SYMBOLS[currency] || currency
                    return (
                      <div
                        key={currency}
                        className="px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg"
                      >
                        <span className="text-sm font-bold text-orange-700 dark:text-orange-400">
                          {symbol}
                          {amount.toLocaleString()}
                        </span>
                      </div>
                    )
                  })}
                </div>
                {expenseByCategory.size > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {[...expenseByCategory.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, amount]) => (
                        <span key={cat} className="text-xs text-zinc-500 dark:text-zinc-400">
                          {EXPENSE_CATEGORY_LABELS[cat]} {amount.toLocaleString()}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Day-by-day distances */}
            {dayDistances.size > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  일별 이동거리
                </h4>
                <div className="space-y-1">
                  {[...dayDistances.entries()]
                    .sort((a, b) => a[0] - b[0])
                    .map(([day, meters]) => {
                      const maxDist = Math.max(...dayDistances.values())
                      const pct = maxDist > 0 ? (meters / maxDist) * 100 : 0
                      return (
                        <div key={day} className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 w-10 flex-shrink-0">
                            Day {day}
                          </span>
                          <div className="flex-1 h-4 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-400 dark:bg-primary-600 rounded-full transition-all"
                              style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500 w-14 text-right flex-shrink-0">
                            {formatDistance(meters)}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Day highlights */}
            {dayHighlights.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  일별 하이라이트
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {dayHighlights.map((h) => (
                    <div
                      key={h.day}
                      className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700"
                    >
                      {h.photo ? (
                        <img
                          src={h.photo}
                          alt={`Day ${h.day}`}
                          className="w-full h-24 object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-24 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                          <MapPin className="size-6 text-zinc-300" />
                        </div>
                      )}
                      <div className="p-2">
                        <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                          Day {h.day}
                        </div>
                        {h.placeName && (
                          <div className="text-[10px] text-zinc-500 truncate">{h.placeName}</div>
                        )}
                        <div className="text-[10px] text-zinc-400">{h.logCount}개 기록</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="text-center text-[10px] text-zinc-300 dark:text-zinc-600 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              Generated by TravelLog
            </div>
          </div>
        </div>
      </Dialog>
    </>
  )
}
