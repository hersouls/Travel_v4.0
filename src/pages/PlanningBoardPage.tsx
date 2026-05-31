// ============================================
// Planning Board Page — 크로스데이 DnD 일정 편성 보드 (PC 전문가급)
// /trips/:id/board
// ============================================

import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, List } from 'lucide-react'
import { IconButton, Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageContainer } from '@/components/layout'
import { PlanningBoard } from '@/components/trip/PlanningBoard'
import { useCurrentTrip, useCurrentPlans, useTripLoading, useTripStore } from '@/stores/tripStore'
import { getTripDurationSafe } from '@/utils/timezone'
import { useIsDesktop } from '@/hooks/useMediaQuery'

export function PlanningBoardPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const trip = useCurrentTrip()
  const plans = useCurrentPlans()
  const isLoading = useTripLoading()
  const loadTrip = useTripStore((s) => s.loadTrip)
  const isDesktop = useIsDesktop()

  useEffect(() => {
    if (id) loadTrip(parseInt(id))
  }, [id, loadTrip])

  if (isLoading) {
    return (
      <PageContainer fullHeight>
        <div className="flex-1 p-4">
          <Skeleton height="100%" className="rounded-xl" />
        </div>
      </PageContainer>
    )
  }

  if (!trip) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <p className="text-zinc-500">여행을 찾을 수 없습니다</p>
          <Button to="/dashboard" color="primary" className="mt-4">
            대시보드로 이동
          </Button>
        </div>
      </PageContainer>
    )
  }

  const totalDays = getTripDurationSafe(trip.startDate, trip.endDate)

  return (
    <PageContainer fullHeight>
      <div className="flex h-full flex-col gap-4 p-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <IconButton plain color="secondary" onClick={() => navigate(`/trips/${trip.id}`)} aria-label="뒤로 가기">
              <ArrowLeft className="size-5" />
            </IconButton>
            <div>
              <h1 className="text-xl font-bold text-[var(--foreground)]">{trip.title} 플래닝 보드</h1>
              <p className="text-sm text-zinc-500">일정을 드래그해 날짜 간 이동</p>
            </div>
          </div>
          <Button
            to={`/trips/${trip.id}`}
            outline
            color="secondary"
            size="sm"
            leftIcon={<List className="size-4" />}
          >
            목록
          </Button>
        </div>

        {!isDesktop && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 p-3 text-sm text-zinc-500">
            플래닝 보드는 큰 화면(PC)에 최적화되어 있어요. 가로로 스크롤하거나 목록 보기를 이용하세요.
          </div>
        )}

        <div className="min-h-0 flex-1">
          {plans.length > 0 ? (
            <PlanningBoard
              tripId={trip.id!}
              plans={plans}
              totalDays={totalDays}
              onPlanClick={(p) => navigate(`/trips/${trip.id}/day/${p.day}`)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-500">일정이 없습니다</div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
