// ============================================
// Travel Expense Page
// Dedicated expense management for a trip
// ============================================

import { PageContainer } from '@/components/layout'
import {
  ExpenseDaySection,
  ExpenseEditModal,
  ExpenseEntryModal,
  ExpenseFilterBar,
  ExpenseOverview,
  ExpenseBudgetBar,
  ExpenseAnalytics,
  ExpenseExportButton,
} from '@/components/expense'
import { ScrollToTopFAB } from '@/components/travellog/ScrollToTopFAB'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { SpeedDialFAB } from '@/components/ui/SpeedDialFAB'
import { clsx } from 'clsx'
import { useExchangeRates } from '@/hooks/useExchangeRates'
import { useExpenseView } from '@/hooks/useExpenseView'
import type { ExpenseSortOrder } from '@/hooks/useExpenseView'
import { useExpenseStore, useExpenses, useExpenseLoading } from '@/stores/expenseStore'
import { useCurrentTrip, useTripLoading, useTripStore } from '@/stores/tripStore'
import { toast } from '@/stores/uiStore'
import type { Expense, ExpenseCategory, ExpenseSubCategory } from '@/types'
import { getTripDuration } from '@/utils/format'
import { getTripDayDate } from '@/utils/timezone'
import {
  ArrowLeft,
  ArrowUpDown,
  BarChart3,
  ChevronsUpDown,
  Plus,
  Search,
  Wallet,
  X,
  Download as DownloadIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const INITIAL_LOAD_COUNT = 3

export function TravelExpense() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const trip = useCurrentTrip()
  const isLoadingTrip = useTripLoading()
  const loadTrip = useTripStore((s) => s.loadTrip)

  const expenses = useExpenses()
  const isLoadingExpenses = useExpenseLoading()
  const loadExpenses = useExpenseStore((s) => s.loadExpenses)
  const addExpense = useExpenseStore((s) => s.addExpense)
  const updateExpense = useExpenseStore((s) => s.updateExpense)
  const deleteExpense = useExpenseStore((s) => s.deleteExpense)
  const importFromTravelLogs = useExpenseStore((s) => s.importFromTravelLogs)
  const clearExpenses = useExpenseStore((s) => s.clearExpenses)

  // UI state
  const [sortOrder, setSortOrder] = useState<ExpenseSortOrder>('newest')
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())
  const [loadedDayCount, setLoadedDayCount] = useState(INITIAL_LOAD_COUNT)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | null>(null)
  const [subCategoryFilter, setSubCategoryFilter] = useState<ExpenseSubCategory | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [showKRW, setShowKRW] = useState(true)
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false)
  const [activeDay, setActiveDay] = useState(1)

  // Exchange rates
  const { rates: exchangeRates } = useExchangeRates()

  const tripId = id ? Number.parseInt(id) : 0

  // Load trip and expenses
  useEffect(() => {
    if (tripId) {
      loadTrip(tripId)
      loadExpenses(tripId)
    }
    return () => clearExpenses()
  }, [tripId, loadTrip, loadExpenses, clearExpenses])

  // Auto-import from travel logs on first load (after initial load completes)
  const hasAttemptedImport = useRef(false)
  useEffect(() => {
    // Only attempt import after loading finishes with zero results
    if (tripId && !isLoadingExpenses && expenses.length === 0 && !hasAttemptedImport.current) {
      hasAttemptedImport.current = true
      importFromTravelLogs(tripId).then((count) => {
        if (count > 0) {
          toast.success(`여행 기록에서 ${count}건의 경비를 가져왔습니다`)
        }
      }).catch(console.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, isLoadingExpenses])

  const totalDays = useMemo(() => {
    if (!trip) return 0
    return getTripDuration(trip.startDate, trip.endDate)
  }, [trip])

  const {
    sortedDays,
    visibleDays,
    expensesByDay,
    filteredExpensesByDay,
    daySummaries,
    tripTotals,
    hasMoreDays,
    totalFilteredCount,
  } = useExpenseView({
    expenses,
    totalDays,
    sortOrder,
    categoryFilter,
    subCategoryFilter,
    searchQuery,
    loadedDayCount,
  })

  // Auto-expand first day with expenses
  useEffect(() => {
    if (visibleDays.length > 0 && expandedDays.size === 0) {
      const firstDayWithExpenses = visibleDays.find(
        (day) => (filteredExpensesByDay[day]?.length || 0) > 0,
      )
      if (firstDayWithExpenses) {
        setExpandedDays(new Set([firstDayWithExpenses]))
      }
    }
  }, [visibleDays, filteredExpensesByDay, expandedDays.size])

  const handleToggleDay = useCallback((day: number) => {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(day)) {
        next.delete(day)
      } else {
        next.add(day)
      }
      return next
    })
  }, [])

  const handleExpandAll = useCallback(() => {
    if (expandedDays.size === visibleDays.length) {
      setExpandedDays(new Set())
    } else {
      setExpandedDays(new Set(visibleDays))
    }
  }, [expandedDays.size, visibleDays])

  const handleAddExpense = useCallback(
    async (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'tripId' | 'day' | 'timestamp'>) => {
      if (!tripId) return
      await addExpense({
        ...data,
        tripId,
        day: activeDay,
        timestamp: new Date().toISOString(),
      })
    },
    [tripId, activeDay, addExpense],
  )

  const handleEditExpense = useCallback(
    async (expenseId: number, updates: Partial<Expense>) => {
      await updateExpense(expenseId, updates)
    },
    [updateExpense],
  )

  const handleDeleteExpense = useCallback(
    async (expenseId: number) => {
      await deleteExpense(expenseId)
    },
    [deleteExpense],
  )

  const handleLoadMore = useCallback(() => {
    setLoadedDayCount((prev) => prev + 3)
  }, [])

  // Loading states
  if (isLoadingTrip) {
    return (
      <PageContainer>
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-32 w-full mb-4" />
        <Skeleton className="h-24 w-full" />
      </PageContainer>
    )
  }

  if (!trip) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <p className="text-zinc-500">여행을 찾을 수 없습니다</p>
          <Button color="primary" className="mt-4" onClick={() => navigate('/dashboard')}>
            대시보드로 이동
          </Button>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <IconButton plain color="secondary" onClick={() => navigate(`/trips/${trip.id}`)}>
            <ArrowLeft className="size-5" />
          </IconButton>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[var(--foreground)] truncate">여행 경비</h1>
            <p className="text-xs text-zinc-500 truncate">{trip.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            plain
            color="secondary"
            onClick={() => setIsAnalyticsOpen(true)}
            aria-label="분석"
          >
            <BarChart3 className="size-5" />
          </IconButton>
          <ExpenseExportButton expenses={expenses} tripTitle={trip.title} />
        </div>
      </div>

      {/* Overview */}
      <ExpenseOverview
        tripTotals={tripTotals}
        className="mb-4"
        exchangeRates={exchangeRates}
        showKRW={showKRW}
      />

      {/* Budget bar */}
      {trip.budget && (
        <ExpenseBudgetBar
          budget={trip.budget}
          currencyTotals={tripTotals.currencyTotals}
          exchangeRates={exchangeRates}
          className="mb-4"
        />
      )}

      {/* Control bar */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-[var(--background)] border-b border-zinc-200 dark:border-zinc-800 mb-3">
        <div className="flex items-center justify-between gap-2">
          {/* Day tabs */}
          <div className="flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex gap-1">
              {sortedDays.slice(0, loadedDayCount).map((day) => {
                const hasExpenses = (expensesByDay[day]?.length || 0) > 0
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setActiveDay(day)
                      const el = document.getElementById(`expense-day-${day}`)
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                    className={clsx(
                      'flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
                      activeDay === day
                        ? 'bg-primary-500 text-white'
                        : hasExpenses
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-400',
                    )}
                  >
                    D{day}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <IconButton
              plain
              color="secondary"
              onClick={() => setShowSearch(!showSearch)}
              aria-label="검색"
            >
              {showSearch ? <X className="size-4" /> : <Search className="size-4" />}
            </IconButton>
            <IconButton
              plain
              color="secondary"
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              aria-label="정렬"
            >
              <ArrowUpDown className="size-4" />
            </IconButton>
            <IconButton
              plain
              color="secondary"
              onClick={handleExpandAll}
              aria-label="모두 펼치기/접기"
            >
              <ChevronsUpDown className="size-4" />
            </IconButton>
            <button
              type="button"
              onClick={() => setShowKRW(!showKRW)}
              className={clsx(
                'px-2 py-1 text-[10px] font-medium rounded-full transition-colors',
                showKRW
                  ? 'bg-primary-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500',
              )}
            >
              ₩
            </button>
          </div>
        </div>

        {/* Search/Filter bar */}
        {showSearch && (
          <div className="mt-2">
            <ExpenseFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              subCategoryFilter={subCategoryFilter}
              onSubCategoryFilterChange={setSubCategoryFilter}
              resultCount={searchQuery.trim() || categoryFilter || subCategoryFilter ? totalFilteredCount : undefined}
            />
          </div>
        )}
      </div>

      {/* Day Sections */}
      {isLoadingExpenses ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <Card className="text-center py-12">
          <Wallet className="size-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
          <p className="text-zinc-500 dark:text-zinc-400">아직 경비가 없습니다</p>
          <p className="text-xs text-zinc-400 mt-1">+ 버튼으로 경비를 추가하세요</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleDays.map((day) => {
            const dayDate = getTripDayDate(trip.startDate, day)
            const allDayExpenses = expensesByDay[day] || []
            const filtered = filteredExpensesByDay[day] || []

            return (
              <ExpenseDaySection
                key={day}
                day={day}
                date={dayDate}
                expenses={filtered}
                allDayExpenses={allDayExpenses}
                isExpanded={expandedDays.has(day)}
                onToggleExpand={() => handleToggleDay(day)}
                summary={daySummaries[day]}
                onEdit={(e) => setEditingExpense(e)}
                onDelete={handleDeleteExpense}
                exchangeRates={exchangeRates}
                showKRW={showKRW}
              />
            )
          })}

          {/* Load more */}
          {hasMoreDays && (
            <button
              type="button"
              onClick={handleLoadMore}
              className="w-full py-3 text-sm text-primary-600 dark:text-primary-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl transition-colors"
            >
              더 보기
            </button>
          )}
        </div>
      )}

      {/* FAB */}
      <SpeedDialFAB
        actions={[
          {
            id: 'add-expense',
            icon: <Plus className="size-5" />,
            label: '경비 추가',
            onClick: () => setIsEntryModalOpen(true),
          },
          {
            id: 'import-logs',
            icon: <DownloadIcon className="size-5" />,
            label: '기록에서 가져오기',
            onClick: async () => {
              const count = await importFromTravelLogs(tripId)
              if (count > 0) {
                toast.success(`${count}건의 경비를 가져왔습니다`)
              } else {
                toast.info('가져올 새 경비가 없습니다')
              }
            },
          },
        ]}
      />

      <ScrollToTopFAB />

      {/* Modals */}
      <ExpenseEntryModal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        onSubmit={(data) => {
          handleAddExpense(data as Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'tripId' | 'day' | 'timestamp'>)
        }}
        defaultCurrency={expenses[0]?.currency || 'KRW'}
      />

      <ExpenseEditModal
        expense={editingExpense}
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        onSave={handleEditExpense}
      />

      <ExpenseAnalytics
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
        expenses={expenses}
        totalDays={totalDays}
        exchangeRates={exchangeRates}
      />
    </PageContainer>
  )
}
