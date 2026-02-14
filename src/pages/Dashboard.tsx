import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, MapPin, Calendar, Star, ChevronRight, RefreshCw, Trash2, X, CheckSquare } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageContainer } from '@/components/layout'
import { OnboardingModal } from '@/components/OnboardingModal'
import { useTrips, useTripLoading, useTripStore } from '@/stores/tripStore'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { toast } from '@/stores/uiStore'
import { formatDateRange, getTripDuration } from '@/utils/format'

export function Dashboard() {
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('q') || ''
  const trips = useTrips()
  const isLoading = useTripLoading()
  const toggleFavorite = useTripStore((state) => state.toggleFavorite)
  const deleteTrips = useTripStore((state) => state.deleteTrips)

  // Bulk selection
  const bulk = useBulkSelection<number>()

  // Pull-to-refresh for mobile
  const { pullDistance, isRefreshing: isPullRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      await useTripStore.getState().loadTrips()
    },
  })

  // Filter trips based on search query
  const filteredTrips = useMemo(() => {
    if (!searchQuery) return trips
    const query = searchQuery.toLowerCase()
    return trips.filter(
      (trip) =>
        trip.title.toLowerCase().includes(query) ||
        trip.country.toLowerCase().includes(query)
    )
  }, [trips, searchQuery])

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date()
    const upcoming = trips.filter((t) => new Date(t.startDate) > now).length
    const totalPlans = trips.reduce((sum, t) => sum + (t.plansCount || 0), 0)
    return { total: trips.length, upcoming, totalPlans }
  }, [trips])

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" height={100} />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} variant="rectangular" height={200} />
            ))}
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <OnboardingModal />

      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isPullRefreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all"
          style={{ height: pullDistance || (isPullRefreshing ? 40 : 0) }}
        >
          <RefreshCw className={`size-5 text-primary-500 ${isPullRefreshing ? 'animate-spin' : ''}`} />
        </div>
      )}

      <div className="space-y-6 animate-fade-in">
      {/* Bulk Action Bar */}
      {bulk.isSelectionMode && (
        <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-950/30 rounded-lg border border-primary-200 dark:border-primary-800">
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
            {bulk.count}개 선택됨
          </span>
          <div className="flex-1" />
          <Button
            size="sm"
            color="secondary"
            outline
            onClick={() => bulk.selectAll(filteredTrips.map((t) => t.id!).filter(Boolean))}
          >
            전체 선택
          </Button>
          <Button
            size="sm"
            color="danger"
            leftIcon={<Trash2 className="size-3.5" />}
            onClick={async () => {
              if (confirm(`${bulk.count}개 여행을 삭제하시겠습니까?`)) {
                await deleteTrips(bulk.selectedIds)
                toast.success(`${bulk.count}개 여행이 삭제되었습니다`)
                bulk.clearSelection()
              }
            }}
          >
            삭제
          </Button>
          <button onClick={bulk.clearSelection} className="p-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">내 여행</h1>
          {searchQuery && (
            <p className="text-sm text-zinc-500 mt-1">
              "{searchQuery}" 검색 결과: {filteredTrips.length}개
            </p>
          )}
        </div>
        {filteredTrips.length > 0 && !bulk.isSelectionMode && (
          <button
            onClick={bulk.enterSelectionMode}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="선택 모드"
          >
            <CheckSquare className="size-5" />
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary-50 dark:bg-primary-950/50 flex items-center justify-center">
              <MapPin className="size-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">{stats.total}</p>
              <p className="text-sm text-zinc-500">전체 여행</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-success-50 dark:bg-success-950/50 flex items-center justify-center">
              <Calendar className="size-5 text-success-600 dark:text-success-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">{stats.upcoming}</p>
              <p className="text-sm text-zinc-500">예정된 여행</p>
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-warning-50 dark:bg-warning-950/50 flex items-center justify-center">
              <Star className="size-5 text-warning-600 dark:text-warning-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">{stats.totalPlans}</p>
              <p className="text-sm text-zinc-500">전체 일정</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Trip Grid */}
      {filteredTrips.length === 0 ? (
        <Card padding="lg" className="text-center">
          <div className="py-8">
            <MapPin className="size-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
              {searchQuery ? '검색 결과가 없습니다' : '아직 여행이 없습니다'}
            </h3>
            <p className="text-zinc-500 mb-6">
              {searchQuery
                ? '다른 검색어로 시도해보세요'
                : '첫 번째 여행을 만들어보세요!'}
            </p>
            {!searchQuery && (
              <>
                <Button to="/trips/new" color="primary" leftIcon={<Plus className="size-4" />}>
                  새 여행 만들기
                </Button>
                <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs text-zinc-400 space-y-1">
                    💡 Google Maps URL을 붙여넣으면 장소 정보가 자동으로 입력됩니다
                  </p>
                </div>
              </>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrips.map((trip) => (
            <Card
              key={trip.id}
              variant="interactive"
              padding="none"
              className={`overflow-hidden group relative ${bulk.isSelectionMode && trip.id && bulk.isSelected(trip.id) ? 'ring-2 ring-primary-500' : ''}`}
              style={{ viewTransitionName: `trip-card-${trip.id}` }}
              onClick={bulk.isSelectionMode ? (e: React.MouseEvent) => { e.preventDefault(); if (trip.id) bulk.toggle(trip.id) } : undefined}
            >
              {/* Selection checkbox overlay */}
              {bulk.isSelectionMode && (
                <div className="absolute top-2 left-2 z-10">
                  <div className={`size-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                    trip.id && bulk.isSelected(trip.id)
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'border-zinc-300 dark:border-zinc-600 bg-white/80 dark:bg-zinc-900/80'
                  }`}>
                    {trip.id && bulk.isSelected(trip.id) && <CheckSquare className="size-4" />}
                  </div>
                </div>
              )}
              <Link to={bulk.isSelectionMode ? '#' : `/trips/${trip.id}`} className="block" onClick={bulk.isSelectionMode ? (e: React.MouseEvent) => e.preventDefault() : undefined}>
                {/* Cover Image */}
                <div className="relative aspect-[16/10] bg-zinc-100 dark:bg-zinc-800">
                  {trip.coverImage ? (
                    <img
                      src={trip.coverImage}
                      alt={trip.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      style={{ viewTransitionName: `trip-image-${trip.id}` }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <MapPin className="size-8 text-zinc-300 dark:text-zinc-600" />
                    </div>
                  )}
                  {/* Favorite Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (trip.id) toggleFavorite(trip.id)
                    }}
                    className="absolute top-2 right-2 p-2 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm hover:bg-white dark:hover:bg-zinc-900 transition-colors"
                  >
                    <Star
                      className={`size-4 ${
                        trip.isFavorite
                          ? 'fill-warning-400 text-warning-400'
                          : 'text-zinc-400'
                      }`}
                    />
                  </button>
                  {/* Country Badge */}
                  <div className="absolute bottom-2 left-2">
                    <Badge color="primary" size="sm">
                      {trip.country}
                    </Badge>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-[var(--foreground)] group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {trip.title}
                  </h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    {formatDateRange(trip.startDate, trip.endDate)}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-zinc-400">
                      {getTripDuration(trip.startDate, trip.endDate)}일 · {trip.plansCount || 0}개 일정
                    </span>
                    <ChevronRight className="size-4 text-zinc-400 group-hover:text-primary-500 transition-colors" />
                  </div>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
      </div>
    </PageContainer>
  )
}
