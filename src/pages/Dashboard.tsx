import { OnboardingModal } from '@/components/OnboardingModal'
import { PageContainer } from '@/components/layout'
import { VisitedCountries } from '@/components/travellog/VisitedCountries'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { RingProgress } from '@/components/ui/RingProgress'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useUser } from '@/stores/authStore'
import { useTripLoading, useTripStore, useTrips } from '@/stores/tripStore'
import { toast } from '@/stores/uiStore'
import type { Trip } from '@/types'
import { formatDateRange, getTripDuration } from '@/utils/format'
import { parseDateAsLocal } from '@/utils/timezone'
import {
  type Variants,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
} from 'framer-motion'
import {
  ArrowRight,
  CalendarClock,
  CheckSquare,
  ChevronRight,
  Globe,
  ListChecks,
  type LucideIcon,
  MapPin,
  Plane,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

/* ── framer-motion 진입 애니메이션 변형 (Health_v1.0 히어로 이식) ── */
const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
}
const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

/* 히어로 내부 스태거 — heroBand 는 부모 트리(container→item)에서 'show' 라벨을
   상속받아(직접 initial/animate 미지정 → 이중 모션 방지) 자식(인사·미션·칩)
   오케스트레이션만 담당. 모든 호출처는 반드시 동일한 모션 컨텍스트로 마운트할 것 */
const heroBand: Variants = {
  hidden: {},
  show: {
    transition: { when: 'beforeChildren', staggerChildren: 0.09, delayChildren: 0.06 },
  },
}
const heroChild: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 26, mass: 0.8 },
  },
}
const chipGrid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
}
const chipItem: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
}

/** 천단위 콤마 (ko-KR) */
function formatCount(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(n || 0))
}

/** "6월 13일" — 출발일 표기용 */
function formatMonthDayKo(iso: string): string {
  const d = parseDateAsLocal(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

/* ───────────────────────────────────────────
   히어로 밴드 타입 — 미션은 진행 중 > 다가오는 > 새 여행 제안 순
   ─────────────────────────────────────────── */
interface HeroChip {
  icon: LucideIcon
  label: string
  value: string
  sub: string
}

type HeroMission =
  | { kind: 'ongoing'; trip: Trip; dayN: number; duration: number }
  | { kind: 'upcoming'; trip: Trip; dDay: number }
  | { kind: 'none' }

export function Dashboard() {
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('q') || ''
  const trips = useTrips()
  const isLoading = useTripLoading()
  const toggleFavorite = useTripStore((state) => state.toggleFavorite)
  const deleteTrips = useTripStore((state) => state.deleteTrips)
  const user = useUser()
  const name = user?.displayName || '여행자'

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
        trip.title.toLowerCase().includes(query) || trip.country.toLowerCase().includes(query),
    )
  }, [trips, searchQuery])

  // Calculate stats — 히어로 미션과 동일하게 정오(12:00) 기준으로 비교해
  // 당일 출발 여행이 시간대에 따라 '예정' 집계에서 들쭉날쭉해지는 것을 방지
  const stats = useMemo(() => {
    const todayNoon = new Date()
    todayNoon.setHours(12, 0, 0, 0)
    const upcoming = trips.filter((t) => parseDateAsLocal(t.startDate) > todayNoon).length
    const totalPlans = trips.reduce((sum, t) => sum + (t.plansCount || 0), 0)
    return { total: trips.length, upcoming, totalPlans }
  }, [trips])

  // Hero data — 미션(진행 중/다가오는 여행) + 방문 국가
  const hero = useMemo(() => {
    // parseDateAsLocal 은 정오(12:00) 기준 Date 를 반환하므로 오늘도 정오로 맞춰 비교
    const todayNoon = new Date()
    todayNoon.setHours(12, 0, 0, 0)

    const countryMap = new Map<string, number>()
    for (const t of trips) {
      if (t.country) countryMap.set(t.country, (countryMap.get(t.country) || 0) + 1)
    }
    const topCountry = [...countryMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

    const ongoing = trips
      .filter(
        (t) =>
          parseDateAsLocal(t.startDate) <= todayNoon && todayNoon <= parseDateAsLocal(t.endDate),
      )
      .sort((a, b) => a.endDate.localeCompare(b.endDate))[0]
    const next = trips
      .filter((t) => parseDateAsLocal(t.startDate) > todayNoon)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]

    const nextDDay = next
      ? Math.round((parseDateAsLocal(next.startDate).getTime() - todayNoon.getTime()) / 86_400_000)
      : 0

    let mission: HeroMission = { kind: 'none' }
    if (ongoing) {
      const dayN =
        Math.round(
          (todayNoon.getTime() - parseDateAsLocal(ongoing.startDate).getTime()) / 86_400_000,
        ) + 1
      mission = {
        kind: 'ongoing',
        trip: ongoing,
        dayN,
        duration: getTripDuration(ongoing.startDate, ongoing.endDate),
      }
    } else if (next) {
      mission = { kind: 'upcoming', trip: next, dDay: nextDDay }
    }
    return {
      mission,
      countries: countryMap.size,
      topCountry,
      next: next ? { title: next.title, dDay: nextDDay } : null,
    }
  }, [trips])

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }),
    [],
  )

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <div className="h-56 animate-shimmer rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-[200px] animate-shimmer rounded-xl" />
            ))}
          </div>
        </div>
      </PageContainer>
    )
  }

  const isWelcome = trips.length === 0

  const heroChips: HeroChip[] = [
    {
      icon: MapPin,
      label: '전체 여행',
      value: formatCount(stats.total),
      sub: '지금까지의 여정',
    },
    {
      icon: CalendarClock,
      label: '예정된 여행',
      value: formatCount(stats.upcoming),
      sub: hero.next ? `D-${hero.next.dDay} · ${hero.next.title}` : '계획된 여행 없음',
    },
    {
      icon: ListChecks,
      label: '전체 일정',
      value: formatCount(stats.totalPlans),
      sub: '등록된 장소·일정',
    },
    {
      icon: Globe,
      label: '방문 국가',
      value: formatCount(hero.countries),
      sub: hero.topCountry ? `최다 방문 · ${hero.topCountry}` : '여정을 기다려요',
    },
  ]

  return (
    <PageContainer>
      <OnboardingModal />

      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isPullRefreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all"
          style={{ height: pullDistance || (isPullRefreshing ? 40 : 0) }}
        >
          <RefreshCw
            className={`size-5 text-primary-500 ${isPullRefreshing ? 'animate-spin' : ''}`}
          />
        </div>
      )}

      <motion.div className="space-y-6" variants={container} initial="hidden" animate="show">
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
                  try {
                    await deleteTrips(bulk.selectedIds)
                    toast.success(`${bulk.count}개 여행이 삭제되었습니다`)
                    bulk.clearSelection()
                  } catch {
                    toast.error('여행 삭제 중 오류가 발생했습니다')
                  }
                }
              }}
            >
              삭제
            </Button>
            <button
              type="button"
              onClick={bulk.clearSelection}
              className="p-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              aria-label="선택 해제"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* 히어로 — 인사 + 여행 미션 + 핵심 지표 (하이엔드 오로라 밴드) */}
        <motion.div variants={item}>
          <Hero
            name={name}
            todayLabel={todayLabel}
            subtitle={
              searchQuery
                ? `"${searchQuery}" 검색 결과 ${filteredTrips.length}개`
                : isWelcome
                  ? '여행 일정과 추억을 한 곳에서 관리해 보세요'
                  : '오늘도 설레는 여정 되세요'
            }
            mission={isWelcome ? undefined : hero.mission}
            chips={isWelcome ? [] : heroChips}
            selectSlot={
              filteredTrips.length > 0 && !bulk.isSelectionMode ? (
                <button
                  type="button"
                  onClick={bulk.enterSelectionMode}
                  title="선택 모드"
                  aria-label="선택 모드"
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-white/20 to-white/[0.1] px-3 py-1.5 text-xs font-semibold ring-1 ring-white/25 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.3)] backdrop-blur-sm [letter-spacing:0.01em] transition-all hover:ring-white/45 active:scale-95"
                >
                  <CheckSquare className="hero-ink-2 h-3.5 w-3.5" />
                  <span className="hero-ink-1">선택</span>
                </button>
              ) : undefined
            }
          />
        </motion.div>

        {/* Visited Countries */}
        {trips.length > 0 && (
          <motion.div variants={item}>
            <Card padding="md">
              <VisitedCountries trips={trips} />
            </Card>
          </motion.div>
        )}

        {/* Trip Grid */}
        {filteredTrips.length === 0 ? (
          <motion.div variants={item}>
            <Card padding="lg" className="text-center">
              <div className="py-8">
                <MapPin className="size-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
                <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
                  {searchQuery ? '검색 결과가 없습니다' : '아직 여행이 없습니다'}
                </h2>
                <p className="text-zinc-400 mb-6">
                  {searchQuery ? '다른 검색어로 시도해보세요' : '첫 번째 여행을 만들어보세요!'}
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
          </motion.div>
        ) : (
          <motion.div
            variants={item}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filteredTrips.map((trip) => (
              <Card
                key={trip.id}
                variant="interactive"
                padding="none"
                className={`overflow-hidden group relative ${bulk.isSelectionMode && trip.id && bulk.isSelected(trip.id) ? 'ring-2 ring-primary-500' : ''}`}
                style={{ viewTransitionName: `trip-card-${trip.id}` }}
                role={bulk.isSelectionMode ? 'checkbox' : undefined}
                aria-checked={
                  bulk.isSelectionMode && trip.id ? bulk.isSelected(trip.id) : undefined
                }
                aria-label={bulk.isSelectionMode ? `${trip.title} 선택` : undefined}
                tabIndex={bulk.isSelectionMode ? 0 : undefined}
                onClick={
                  bulk.isSelectionMode
                    ? (e: React.MouseEvent) => {
                        e.preventDefault()
                        if (trip.id) bulk.toggle(trip.id)
                      }
                    : undefined
                }
                onKeyDown={
                  bulk.isSelectionMode
                    ? (e: React.KeyboardEvent) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          if (trip.id) bulk.toggle(trip.id)
                        }
                      }
                    : undefined
                }
              >
                {/* Selection checkbox overlay */}
                {bulk.isSelectionMode && (
                  <div className="absolute top-2 left-2 z-10">
                    <div
                      className={`size-6 rounded-md border-2 flex items-center justify-center transition-colors ${
                        trip.id && bulk.isSelected(trip.id)
                          ? 'bg-primary-500 border-primary-500 text-white'
                          : 'border-zinc-300 dark:border-zinc-600 bg-white/80 dark:bg-zinc-900/80'
                      }`}
                    >
                      {trip.id && bulk.isSelected(trip.id) && <CheckSquare className="size-4" />}
                    </div>
                  </div>
                )}
                <Link
                  to={bulk.isSelectionMode ? '#' : `/trips/${trip.id}`}
                  className="block"
                  onClick={
                    bulk.isSelectionMode ? (e: React.MouseEvent) => e.preventDefault() : undefined
                  }
                >
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
                          trip.isFavorite ? 'fill-warning-400 text-warning-400' : 'text-zinc-400'
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
                    <p className="text-sm text-zinc-400 mt-1">
                      {formatDateRange(trip.startDate, trip.endDate)}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-zinc-400">
                        {getTripDuration(trip.startDate, trip.endDate)}일 · {trip.plansCount || 0}개
                        일정
                      </span>
                      <ChevronRight className="size-4 text-zinc-400 group-hover:text-primary-500 transition-colors" />
                    </div>
                  </div>
                </Link>
              </Card>
            ))}
          </motion.div>
        )}
      </motion.div>
    </PageContainer>
  )
}

/* ───────────────────────────────────────────
   히어로 밴드 (오로라 그라데이션 + 여행 미션 + 핵심 지표)
   Health_v1.0 dash-hero 이식 — 구조·모션·재질 동일
   ─────────────────────────────────────────── */

/* 칩 핵심값 — 순수 숫자(천단위 콤마 포함)만 스프링 카운트업,
   단위 섞인 값과 reduce-motion 은 즉시 표시 */
function AnimatedChipValue({ value }: { value: string }) {
  const reduce = useReducedMotion()
  const numeric = /^[0-9,]+$/.test(value.trim())
  const target = numeric ? Number(value.replace(/,/g, '')) : 0
  const spring = useSpring(0, { stiffness: 90, damping: 20, mass: 0.6 })
  const [display, setDisplay] = useState(numeric ? '0' : value)

  useEffect(() => {
    if (!numeric || reduce) {
      setDisplay(value)
      return
    }
    // 마운트 시 0→목표 카운트업, 데이터 갱신 시 이전 값→새 값 스프링 전이
    const t = setTimeout(() => spring.set(target), 120)
    return () => clearTimeout(t)
  }, [value, numeric, reduce, target, spring])

  useMotionValueEvent(spring, 'change', (v) => {
    if (numeric && !reduce) setDisplay(formatCount(v))
  })

  return (
    <p className="hero-ink-1 mt-2 text-xl font-bold leading-none tabular-nums [letter-spacing:-0.015em]">
      {display}
    </p>
  )
}

function missionTexts(m: HeroMission): { title: string; sub: string } {
  if (m.kind === 'ongoing') {
    const remaining = m.duration - m.dayN
    return {
      title: m.trip.title,
      sub: `${m.trip.country} · ${m.dayN}일차${remaining > 0 ? ` · ${remaining}일 남음` : ' · 마지막 날이에요'}`,
    }
  }
  if (m.kind === 'upcoming') {
    return {
      title: m.trip.title,
      sub: `${m.trip.country} · ${formatMonthDayKo(m.trip.startDate)} 출발 · ${getTripDuration(m.trip.startDate, m.trip.endDate)}일 여정`,
    }
  }
  return {
    title: '새 여행을 계획해 보세요',
    sub: '여행을 만들면 D-day와 진행 상황이 여기에 표시돼요',
  }
}

function Hero({
  name,
  todayLabel,
  subtitle,
  mission,
  chips,
  selectSlot,
}: {
  name: string
  todayLabel: string
  subtitle: string
  mission?: HeroMission
  chips: HeroChip[]
  selectSlot?: React.ReactNode
}) {
  const texts = mission ? missionTexts(mission) : null

  return (
    <motion.div className="dash-hero p-6 sm:p-8" variants={heroBand}>
      {/* 장식 — 부유 광원 */}
      <div className="dash-hero__shapes" aria-hidden="true">
        <span className="dash-hero__shape dash-hero__shape--a" />
        <span className="dash-hero__shape dash-hero__shape--b" />
        <span className="dash-hero__shape dash-hero__shape--c" />
      </div>

      <div className="dash-hero__content">
        <motion.div
          variants={heroChild}
          className="flex flex-wrap items-start justify-between gap-3"
        >
          <div>
            <p className="hero-ink-2 text-[0.8125rem] font-semibold tabular-nums [letter-spacing:0.02em]">
              {todayLabel}
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-[1.12] [letter-spacing:-0.014em] sm:text-[1.9rem]">
              <span className="hero-ink-2">안녕하세요,</span>{' '}
              <span className="font-extrabold">{name}</span>님{' '}
              <span className="inline-block" aria-hidden="true">
                👋
              </span>
            </h1>
            <p className="hero-ink-2 mt-2 text-sm leading-[1.5] [letter-spacing:-0.006em]">
              {subtitle}
            </p>
          </div>
          {selectSlot}
        </motion.div>

        {/* 여행 미션 — 진행 중 일차 링 / D-day 카운트다운 링 + CTA */}
        {mission && texts && (
          <motion.div
            variants={heroChild}
            className="mt-6 flex items-center gap-4 rounded-2xl bg-[color-mix(in_oklab,var(--color-primary-950)_32%,transparent)] bg-gradient-to-b from-white/[0.16] to-white/[0.07] p-4 ring-1 ring-white/20 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.28),0_10px_24px_-14px_rgba(0,0,0,0.45)] backdrop-blur-md sm:gap-5 sm:p-5"
          >
            {mission.kind === 'ongoing' && (
              <div className="[filter:drop-shadow(0_0_6px_rgba(255,255,255,0.45))]">
                <RingProgress
                  value={mission.dayN}
                  max={mission.duration}
                  size={72}
                  strokeWidth={7}
                  color="#ffffff"
                  trackColor="rgba(255,255,255,0.22)"
                  animateOnMount
                >
                  <span className="hero-ink-1 text-base font-bold leading-none tabular-nums">
                    {mission.dayN}
                    <span className="hero-ink-3 text-[11px] font-medium">/{mission.duration}</span>
                  </span>
                  <span className="hero-ink-4 mt-0.5 text-[9px] [letter-spacing:0.03em]">일차</span>
                </RingProgress>
              </div>
            )}
            {mission.kind === 'upcoming' && (
              <div className="[filter:drop-shadow(0_0_6px_rgba(255,255,255,0.45))]">
                <RingProgress
                  value={Math.max(0, 30 - mission.dDay)}
                  max={30}
                  size={72}
                  strokeWidth={7}
                  color="#ffffff"
                  trackColor="rgba(255,255,255,0.22)"
                  animateOnMount
                >
                  <span className="hero-ink-1 text-base font-bold leading-none tabular-nums">
                    D-{mission.dDay}
                  </span>
                  <span className="hero-ink-4 mt-0.5 text-[9px] [letter-spacing:0.03em]">
                    출발까지
                  </span>
                </RingProgress>
              </div>
            )}
            {mission.kind === 'none' && (
              <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-white/[0.18] to-white/[0.08] ring-1 ring-white/25 [filter:drop-shadow(0_0_6px_rgba(255,255,255,0.35))]">
                <Plane className="hero-ink-1 h-7 w-7" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="hero-ink-1 truncate text-sm font-bold [letter-spacing:-0.012em] sm:text-base">
                {texts.title}
              </p>
              <p className="hero-ink-3 mt-1 truncate text-xs leading-[1.45] tabular-nums sm:text-sm">
                {texts.sub}
              </p>
            </div>

            {mission.kind === 'none' ? (
              <Link
                to="/trips/new"
                className="dash-cta inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-b from-white to-primary-50 px-3.5 py-2 text-xs font-bold text-primary-700 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.9),0_8px_18px_-8px_color-mix(in_oklab,var(--color-primary-900)_55%,transparent)] transition-all hover:scale-[1.04] hover:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.95),0_12px_24px_-8px_color-mix(in_oklab,var(--color-primary-900)_60%,transparent)] active:scale-95 sm:gap-1.5 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                <Plus className="h-4 w-4" />새 여행
              </Link>
            ) : (
              <Link
                to={`/trips/${mission.trip.id}`}
                className="dash-cta inline-flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-b from-white to-primary-50 px-3.5 py-2 text-xs font-bold text-primary-700 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.9),0_8px_18px_-8px_color-mix(in_oklab,var(--color-primary-900)_55%,transparent)] transition-all hover:scale-[1.04] hover:[box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.95),0_12px_24px_-8px_color-mix(in_oklab,var(--color-primary-900)_60%,transparent)] active:scale-95 sm:gap-1.5 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                일정 보기
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </motion.div>
        )}

        {chips.length > 0 && (
          <motion.div variants={chipGrid} className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {chips.map((c) => {
              const Icon = c.icon
              return (
                <motion.div
                  key={c.label}
                  variants={chipItem}
                  whileHover={{ y: -3 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  className="dash-chip rounded-2xl bg-gradient-to-b from-white/[0.14] to-white/[0.06] px-4 py-3 ring-1 ring-white/20 [box-shadow:inset_0_1px_0_0_rgba(255,255,255,0.22),0_6px_16px_-12px_rgba(0,0,0,0.4)] backdrop-blur-sm"
                >
                  <div className="hero-ink-3 flex items-center gap-1.5 text-xs font-medium [letter-spacing:0.01em]">
                    <Icon className="h-3.5 w-3.5" />
                    {c.label}
                  </div>
                  <AnimatedChipValue value={c.value} />
                  <p className="hero-ink-4 mt-1 truncate text-[11px] leading-snug">{c.sub}</p>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
