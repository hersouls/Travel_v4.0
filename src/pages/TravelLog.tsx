// ============================================
// Travel Log Page
// Timeline-based travel recording with photos,
// receipts, memos and expense summaries
// Enhanced: sorting, accordion, search, infinite
// scroll, view modes, minimap
// ============================================

import { PageContainer } from '@/components/layout'
import {
  DayMinimap,
  DaySection,
  EditLogModal,
  ExpenseSummary,
  MemoLogInput,
  PhotoLogUploader,
  ReceiptScanner,
  ScrollToTopFAB,
  SearchFilterBar,
} from '@/components/travellog'
import { AITravelDiary } from '@/components/travellog/AITravelDiary'
import { ExportButton } from '@/components/travellog/ExportButton'
import { LocationGroupView } from '@/components/travellog/LocationGroupView'
import { TripReport } from '@/components/travellog/TripReport'
import { ViewModeToggle } from '@/components/travellog/ViewModeToggle'
import type { ViewMode } from '@/components/travellog/ViewModeToggle'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Lightbox } from '@/components/ui/Lightbox'
import { Skeleton } from '@/components/ui/Skeleton'
import { SpeedDialFAB } from '@/components/ui/SpeedDialFAB'
import { useTravelLogView } from '@/hooks/useTravelLogView'
import type { SortOrder } from '@/hooks/useTravelLogView'
import { reverseGeocode } from '@/services/geocodingService'
import { useTravelLogLoading, useTravelLogStore, useTravelLogs } from '@/stores/travelLogStore'
import { useCurrentTrip, useTripLoading, useTripStore } from '@/stores/tripStore'
import { toast } from '@/stores/uiStore'
import type { ExpenseCategory, TravelLog as TravelLogType } from '@/types'
import { getTripDuration } from '@/utils/format'
import { getTripDayDate } from '@/utils/timezone'
import {
  ArrowLeft,
  ArrowUpDown,
  Camera,
  ChevronsUpDown,
  FileText,
  LayoutGrid,
  Map,
  MapPin,
  Receipt,
  Search,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

type LogFilter = 'all' | 'photo' | 'receipt' | 'memo'

const FILTER_OPTIONS: { value: LogFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'photo', label: '사진' },
  { value: 'receipt', label: '영수증' },
  { value: 'memo', label: '메모' },
]

const INITIAL_LOAD_COUNT = 3

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

  // Core UI state
  const [activeDay, setActiveDay] = useState(1)
  const [activeFilter, setActiveFilter] = useState<LogFilter>('all')
  const [isPhotoOpen, setIsPhotoOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [isMemoOpen, setIsMemoOpen] = useState(false)
  const [editingLog, setEditingLog] = useState<TravelLogType | null>(null)

  // Enhancement state
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())
  const [loadedDayCount, setLoadedDayCount] = useState(INITIAL_LOAD_COUNT)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  const [showSearch, setShowSearch] = useState(false)
  const [groupMode, setGroupMode] = useState<'time' | 'location'>('time')

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const tripId = id ? Number.parseInt(id) : 0

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

  // Use the extracted view hook for all data computation
  const {
    sortedDays,
    visibleDays,
    logsByDay,
    filteredLogsByDay,
    dayExpenses,
    daySummaries,
    hasMoreDays,
    totalFilteredCount,
    dayDistances,
    totalTripDistance,
    uniqueLocationCount,
  } = useTravelLogView({
    logs,
    totalDays,
    sortOrder,
    activeFilter,
    categoryFilter,
    searchQuery,
    loadedDayCount,
  })

  // Initialize expandedDays when logs first load (one-time initialization)
  const initializedRef = useRef(false)
  useEffect(() => {
    if (logs.length > 0 && !initializedRef.current) {
      initializedRef.current = true
      const firstDay = sortOrder === 'newest' ? totalDays : 1
      setExpandedDays(new Set([firstDay]))
      setActiveDay(firstDay)
    }
  }, [logs.length, sortOrder, totalDays])

  // Reset on sort order change
  const handleSortToggle = useCallback(() => {
    setSortOrder((prev) => {
      const next = prev === 'newest' ? 'oldest' : 'newest'
      setLoadedDayCount(INITIAL_LOAD_COUNT)
      const firstDay = next === 'newest' ? totalDays : 1
      setExpandedDays(new Set([firstDay]))
      setActiveDay(firstDay)
      return next
    })
  }, [totalDays])

  // Accordion handlers
  const toggleDay = useCallback((day: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    setExpandedDays(new Set(sortedDays))
  }, [sortedDays])

  const collapseAll = useCallback(() => {
    setExpandedDays(new Set())
  }, [])

  // Day tab click: expand + scroll
  const handleDayTabClick = useCallback(
    (day: number) => {
      setActiveDay(day)
      setExpandedDays((prev) => {
        if (prev.has(day)) return prev
        const next = new Set(prev)
        next.add(day)
        return next
      })
      // Ensure day is loaded
      const dayIndex = sortedDays.indexOf(day)
      if (dayIndex >= loadedDayCount) {
        setLoadedDayCount(dayIndex + 1)
      }
      requestAnimationFrame(() => {
        document
          .getElementById(`log-day-${day}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    },
    [sortedDays, loadedDayCount],
  )

  // Minimap day click
  const handleMinimapDayClick = useCallback(
    (day: number) => {
      handleDayTabClick(day)
    },
    [handleDayTabClick],
  )

  // Handle adding logs (with optional reverse geocoding)
  const handleAddLogs = useCallback(
    async (newLogs: Array<Omit<TravelLogType, 'id' | 'createdAt' | 'updatedAt'>>) => {
      let count = 0
      for (const logData of newLogs) {
        try {
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
    },
    [addLog],
  )

  const handleAddSingleLog = useCallback(
    async (logData: Omit<TravelLogType, 'id' | 'createdAt' | 'updatedAt'>) => {
      await handleAddLogs([logData])
    },
    [handleAddLogs],
  )

  const handleEditLog = useCallback(
    async (id: number, updates: Partial<TravelLogType>) => {
      await updateLog(id, updates)
      toast.success('기록이 수정되었습니다')
    },
    [updateLog],
  )

  const handleDeleteLog = useCallback(
    async (logId: number) => {
      await deleteLog(logId)
    },
    [deleteLog],
  )

  // Lightbox: collect photos from same day and open
  const handlePhotoClick = useCallback(
    (photo: string) => {
      let dayPhotos: string[] = []
      for (const [, dayLogs] of Object.entries(logsByDay)) {
        const photos = dayLogs.filter((l) => l.photo).map((l) => l.photo!)
        if (photos.includes(photo)) {
          dayPhotos = photos
          break
        }
      }
      if (dayPhotos.length === 0) {
        dayPhotos = [photo]
      }
      const idx = dayPhotos.indexOf(photo)
      setLightboxImages(dayPhotos)
      setLightboxIndex(idx >= 0 ? idx : 0)
      setLightboxOpen(true)
    },
    [logsByDay],
  )

  // Load more days
  const handleLoadMore = useCallback(() => {
    setLoadedDayCount((c) => c + INITIAL_LOAD_COUNT)
  }, [])

  // SpeedDial actions
  const fabActions = useMemo(
    () => [
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
    ],
    [],
  )

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
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3">
          <IconButton
            plain
            color="secondary"
            onClick={() => navigate(`/trips/${tripId}`)}
            aria-label="뒤로 가기"
          >
            <ArrowLeft className="size-5" />
          </IconButton>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[var(--foreground)]">여행 기록</h1>
            <p className="text-sm text-zinc-500 truncate">{trip.title}</p>
          </div>
          <TripReport
            logs={logs}
            tripTitle={trip.title}
            totalDays={totalDays}
            startDate={trip.startDate}
          />
          <AITravelDiary logs={logs} tripTitle={trip.title} totalDays={totalDays} />
          <ExportButton logs={logs} tripTitle={trip.title} />
          <IconButton
            plain
            color="secondary"
            onClick={() => navigate(`/trips/${tripId}/log/map`)}
            aria-label="지도 보기"
            title="지도 보기"
          >
            <Map className="size-5" />
          </IconButton>
        </div>

        {/* Expense Summary */}
        <ExpenseSummary
          logs={logs}
          totalTripDistance={totalTripDistance}
          uniqueLocationCount={uniqueLocationCount}
          dayCount={totalDays}
        />

        {/* Sticky Day Tab Bar + Controls */}
        {sortedDays.length > 0 && (
          <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-[var(--background)] border-b border-zinc-200 dark:border-zinc-800">
            {/* Day tabs */}
            <div className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {sortedDays.map((day) => {
                const dayLogs = logsByDay[day] || []
                const dayDate = getTripDayDate(trip.startDate, day)
                const dateLabel = dayDate ? `${dayDate.getMonth() + 1}/${dayDate.getDate()}` : ''
                return (
                  <button
                    type="button"
                    key={day}
                    onClick={() => handleDayTabClick(day)}
                    className={`flex-shrink-0 min-w-[2.75rem] flex flex-col items-center py-1.5 px-1 rounded-xl text-center transition-colors ${
                      activeDay === day
                        ? 'bg-primary-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    <span className="text-sm font-bold leading-tight">{day}</span>
                    {dateLabel && (
                      <span
                        className={`text-[10px] leading-tight ${
                          activeDay === day ? 'text-white/70' : 'text-zinc-400 dark:text-zinc-500'
                        }`}
                      >
                        {dateLabel}
                      </span>
                    )}
                    {dayLogs.length > 0 && (
                      <span
                        className={`text-[10px] leading-tight ${
                          activeDay === day ? 'text-white/60' : 'text-zinc-400 dark:text-zinc-500'
                        }`}
                      >
                        {dayLogs.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Controls row: filters + sort + accordion + view mode */}
            <div className="flex items-center gap-1.5 mt-2">
              {/* Type filter chips */}
              {FILTER_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setActiveFilter(opt.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                    activeFilter === opt.value
                      ? 'bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}

              <div className="flex-1" />

              {/* Sort toggle */}
              <button
                type="button"
                onClick={handleSortToggle}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                title={sortOrder === 'newest' ? '최신순' : '오래된순'}
              >
                <ArrowUpDown className="size-3" />
                <span className="hidden sm:inline">
                  {sortOrder === 'newest' ? '최신순' : '오래된순'}
                </span>
              </button>

              {/* Expand/Collapse all */}
              <button
                type="button"
                onClick={expandedDays.size === sortedDays.length ? collapseAll : expandAll}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                title={expandedDays.size === sortedDays.length ? '모두 접기' : '모두 펼치기'}
              >
                <ChevronsUpDown className="size-3" />
              </button>

              {/* Search toggle */}
              <button
                type="button"
                onClick={() => setShowSearch((p) => !p)}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                  showSearch || searchQuery || categoryFilter
                    ? 'bg-primary-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title="검색"
              >
                <Search className="size-3" />
              </button>

              {/* Grouping mode toggle: time vs location */}
              <button
                type="button"
                onClick={() => setGroupMode((p) => (p === 'time' ? 'location' : 'time'))}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg transition-colors ${
                  groupMode === 'location'
                    ? 'bg-violet-500 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
                title={groupMode === 'time' ? '장소별 보기' : '시간순 보기'}
              >
                <LayoutGrid className="size-3" />
              </button>

              {/* View mode toggle */}
              <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
            </div>
          </div>
        )}

        {/* Search + Category Filter Bar */}
        {showSearch && (
          <SearchFilterBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            resultCount={searchQuery.trim() || categoryFilter ? totalFilteredCount : undefined}
          />
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
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  color="primary"
                  size="sm"
                  onClick={() => setIsPhotoOpen(true)}
                  leftIcon={<Camera className="size-4" />}
                >
                  사진 추가
                </Button>
                <Button
                  color="warning"
                  size="sm"
                  onClick={() => setIsReceiptOpen(true)}
                  leftIcon={<Receipt className="size-4" />}
                >
                  영수증 스캔
                </Button>
                <Button
                  color="success"
                  size="sm"
                  onClick={() => setIsMemoOpen(true)}
                  leftIcon={<FileText className="size-4" />}
                >
                  메모 작성
                </Button>
              </div>
            </div>
          </Card>
        ) : groupMode === 'location' ? (
          <LocationGroupView
            logs={logs}
            onEdit={(log) => setEditingLog(log)}
            onDelete={handleDeleteLog}
            onPhotoClick={handlePhotoClick}
          />
        ) : (
          <div className="space-y-3">
            {visibleDays.map((day) => {
              const dayLogs = filteredLogsByDay[day] || []
              const allDayLogs = logsByDay[day] || []
              const dayDate = getTripDayDate(trip.startDate, day)

              // Skip days with no logs at all (unfiltered)
              if (allDayLogs.length === 0) return null

              return (
                <DaySection
                  key={day}
                  day={day}
                  date={dayDate}
                  logs={dayLogs}
                  allDayLogs={allDayLogs}
                  expenses={dayExpenses[day]}
                  isExpanded={expandedDays.has(day)}
                  onToggleExpand={() => toggleDay(day)}
                  summary={daySummaries[day]}
                  onEdit={(log) => setEditingLog(log)}
                  onDelete={handleDeleteLog}
                  onPhotoClick={handlePhotoClick}
                  viewMode={viewMode}
                  distanceKm={dayDistances.get(day) ? dayDistances.get(day)! / 1000 : undefined}
                />
              )
            })}

            {/* Load More button */}
            {hasMoreDays && (
              <div className="flex justify-center pt-2 pb-4">
                <Button color="secondary" size="sm" onClick={handleLoadMore}>
                  이전 기록 더 보기
                </Button>
              </div>
            )}

            {/* No results message for search/filter */}
            {totalFilteredCount === 0 &&
              (searchQuery.trim() || categoryFilter || activeFilter !== 'all') && (
                <Card padding="lg" className="text-center">
                  <p className="text-sm text-zinc-500">검색 조건에 맞는 기록이 없습니다</p>
                </Card>
              )}
          </div>
        )}
      </div>

      {/* Speed Dial FAB */}
      <SpeedDialFAB actions={fabActions} />

      {/* Scroll to Top FAB */}
      <ScrollToTopFAB />

      {/* Day Minimap (desktop only) */}
      <DayMinimap
        days={visibleDays}
        currentDay={activeDay}
        logsByDay={filteredLogsByDay}
        onDayClick={handleMinimapDayClick}
      />

      {/* Photo Uploader Dialog */}
      <PhotoLogUploader
        open={isPhotoOpen}
        onClose={() => setIsPhotoOpen(false)}
        tripId={tripId}
        tripStartDate={trip.startDate}
        tripEndDate={trip.endDate}
        defaultDay={activeDay}
        totalDays={totalDays}
        tripCountry={trip.country}
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
        tripStartDate={trip.startDate}
        defaultDay={activeDay}
        totalDays={totalDays}
        onComplete={handleAddSingleLog}
      />

      {/* Edit Log Dialog */}
      <EditLogModal
        log={editingLog}
        totalDays={totalDays}
        tripCountry={trip.country}
        onSave={handleEditLog}
        onClose={() => setEditingLog(null)}
      />

      {/* Lightbox */}
      <Lightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </PageContainer>
  )
}
