// ============================================
// Travel Log Page
// Timeline-based travel recording with photos,
// receipts, memos and expense summaries
// ============================================

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, Receipt, FileText, MapPin } from 'lucide-react'
import { PageContainer } from '@/components/layout'
import { Card } from '@/components/ui/Card'
import { Button, IconButton } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { SpeedDialFAB } from '@/components/ui/SpeedDialFAB'
import {
  PhotoLogUploader,
  ReceiptScanner,
  MemoLogInput,
  TimelineCard,
  ExpenseSummary,
  EditLogModal,
} from '@/components/travellog'
import { useCurrentTrip, useTripLoading, useTripStore } from '@/stores/tripStore'
import { useTravelLogStore, useTravelLogs, useTravelLogLoading } from '@/stores/travelLogStore'
import { toast } from '@/stores/uiStore'
import { reverseGeocode } from '@/services/geocodingService'
import { getTripDuration } from '@/utils/format'
import { getTripDayDate } from '@/utils/timezone'
import type { TravelLog as TravelLogType } from '@/types'

export function TravelLog() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const trip = useCurrentTrip()
  const isLoadingTrip = useTripLoading()
  const loadTrip = useTripStore((s) => s.loadTrip)

  const logs = useTravelLogs()
  const isLoadingLogs = useTravelLogLoading()
  const loadLogs = useTravelLogStore((s) => s.loadLogs)
  const addLog = useTravelLogStore((s) => s.addLog)
  const updateLog = useTravelLogStore((s) => s.updateLog)
  const deleteLog = useTravelLogStore((s) => s.deleteLog)
  const clearLogs = useTravelLogStore((s) => s.clearLogs)

  const [activeDay, setActiveDay] = useState(1)
  const [isPhotoOpen, setIsPhotoOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isMemoOpen, setIsMemoOpen] = useState(false)
  const [editingLog, setEditingLog] = useState<TravelLogType | null>(null)

  const tripId = id ? parseInt(id) : 0

  // Load trip and logs
  useEffect(() => {
    if (tripId) {
      loadTrip(tripId)
      loadLogs(tripId)
    }
    return () => clearLogs()
  }, [tripId, loadTrip, loadLogs, clearLogs])

  const totalDays = useMemo(() => {
    if (!trip) return 1
    return getTripDuration(trip.startDate, trip.endDate)
  }, [trip])

  const days = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => i + 1)
  }, [totalDays])

  // Group logs by day
  const logsByDay = useMemo(() => {
    const grouped: Record<number, TravelLogType[]> = {}
    for (const log of logs) {
      if (!grouped[log.day]) grouped[log.day] = []
      grouped[log.day].push(log)
    }
    // Sort by timestamp within each day
    for (const day of Object.keys(grouped)) {
      grouped[parseInt(day)].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
    }
    return grouped
  }, [logs])

  // Day expense subtotals
  const dayExpenses = useMemo(() => {
    const result: Record<number, Record<string, number>> = {}
    for (const log of logs) {
      if (log.type !== 'receipt' || !log.expense) continue
      if (!result[log.day]) result[log.day] = {}
      const { currency, totalAmount } = log.expense
      result[log.day][currency] = (result[log.day][currency] || 0) + totalAmount
    }
    return result
  }, [logs])

  // Handle adding logs (with optional reverse geocoding)
  const handleAddLogs = useCallback(async (newLogs: Array<Omit<TravelLogType, 'id' | 'createdAt' | 'updatedAt'>>) => {
    let count = 0
    for (const logData of newLogs) {
      try {
        // Attempt reverse geocoding if coordinates available but no address
        let address = logData.address
        if (!address && logData.latitude && logData.longitude) {
          try {
            address = (await reverseGeocode(logData.latitude, logData.longitude)) || undefined
          } catch {
            // geocoding failure is non-critical
          }
        }
        await addLog({ ...logData, address })
        count++
      } catch (err) {
        console.error('[TravelLog] Failed to add log:', err)
      }
    }
    if (count > 0) {
      toast.success(`${count}개 기록이 추가되었습니다`)
    }
  }, [addLog])

  const handleAddSingleLog = useCallback(async (logData: Omit<TravelLogType, 'id' | 'createdAt' | 'updatedAt'>) => {
    await handleAddLogs([logData])
  }, [handleAddLogs])

  const handleEditLog = useCallback(async (id: number, updates: Partial<TravelLogType>) => {
    await updateLog(id, updates)
    toast.success('기록이 수정되었습니다')
  }, [updateLog])

  const handleDeleteLog = useCallback(async (logId: number) => {
    await deleteLog(logId)
  }, [deleteLog])

  // SpeedDial actions
  const fabActions = useMemo(() => [
    {
      id: 'memo',
      icon: <FileText className="size-5" />,
      label: '메모',
      onClick: () => setIsMemoOpen(true),
      color: 'bg-success-500 text-white hover:bg-success-400',
    },
    {
      id: 'receipt',
      icon: <Receipt className="size-5" />,
      label: '영수증',
      onClick: () => setIsReceiptOpen(true),
      color: 'bg-warning-500 text-white hover:bg-warning-400',
    },
    {
      id: 'photo',
      icon: <Camera className="size-5" />,
      label: '사진',
      onClick: () => setIsPhotoOpen(true),
      color: 'bg-primary-500 text-white hover:bg-primary-400',
    },
  ], [])

  if (isLoadingTrip) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton height={60} className="rounded-xl" />
          <Skeleton height={200} className="rounded-xl" />
        </div>
      </PageContainer>
    )
  }

  if (!trip) {
    return (
      <PageContainer>
        <Card padding="lg" className="text-center">
          <MapPin className="size-12 mx-auto text-zinc-300 mb-4" />
          <h2 className="text-lg font-semibold mb-2">여행을 찾을 수 없습니다</h2>
          <Button to="/dashboard" color="primary">
            대시보드로 이동
          </Button>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <IconButton plain color="secondary" onClick={() => navigate(-1)} aria-label="뒤로 가기">
            <ArrowLeft className="size-5" />
          </IconButton>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[var(--foreground)]">여행 기록</h1>
            <p className="text-sm text-zinc-500 truncate">{trip.title}</p>
          </div>
        </div>

        {/* Expense Summary */}
        <ExpenseSummary logs={logs} />

        {/* Sticky Day Tab Bar */}
        {days.length > 0 && (
          <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-[var(--background)] border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {days.map((day) => {
                const dayLogs = logsByDay[day] || []
                return (
                  <button
                    key={day}
                    onClick={() => {
                      setActiveDay(day)
                      document.getElementById(`log-day-${day}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className={`flex-shrink-0 min-w-[2.75rem] flex flex-col items-center py-1.5 px-1 rounded-xl text-center transition-colors ${
                      activeDay === day
                        ? 'bg-primary-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    <span className="text-sm font-bold leading-tight">{day}</span>
                    {dayLogs.length > 0 && (
                      <span className={`text-[10px] leading-tight ${
                        activeDay === day ? 'text-white/70' : 'text-zinc-400 dark:text-zinc-500'
                      }`}>
                        {dayLogs.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Day Sections */}
        {isLoadingLogs ? (
          <div className="space-y-4">
            <Skeleton height={100} className="rounded-xl" />
            <Skeleton height={150} className="rounded-xl" />
          </div>
        ) : logs.length === 0 ? (
          <Card padding="lg" className="text-center">
            <div className="py-8 max-w-sm mx-auto">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 bg-primary-100 dark:bg-primary-950/50 rounded-full" />
                <Camera className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-10 text-primary-500" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                아직 기록이 없습니다
              </h3>
              <p className="text-zinc-500 mb-6 text-sm">
                사진, 영수증, 메모를 추가하여 여행을 기록해보세요.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-8">
            {days.map((day) => {
              const dayLogs = logsByDay[day] || []
              const dayDate = getTripDayDate(trip.startDate, day)
              const expenses = dayExpenses[day]

              if (dayLogs.length === 0) return null

              return (
                <div key={day} id={`log-day-${day}`} style={{ scrollMarginTop: '3.5rem' }}>
                  {/* Day header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--foreground)]">
                        Day {day}
                      </h2>
                      <p className="text-xs text-zinc-500">
                        {dayDate.toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </p>
                    </div>
                    {expenses && (
                      <div className="text-right">
                        {Object.entries(expenses).map(([currency, amount]) => {
                          const symbol = currency === 'KRW' ? '₩' : currency === 'JPY' ? '¥' : currency === 'USD' ? '$' : currency
                          return (
                            <p key={currency} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                              {['KRW', 'JPY', 'VND'].includes(currency)
                                ? `${symbol}${amount.toLocaleString()}`
                                : `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                              }
                            </p>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Timeline cards */}
                  <div>
                    {dayLogs.map((log) => (
                      <TimelineCard
                        key={log.id}
                        log={log}
                        onEdit={(log) => setEditingLog(log)}
                        onDelete={handleDeleteLog}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Speed Dial FAB */}
      <SpeedDialFAB actions={fabActions} />

      {/* Photo Uploader Dialog */}
      <PhotoLogUploader
        open={isPhotoOpen}
        onClose={() => setIsPhotoOpen(false)}
        tripId={tripId}
        tripStartDate={trip.startDate}
        tripEndDate={trip.endDate}
        defaultDay={activeDay}
        totalDays={totalDays}
        onComplete={handleAddLogs}
      />

      {/* Receipt Scanner Dialog */}
      <ReceiptScanner
        open={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        tripId={tripId}
        defaultDay={activeDay}
        totalDays={totalDays}
        onComplete={handleAddSingleLog}
      />

      {/* Memo Input Dialog */}
      <MemoLogInput
        open={isMemoOpen}
        onClose={() => setIsMemoOpen(false)}
        tripId={tripId}
        defaultDay={activeDay}
        totalDays={totalDays}
        onComplete={handleAddSingleLog}
      />

      {/* Edit Log Dialog */}
      <EditLogModal
        log={editingLog}
        totalDays={totalDays}
        onSave={handleEditLog}
        onClose={() => setEditingLog(null)}
      />
    </PageContainer>
  )
}
