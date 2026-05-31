// ============================================
// Travel Expense Page
// Dedicated expense management for a trip
// ============================================

import { PageContainer } from '@/components/layout'
import {
  ExpenseCategorySection,
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
import { useExpenseThumbnails } from '@/hooks/useExpenseThumbnails'
import { useExpenseStore, useExpenses, useExpenseLoading } from '@/stores/expenseStore'
import { useCurrentTrip, useTripLoading, useTripStore } from '@/stores/tripStore'
import { toast } from '@/stores/uiStore'
import type { Expense, ExpenseCategory, ExpenseSubCategory, PaymentMethod } from '@/types'
import { EXPENSE_CATEGORY_LABELS } from '@/utils/constants'
import { getTripDuration } from '@/utils/format'
import { parseDateAsLocal } from '@/utils/timezone'
import { differenceInCalendarDays } from 'date-fns'
import {
  ArrowLeft,
  ArrowUpDown,
  BarChart3,
  ChevronsUpDown,
  Plus,
  Search,
  Wallet,
  WifiOff,
  X,
  Download as DownloadIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const INITIAL_LOAD_COUNT = 3

const categoryPillColors: Record<string, string> = {
  food: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
  transport: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400',
  accommodation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  shopping: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  attraction: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  other: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
}

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
  const [expandedCategories, setExpandedCategories] = useState<Set<ExpenseCategory>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | null>(null)
  const [subCategoryFilter, setSubCategoryFilter] = useState<ExpenseSubCategory | null>(null)
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethod | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [showKRW, setShowKRW] = useState(true)
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false)

  // Exchange rates
  const { rates: exchangeRates, isStale: isRatesStale } = useExchangeRates()

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
  }, [tripId, isLoadingExpenses, expenses.length, importFromTravelLogs])

  const totalDays = useMemo(() => {
    if (!trip) return 0
    return getTripDuration(trip.startDate, trip.endDate)
  }, [trip])

  const {
    tripTotals,
    totalFilteredCount,
    filteredCategoryGroups,
  } = useExpenseView({
    expenses,
    totalDays,
    sortOrder,
    categoryFilter,
    subCategoryFilter,
    searchQuery,
    loadedDayCount: INITIAL_LOAD_COUNT,
    paymentMethodFilter,
  })

  // Thumbnail map for expenses imported from travel logs
  const thumbnailMap = useExpenseThumbnails(expenses)

  // Auto-expand first category with expenses
  useEffect(() => {
    if (filteredCategoryGroups.length > 0 && expandedCategories.size === 0) {
      setExpandedCategories(new Set([filteredCategoryGroups[0].category]))
    }
  }, [filteredCategoryGroups, expandedCategories.size])

  const handleToggleCategory = useCallback((cat: ExpenseCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
  }, [])

  const handleExpandAll = useCallback(() => {
    const allCats = filteredCategoryGroups.map((g) => g.category)
    if (expandedCategories.size === allCats.length) {
      setExpandedCategories(new Set())
    } else {
      setExpandedCategories(new Set(allCats))
    }
  }, [expandedCategories.size, filteredCategoryGroups])

  // Compute current trip day based on today's date.
  // 캘린더 일자 기준(로컬 정오)으로 계산해야 UTC 자정 파싱 + 로컬 now 혼용으로 인한
  // 사용자 타임존별 off-by-one(경비가 잘못된 day로 분류)을 방지한다.
  const currentTripDay = useMemo(() => {
    if (!trip) return 1
    const start = parseDateAsLocal(trip.startDate)
    if (Number.isNaN(start.getTime())) return 1
    const now = new Date()
    const diffDays = differenceInCalendarDays(now, start) + 1
    return Math.max(1, Math.min(diffDays, totalDays || 1))
  }, [trip, totalDays])

  const handleAddExpense = useCallback(
    async (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'tripId' | 'day' | 'timestamp'>) => {
      if (!tripId) return
      await addExpense({
        ...data,
        tripId,
        day: currentTripDay,
        timestamp: new Date().toISOString(),
      })
    },
    [tripId, currentTripDay, addExpense],
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
        expenses={expenses}
        className="mb-4"
        exchangeRates={exchangeRates}
        showKRW={showKRW}
      />

      {/* Stale rates warning */}
      {isRatesStale && exchangeRates && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-400 text-xs">
          <WifiOff className="size-3.5 shrink-0" />
          <span>오프라인 환율 (캐시 데이터 사용 중)</span>
        </div>
      )}

      {/* Budget bar */}
      {trip.budget && (
        <ExpenseBudgetBar
          budget={trip.budget}
          currencyTotals={tripTotals.currencyTotals}
          categoryTotals={tripTotals.categoryTotals}
          exchangeRates={exchangeRates}
          className="mb-4"
        />
      )}

      {/* Control bar */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-[var(--background)] border-b border-zinc-200 dark:border-zinc-800 mb-3">
        <div className="flex items-center justify-between gap-2">
          {/* Category tabs */}
          <div className="flex-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex gap-1" role="tablist" aria-label="카테고리별 경비">
              {filteredCategoryGroups.map(({ category, expenseCount }) => (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  onClick={() => {
                    const el = document.getElementById(`expense-cat-${category}`)
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className={clsx(
                    'flex-shrink-0 px-2.5 py-1 text-xs font-medium rounded-full transition-colors',
                    categoryPillColors[category],
                  )}
                >
                  {EXPENSE_CATEGORY_LABELS[category]}({expenseCount})
                </button>
              ))}
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
              paymentMethodFilter={paymentMethodFilter}
              onPaymentMethodFilterChange={setPaymentMethodFilter}
              resultCount={searchQuery.trim() || categoryFilter || subCategoryFilter || paymentMethodFilter ? totalFilteredCount : undefined}
            />
          </div>
        )}
      </div>

      {/* Category Sections */}
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
          {filteredCategoryGroups.map((group) => (
            <ExpenseCategorySection
              key={group.category}
              group={group}
              isExpanded={expandedCategories.has(group.category)}
              onToggleExpand={() => handleToggleCategory(group.category)}
              tripStartDate={trip.startDate}
              onEdit={(e) => setEditingExpense(e)}
              onDelete={handleDeleteExpense}
              exchangeRates={exchangeRates}
              showKRW={showKRW}
              thumbnailMap={thumbnailMap}
            />
          ))}
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
              try {
                const count = await importFromTravelLogs(tripId)
                if (count > 0) {
                  toast.success(`${count}건의 경비를 가져왔습니다`)
                } else {
                  toast.info('가져올 새 경비가 없습니다')
                }
              } catch (error) {
                console.error('[TravelExpense] Import from logs failed:', error)
                toast.error('기록에서 경비를 가져오지 못했습니다')
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
        expenses={expenses}
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
